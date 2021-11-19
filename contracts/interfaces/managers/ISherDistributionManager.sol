// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IManager.sol';

interface ISherDistributionManager is IManager {
  // anyone can just send token to this contract to fund rewards

  event Initialized(uint256 maxRewardsEndTVL, uint256 zeroRewardsStartTVL, uint256 maxRewardRate);

  /// @notice Caller will receive `_sher` SHER tokens based on `_amount` and `_period`
  /// @param _amount Amount of tokens
  /// @param _period Period of time, in seconds
  /// @return _sher Amount of SHER tokens to be receiver
  /// @dev calling contract will depend of before + after balance diff and return value\
  /// @dev INCLUDING, function expects the `_amount` to be deposited already
  /// @dev e.g. if tvl=50, amount=50. It would calculate for the first 50 tokens going in
  function pullReward(uint256 _amount, uint256 _period) external returns (uint256 _sher);

  /// @notice Calculate how much `_sher` SHER tokens will be send based on `_amount` and `_period`
  /// @param _tvl TVL to use for reward calculation
  /// @param _amount Amount of tokens
  /// @param _period Period of time, in seconds
  /// @return _sher Amount of SHER tokens
  /// @dev EXCLUDING `_amount` will be added on top of TVL (_tvl is excluding _amount)
  /// @dev e.g. if tvl=0, amount=50. It would calculate for the first 50 tokens going in
  function calcReward(
    uint256 _tvl,
    uint256 _amount,
    uint256 _period
  ) external view returns (uint256 _sher);

  /// @notice Function used to check if this is the current active distribution manager
  /// @return Boolean indicating it's active
  /// @dev if inactive the owner can pull all ERC20s
  /// @dev will be checked by calling the sherlock contract
  function isActive() external view returns (bool);
}
