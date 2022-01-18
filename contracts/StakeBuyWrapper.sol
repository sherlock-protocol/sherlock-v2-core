// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISherlock.sol';
import './interfaces/IBuySher.sol';

/// @title Sherlock core interface for stakers
/// @author Evert Kors
// This contract allows people to stake and buy in a single transaction
contract StakeBuyWrapper {
  using SafeERC20 for IERC20;

  error InvalidState();
  error InvalidSender();

  uint256 internal constant USDC_DECIMALS = 10**6;
  uint256 internal constant SHER_DECIMALS = 10**18;

  uint256 constant PERIOD = 26 weeks;

  // USDC token address (6 decimals)
  IERC20 public immutable usdc;
  IERC20 public immutable sher;
  // The `Sherlock.sol` contract that is a ERC721
  ISherlock public immutable sherlockPosition;

  IBuySher public immutable buySher;

  address public immutable rescuer;

  constructor(IBuySher _buySher) {
    usdc = _buySher.usdc();
    sher = _buySher.sher();
    sherlockPosition = _buySher.sherlockPosition();

    buySher = _buySher;
    rescuer = msg.sender;

    usdc.approve(address(sherlockPosition), type(uint256).max);
    usdc.approve(address(buySher), type(uint256).max);
  }

  function viewFundsNeeded(uint256 _maxSher)
    public
    view
    returns (
      uint256 sherAmount,
      uint256 stake,
      uint256 price
    )
  {
    if (block.timestamp > buySher.deadline()) revert InvalidState();
    uint256 available = sher.balanceOf(address(buySher));
    sherAmount = available < _maxSher ? available : _maxSher;

    // Adding +1 for potential rounding differences
    stake = ((sherAmount * USDC_DECIMALS) / buySher.rate()) + 1;
    price = ((sherAmount * buySher.price()) / SHER_DECIMALS) + 1;
  }

  function execute(uint256 _maxSher) external {
    (uint256 sherAmount, uint256 stake, uint256 price) = viewFundsNeeded(_maxSher);
    // transfer funds from user here
    usdc.safeTransferFrom(msg.sender, address(this), stake + price);

    // stake the funds for user
    (uint256 id, ) = sherlockPosition.initialStake(stake, PERIOD, address(this));
    // buy SHER for user and send it to user
    buySher.buy(id, sherAmount, msg.sender);

    // transfer stake NFT receipt to user
    sherlockPosition.safeTransferFrom(address(this), msg.sender, id);
  }

  /// @notice USDC isn't meant to stay in this contract
  function recoverUsdc() external {
    if (msg.sender != rescuer) revert InvalidSender();
    usdc.safeTransfer(rescuer, usdc.balanceOf(address(this)));
  }
}
