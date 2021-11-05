// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Managers/ISherDistributionManager.sol';
import './Managers/IStrategyManager.sol';

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
  function updateStrategy(IStrategyManager _strategy) external;

  /// @notice Remove SHER strategy
  function removeStrategy() external;

  /// @notice Read current strategy
  /// @return Address of current strategy
  function strategy() external view returns (IStrategyManager);

  /// @notice Update address eligble for non staker rewards from protocol premiums
  /// @param _nonStakers Address eligble for non staker rewards
  function updateNonStakersAddress(address _nonStakers) external;

  /// @notice View current non stakers address
  /// @return Current non staker address
  /// @dev Is able to pull funds out of the contract
  function nonStakersAddress() external view returns (address);

  /// @notice View current address able to pull payouts
  /// @return Address able to pull payouts
  function sherlockPayoutManager() external view returns (address);

  /// @notice Transfer payout manager role to different address
  /// @param _sherlockPayoutManager New address of payout manager
  function updateSherlockPayoutManager(address _sherlockPayoutManager) external;

  /// @notice Update max limit of TVL sherlock writes for coverage
  /// @param _limit New max percentage of TVL to be paid out
  /// @dev scaled by 10**18, 100% = 10**18
  /// @dev will be used to limit payout manager
  function updateRiskLimit(uint256 _limit) external;
}
