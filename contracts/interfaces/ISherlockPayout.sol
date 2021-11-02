// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

/// @title Sherlock core interface for stakers
/// @author Evert Kors
interface ISherlockPayout {
  /// @notice Initiate a payout of `_amount` to `_receiver`
  /// @param _amount Amount to send
  /// @param _receiver Receiver of payout
  /// @dev only payout manager should call this
  function payout(uint256 _amount, address _receiver) external;
}
