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

  uint256 constant PERIOD = 26 weeks;

  // USDC token address (6 decimals)
  IERC20 public immutable usdc;
  // The `Sherlock.sol` contract that is a ERC721
  ISherlock public immutable sherlockPosition;

  IBuySher public immutable buySher;

  constructor(
    IERC20 _sher,
    IERC20 _usdc,
    ISherlock _sherlockPosition,
    IBuySher _buySher
  ) {
    usdc = _usdc;
    sherlockPosition = _sherlockPosition;
    buySher = _buySher;

    usdc.approve(address(sherlockPosition), type(uint256).max);
    usdc.approve(address(buySher), type(uint256).max);
  }

  function execute(uint256 _maxSher) external {
    (uint256 sherAmount, uint256 stake, uint256 price) = buySher.viewFundsNeeded(_maxSher);
    // transfer funds from user here
    usdc.safeTransferFrom(msg.sender, address(this), stake + price);

    // stake the funds for user
    (uint256 id, ) = sherlockPosition.initialStake(stake, PERIOD, address(this));
    // buy SHER for user and send it to user
    buySher.buy(id, sherAmount, msg.sender);

    // transfer stake NFT receipt to user
    sherlockPosition.safeTransferFrom(address(this), msg.sender, id);
  }
}
