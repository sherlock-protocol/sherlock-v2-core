// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

/// @title Sherlock core interface for stakers
/// @author Evert Kors
interface ISherlockProtocols {
  // We do some internal accounting with (lastBlockAccounted - block.now) * premium
  // we have mapping(protocol => uint256) for lastSettled but also a global one
  // TODO add totalPremiumPerBlock view function which will just read a variable

  event ProtocolAdded(bytes32 protocol);

  event ProtocolUpdated(bytes32 protocol, bytes32 coverage, uint256 nonStakers);

  event ClaimStarterTransfer(bytes32 protocol, address from, address to);

  /// @notice View current claimstarter of `_protocol`
  /// @param _protocol Protocol identifier
  /// @return Address able to submit claims
  function claimStarters(bytes32 _protocol) external view returns (address);

  // @TODO, add or remove?
  //   /// @notice View current non staker share of `_protocol` premium
  //   /// @param _protocol Protocol identifier
  //   /// @return Percentage of premiums redirected to non-stakers
  //   /// @dev Scaled by 10**18
  //   function nonStakersShares(bytes32 _protocol) external view returns (uint256);

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

  /// @notice View current premium of protocol
  /// @param _protocol Protocol identifier
  /// @return Amount of premium `_protocol` pays per second
  function premiums(bytes32 _protocol) external view returns (uint256);

  /// @notice View current active balance of protocol
  /// @param _protocol Protocol identifier
  /// @return Active balance
  /// @dev Accrued debt is subtracted from the stored balance
  function balances(bytes32 _protocol) external view returns (uint256);

  /// @notice Add a new protocol to Sherlock
  /// @param _protocol Protocol identifier
  /// @param _claimStarter Account able to submit a claim on behalve of the protocol
  /// @param _coverage Hash referencing the active coverage agreement
  /// @param _nonStakers Percentage of premium payments that is not redirected to stakers
  /// @dev Adding a protocol allows the `_claimStarter` to submit a claim.
  /// @dev Coverage is not started yet as the protocol doesn't pay a premium at this point
  /// @dev `_nonStakers` is scaled by 10**18
  /// @dev Only callable by governance
  function protocolAdd(
    bytes32 _protocol,
    address _claimStarter,
    bytes32 _coverage,
    uint256 _nonStakers
  ) external;

  /// @notice Update info regarding a protocol
  /// @param _protocol Protocol identifier
  /// @param _coverage Hash referencing the active coverage agreement
  /// @param _nonStakers Percentage of premium payments that is not redirected to stakers, scaled by 10**18
  /// @dev Only callable by governance
  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers
  ) external;

  /// @notice Remove a protocol
  /// @param _protocol Protocol identifier
  /// @dev Before removing a protocol the premium should be 0
  /// @dev Removing a protocol basically stops the `_claimStarter` from submitting claims
  /// @dev This call should be subject to a timelock
  /// @dev Only callable by governance
  function protocolRemove(bytes32 _protocol) external;

  /// @notice Set premium of `_protocol` to `_premium`
  /// @param _protocol Protocol identifier
  /// @param _premium Amount of premium `_protocol` pays per second
  /// @dev The value 0 would mean inactive coverage
  /// @dev Only callable by governance
  function setProtocolPremium(bytes32 _protocol, uint256 _premium) external;

  /// @notice Set premium of multiple protocols
  /// @param _protocol Protocol identifier
  /// @param _premium Amount of premium `_protocol` pays per second
  /// @dev The value 0 would mean inactive coverage
  /// @dev Only callable by governance
  function setProtocolPremium(bytes32[] calldata _protocol, uint256[] calldata _premium) external;

  /// @notice Deposit `_amount` token for pay premium for `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens to deposit
  /// @dev Approval should be made before calling
  function depositProtocolBalance(bytes32 _protocol, uint256 _amount) external;

  /// @notice Withdraw `_amount` token that would pay premium for `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens to withdraw
  /// @dev Only claim starter role is able to withdraw balance
  /// @dev Balance can be withdraw up until 3 days of coverage outstanding
  /// @dev In case coverage is not active (0 premium), full balance can be withdrawn
  function withdrawProtocolBalance(bytes32 _protocol, uint256 _amount) external;

  /// @notice Transfer claimStarer role
  /// @param _protocol Protocol identifier
  /// @param _claimStarter Account able to submit a claim on behalve of the protocol
  /// @dev Only the active claimStarter is able to transfer the role
  function transferClaimStarter(bytes32 _protocol, address _claimStarter) external;
}
