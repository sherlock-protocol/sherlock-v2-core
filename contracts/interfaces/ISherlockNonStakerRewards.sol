// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

/// @title Sherlock interface for non staker rewards
/// @author Evert Kors
interface ISherlockNonStakerRewards {
  /// @notice View how much the non stakers can claim for this protocol
  /// @param _protocol Protocol identifier
  /// @return Amount of token claimable by non stakers
  /// @dev this read from a storage variable + (now-lastsettled) * premiums
  function nonStakersClaimable(bytes32 _protocol) external view returns (uint256);

  /// @notice Send `_amount` tokens to `_receiver` that non staker can claim from `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens
  /// @param _receiver Address to receive tokens
  /// @dev Only callable by non stakers role
  function nonStakersClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver
  ) external;
}
