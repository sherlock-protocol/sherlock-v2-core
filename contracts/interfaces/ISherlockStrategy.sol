// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

/// @title Sherlock core interface for stakers
/// @author Evert Kors
interface ISherlockStrategy {
  /// @notice Deposit `_amount` into active strategy
  /// @param _amount Amount of tokens
  /// @dev gov only
  function strategyDeposit(uint256 _amount) external;

  /// @notice Withdraw `_amount` from active strategy
  /// @param _amount Amount of tokens
  /// @dev gov only
  function strategyWithdraw(uint256 _amount) external;

  /// @notice Withdraw all funds from active strategy
  /// @dev gov only
  function strategyWithdrawAll() external;
}
