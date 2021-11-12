// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './IManager.sol';

/// @title Sherlock core interface for protocols
/// @author Evert Kors
interface ISherlockProtocolManager is IManager {
  // We do some internal accounting with (lastBlockAccounted - block.now) * premium
  // we have mapping(protocol => uint256) for lastSettled but also a global one

  error Unauthorized();

  error ProtocolNotExists(bytes32 protocol);

  error InvalidConditions();

  error ZeroArgument();

  error InvalidArgument();

  error UnequalArrayLength();

  error InsufficientBalance(bytes32 protocol);

  event ProtocolAdded(bytes32 protocol);

  event ProtocolRemovedByArb(bytes32 protocol, address arb, uint256 profit);

  event ProtocolRemoved(bytes32 protocol);

  event ProtocolUpdated(
    bytes32 protocol,
    bytes32 coverage,
    uint256 nonStakers,
    uint256 _coverageAmount
  );

  event ProtocolAgentTransfer(bytes32 protocol, address from, address to);

  event ProtocolBalanceDeposited(bytes32 protocol, uint256 amount);

  event ProtocolBalanceWithdrawn(bytes32 protocol, uint256 amount);

  event ProtocolPremiumChanged(bytes32 protocol, uint256 oldPremium, uint256 newPremium);

  /// @notice View current chunk of premium that are claimable
  /// @return Premiums claimable
  /// @dev will increase every block
  /// @dev base + (now - last_settled) * pb
  function claimablePremiums() external view returns (uint256);

  /// @notice Transfer current claimable premiums to core address
  /// @dev callable by everyone
  /// @dev will be called on burn() from sherlock
  /// @dev funds will be transferred to sherlock core
  function claimPremiums() external;

  /// @notice View current protocolAgent of `_protocol`
  /// @param _protocol Protocol identifier
  /// @return Address able to submit claims
  function protocolAgent(bytes32 _protocol) external view returns (address);

  /// @notice View current premium of protocol
  /// @param _protocol Protocol identifier
  /// @return Amount of premium `_protocol` pays per second
  function premiums(bytes32 _protocol) external view returns (uint256);

  /// @notice View current active balance of protocol
  /// @param _protocol Protocol identifier
  /// @return Active balance
  /// @dev Accrued debt is subtracted from the stored balance
  function balances(bytes32 _protocol) external view returns (uint256);

  /// @notice View seconds of coverage left of `_protocol`
  /// @param _protocol Protocol identifier
  /// @return Seconds of coverage left
  function secondsOfCoverageLeft(bytes32 _protocol) external view returns (uint256);

  /// @notice Add a new protocol to Sherlock
  /// @param _protocol Protocol identifier
  /// @param _protocolAgent Account able to submit a claim on behalve of the protocol
  /// @param _coverage Hash referencing the active coverage agreement
  /// @param _nonStakers Percentage of premium payments that is not redirected to stakers
  /// @param _coverageAmount Max amount claimable
  /// @dev Adding a protocol allows the `_protocolAgent` to submit a claim.
  /// @dev Coverage is not started yet as the protocol doesn't pay a premium at this point
  /// @dev `_nonStakers` is scaled by 10**18
  /// @dev Only callable by governance
  function protocolAdd(
    bytes32 _protocol,
    address _protocolAgent,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external;

  /// @notice Update info regarding a protocol
  /// @param _protocol Protocol identifier
  /// @param _coverage Hash referencing the active coverage agreement
  /// @param _nonStakers Percentage of premium payments that is not redirected to stakers, scaled by 10**18
  /// @param _coverageAmount Max amount claimable
  /// @dev Only callable by governance
  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external;

  /// @notice Remove a protocol
  /// @param _protocol Protocol identifier
  /// @dev Before removing a protocol the premium should be 0
  /// @dev Removing a protocol basically stops the `_protocolAgent` from being active
  /// @dev Pays off debt + sends remaining balance to protocol agent
  /// @dev This call should be subject to a timelock
  /// @dev Only callable by governance
  function protocolRemove(bytes32 _protocol) external;

  /// @notice Remove a protocol with insufificient balance
  /// @param _protocol Protocol identifier
  function forceRemoveByBalance(bytes32 _protocol) external;

  /// @notice Remove a protocol with insufificient coverage time
  /// @param _protocol Protocol identifier
  function forceRemoveByRemainingCoverage(bytes32 _protocol) external;

  /// @notice View minimal balance needed before liquidation can start
  /// @return Minimal balance needed
  function minBalance() external view returns (uint256);

  /// @notice View minimal seconds of coverage needed before liquidation can start
  /// @return Minimal seconds of coverage needed
  function minSecondsOfCoverage() external view returns (uint256);

  /// @notice Set minimal balance needed before liquidation can start
  /// @param _minBalance Mininal balance needed
  /// @dev only gov
  function setMinBalance(uint256 _minBalance) external;

  /// @notice Set minimal seconds of coverage needed before liquidation can start
  /// @param _minSeconds Mininal seconds of coverage needed
  /// @dev only gov
  function setMinSecondsOfCoverage(uint256 _minSeconds) external;

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
  function setProtocolPremiums(bytes32[] calldata _protocol, uint256[] calldata _premium) external;

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
  /// @param _protocolAgent Account able to submit a claim on behalve of the protocol
  /// @dev Only the active protocolAgent is able to transfer the role
  function transferProtocolAgent(bytes32 _protocol, address _protocolAgent) external;

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

  function coverageAmounts(bytes32 _protocol)
    external
    view
    returns (uint256 current, uint256 previous);
}
