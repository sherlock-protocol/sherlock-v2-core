// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './IManager.sol';

interface ISherDistributionManager is IManager {
  // constructor: all variables for curve + sherlock address + owner + SHER token contract
  // anyone can just send token to this contract to fund rewards

  /// @notice Caller will receive `_sher` SHER tokens based on `_amount` and `_period`
  /// @param _amount Amount of tokens
  /// @param _period Period of time, in seconds
  /// @return _sher Amount of SHER tokens to be receiver
  /// @dev calling contract will depend of before + after balance diff and return value
  function pullReward(uint256 _amount, uint256 _period) external returns (uint256 _sher);

  /// @notice Calculate how much `_sher` SHER tokens will be send based on `_amount` and `_period`
  /// @param _amount Amount of tokens
  /// @param _period Period of time, in seconds
  /// @return _sher Amount of SHER tokens
  function calcReward(uint256 _amount, uint256 _period) external view returns (uint256 _sher);

  /// @notice Function used to check if this is the current active distribution manager
  /// @return Boolean indicating it's active
  /// @dev if inactive the owner can pull all ERC20s
  /// @dev will be checked by calling the sherlock contract
  function isActive() external view returns (bool);

  /// @notice Get ERC20 tokens out of contract
  /// @param _receiver Address that will receive tokens
  /// @param _extraTokens Array of tokens to be send
  /// @dev can only be called if not active
  function sweep(address _receiver, IERC20[] memory _extraTokens) external;
}
