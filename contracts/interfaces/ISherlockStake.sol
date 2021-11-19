// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

/// @title Sherlock core interface for stakers
/// @author Evert Kors
interface ISherlockStake {
  /// @notice View the current deadline of `_tokenID`
  /// @return Timestamp when NFT position unlocks
  function lockupEnd(uint256 _tokenID) external view returns (uint256);

  /// @notice View the current SHER reward of `_tokenID`
  /// @return Amount of SHER rewarded to owner upon reaching deadline
  function sherRewards(uint256 _tokenID) external view returns (uint256);

  /// @notice View the current token balance claimable upon reaching deadline
  /// @return Amount of tokens assigned to owner when burning position
  function tokenBalanceOf(uint256 _tokenID) external view returns (uint256);

  /// @notice View current total staker TVL
  /// @return Total amount of tokens staked
  /// @dev Contains principles + strategy + premiums
  /// @dev Will calculate the most up to date value for each block
  function totalTokenBalanceStakers() external view returns (uint256);

  /// @notice Stake `_amount` and lockup for `_period` seconds, `_receiver` will receive the receipt.`
  /// @param _amount Amount of tokens to stake
  /// @param _period Period of time, in seconds, to lockup your funds
  /// @param _receiver Address that will receive the NFT representing the position
  /// @return _id TokenID of the position
  /// @return _sher Amount of SHER tokens to be relased after `_period` ends
  /// @dev `_period` needs to be whitelisted
  function initialStake(
    uint256 _amount,
    uint256 _period,
    address _receiver
  ) external returns (uint256 _id, uint256 _sher);

  /// @notice Burn `_id` and receive `_amount` tokens
  /// @param _id TokenID of the position
  /// @return _amount Amount of tokens released
  /// @dev Only the owner of `_id` will be able to burn their position
  /// @dev The remaining SHER rewards will be released
  /// @dev Can only be called after lockup `_period` has ended
  function burn(uint256 _id) external returns (uint256 _amount);

  /// @notice Keep holding position with ID: `_id` for `_period` seconds
  /// @param _id TokenID of the position
  /// @param _period Period of time, in seconds, to lockup your funds
  /// @return _sher Amount of SHER tokens to be relased after `_period` ends
  /// @dev Only the owner of `_id` will be able to restake their position using this call
  /// @dev `_period` needs to be whitelisted
  /// @dev Can only be called after lockup `_period` has ended
  function hold(uint256 _id, uint256 _period) external returns (uint256 _sher);

  /// @notice Force owner to hold position with ID: `_id` for 3 months
  /// @param _id TokenID of the position
  /// @return _sher Amount of SHER tokens to be relased to owner after 3 months
  /// @return _arbReward Amount of tokens sent to caller
  /// @dev Can only be called after lockup `_period` is more than 2 weeks in the past
  /// @dev Max 10% of tokens in positions are used to incentivize arbs (x)
  /// @dev During a 2 week period the reward ratio will move from 0% to 100% (* x)
  function arbRestake(uint256 _id) external returns (uint256 _sher, uint256 _arbReward);
}
