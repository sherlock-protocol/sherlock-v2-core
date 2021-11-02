// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './ISherDistributionManager.sol';
import './IStrategy.sol';

/// @title Sherlock core interface for governance
/// @author Evert Kors
interface ISherlockGov {
  /// @notice Allows stakers to stake for `_period` of time
  /// @param _period Period of time, in seconds,
  /// @dev should revert if already enabled
  function enablePeriod(uint256 _period) external;

  /// @notice Disallow stakers to stake for `_period` of time
  /// @param _period Period of time, in seconds,
  /// @dev should revert if already disabled
  function disablePeriod(uint256 _period) external;

  /// @notice View if `_period` is a valid period
  /// @return Boolean indicatin if period is valid
  function periods(uint256 _period) external view returns (bool);

  /// @notice Update SHER distribution manager contract
  /// @param _manager New adddress of the manager
  function updateSherDistributionManager(ISherDistributionManager _manager) external;

  /// @notice Remove SHER token rewards
  function removeSherDistributionManager() external;

  /// @notice Read SHER distribution manager
  /// @return Address of current SHER distribution manager
  function sherDistributionManager() external view returns (ISherDistributionManager);

  /// @notice Update yield strategy
  /// @param _strategy News address of the strategy
  function updateStrategy(IStrategy _strategy) external;

  /// @notice Remove SHER strategy
  function removeStrategy() external;

  /// @notice Read current strategy
  /// @return Address of current strategy
  function strategy() external view returns (IStrategy);

  /// @notice Update address eligble for non staker rewards from protocol premiums
  /// @param _nonStakers Address eligble for non staker rewards
  function updateNonStakersAddress(address _nonStakers) external;

  /// @notice View current non stakers address
  /// @return Current non staker address
  function nonStakersAddress() external view returns (address);
}