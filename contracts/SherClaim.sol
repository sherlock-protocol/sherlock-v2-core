// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISherClaim.sol';

/// @title Sherlock core interface for stakers
/// @author Evert Kors
// This contract allows you to claim your bought SHER
// The conract has two states seperated by the `claimableAt` timestamp
// Up until the timestamp, to be claimed SHER can be added using `add()`
// After and including the timestamp, SHER can be claimed using `claim())`
contract SherClaim is ISherClaim {
  using SafeERC20 for IERC20;

  // claim() will be activated between BOTTOM and CEILING days after deployment
  uint256 internal constant CLAIM_PERIOD_SANITY_BOTTOM = 7 days;
  uint256 internal constant CLAIM_PERIOD_SANITY_CEILING = 14 days;

  // Timestamp when SHER can be claimed
  uint256 public immutable override claimableAt;
  // SHER token address (18 decimals)
  IERC20 public immutable sher;

  // Mapping how much each user is able to claim
  mapping(address => uint256) public userClaims;

  constructor(IERC20 _sher, uint256 _claimableAt) {
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (_claimableAt < block.timestamp + CLAIM_PERIOD_SANITY_BOTTOM) revert InvalidState();
    if (_claimableAt > block.timestamp + CLAIM_PERIOD_SANITY_CEILING) revert InvalidState();

    sher = _sher;
    claimableAt = _claimableAt;
  }

  function add(address _user, uint256 _amount) external override {
    if (_user == address(0)) revert ZeroArgument();
    if (_amount == 0) revert ZeroArgument();
    if (block.timestamp >= claimableAt) revert InvalidState();

    sher.safeTransferFrom(msg.sender, address(this), _amount);
    userClaims[_user] += _amount;

    emit Add(msg.sender, _user, _amount);
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
