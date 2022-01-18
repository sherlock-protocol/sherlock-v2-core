// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISherlock.sol';
import './interfaces/IBuySherClaim.sol';

/// @title Sherlock core interface for stakers
/// @author Evert Kors
// This contract allows you to claim your bought SHER
contract BuySherClaim is IBuySherClaim {
  using SafeERC20 for IERC20;

  uint256 internal constant CLAIM_PERIOD_SANITY_BOTTOM = 9 days;
  uint256 internal constant CLAIM_PERIOD_SANITY_CEILING = 10 days;

  event Claim(address indexed buyer, uint256 amount);

  // SHER token address (18 decimals)
  IERC20 public immutable sher;

  // Mapping how much each user is able to claim
  mapping(address => uint256) public userClaims;

  uint256 public immutable claimableAt;

  constructor(IERC20 _sher, uint256 _claimableAt) {
    if (_claimableAt < block.timestamp + CLAIM_PERIOD_SANITY_BOTTOM) revert InvalidState();
    if (_claimableAt > block.timestamp + CLAIM_PERIOD_SANITY_CEILING) revert InvalidState();

    sher = _sher;
    claimableAt = _claimableAt;
  }

  function add(address _user, uint256 _amount) external override {
    sher.safeTransferFrom(msg.sender, address(this), _amount);
    userClaims[_user] += _amount;
  }

  function claim() external {
    if (block.timestamp < claimableAt) revert InvalidState();

    uint256 amount = userClaims[msg.sender];
    if (amount == 0) revert InvalidAmount();

    delete userClaims[msg.sender];

    sher.safeTransfer(msg.sender, amount);

    emit Claim(msg.sender, amount);
  }
}
