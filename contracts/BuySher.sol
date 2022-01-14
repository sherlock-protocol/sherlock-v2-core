// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './interfaces/ISherlock.sol';

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

/// @title Sherlock core interface for stakers
/// @author Evert Kors
// This is the contract that manages the buying of SHER tokens
// Tokens can be bought on a fixed rate
// Tokens can only be bought if the sender is owner of a sherlock staking position
// For every staking positon the sender has, they are able to buy tokens once
// The max amount they are able to buy is based on the underlying USDC value of the positions
// On every buy USDC is send to the owner, which will be multisig
contract BuySher is Ownable {
  using SafeERC20 for IERC20;

  // Amount of decimals USDC has
  uint256 internal constant USDC_DECIMALS = 10**6;

  uint256 internal constant SHER_DECIMALS = 10**18;
  // 200 SHER tokens
  uint256 public constant SHER_DUST_AMOUNT = 200 * 10**18;

  IERC20 public immutable sher;
  IERC20 public immutable usdc;
  // 'rate' being 10**18 means 1 USDC of the position is able to buy 1 SHER token
  uint256 public immutable rate;
  // 'cost' being 10**6 means 1 USDC transferred will buy 1 SHER token
  uint256 public immutable cost;
  ISherlock public immutable sherlockPosition;

  mapping(uint256 => bool) public sherlockPositionUsed;

  error InvalidSender();
  error AlreadyUsed();
  error InvalidAmount();
  error ZeroArgument();
  error InsufficientSher();

  constructor(
    IERC20 _sher,
    IERC20 _usdc,
    uint256 _rate,
    uint256 _cost,
    ISherlock _sherlockPosition
  ) {
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (address(_usdc) == address(0)) revert ZeroArgument();
    if (_rate == 0) revert ZeroArgument();
    if (_cost == 0) revert ZeroArgument();
    if (address(_sherlockPosition) == address(0)) revert ZeroArgument();

    sher = _sher;
    usdc = _usdc;
    rate = _rate;
    cost = _cost;
    sherlockPosition = _sherlockPosition;
  }

  function viewBuyLimit(uint256 _sherlockPositionID) public view returns (uint256) {
    if (sherlockPositionUsed[_sherlockPositionID]) revert AlreadyUsed();

    // It is known that the underlying usdc amount will be higher as the aave/premiums come in
    // Potentially increasing the buy power
    uint256 usdcBalance = sherlockPosition.tokenBalanceOf(_sherlockPositionID);
    uint256 maxSherAmount = (usdcBalance * rate) / USDC_DECIMALS;
    uint256 contractSherBalance = sher.balanceOf(address(this));

    return (contractSherBalance > maxSherAmount) ? contractSherBalance : maxSherAmount;
  }

  function viewCosts(uint256 _amountOfSher) public view returns (uint256) {
    return (_amountOfSher * cost) / SHER_DECIMALS;
  }

  function buy(uint256 _sherlockPositionID, uint256 _amountOfSher) external {
    if (_sherlockPositionID == 0) revert ZeroArgument();
    if (_amountOfSher == 0) revert ZeroArgument();
    if (msg.sender != sherlockPosition.ownerOf(_sherlockPositionID)) revert InvalidSender();

    // viewBuyLimit will revert is sherlockPositionUsed = true
    if (_amountOfSher > viewBuyLimit(_sherlockPositionID)) revert InvalidAmount();
    sherlockPositionUsed[_sherlockPositionID] = true;

    // USDC will be send to owner, which is a multisig
    usdc.safeTransferFrom(msg.sender, owner(), viewCosts(_amountOfSher));
    sher.safeTransfer(msg.sender, _amountOfSher);
  }

  function claimLeftOverSHER() external onlyOwner {
    uint256 balance = sher.balanceOf(address(this));
    if (balance > SHER_DUST_AMOUNT) revert InvalidAmount();

    sher.safeTransfer(msg.sender, balance);
  }
}
