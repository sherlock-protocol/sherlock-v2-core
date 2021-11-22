// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../UMAprotocol/OptimisticRequester.sol';
import './IManager.sol';

interface ISherlockClaimManager is IManager, OptimisticRequester {
  error ClaimActive();

  error InvalidSender();

  error InvalidState();

  event ClaimCreated(
    uint256 claimID,
    bytes32 protocol,
    uint256 amount,
    address receiver,
    bool previousCoverageAmount
  );

  event ClaimStatusChanged(uint256 claimID, State previousState, State currentState);

  event ClaimPayout(uint256 claimID, address receiver, uint256 amount);

  event ClaimHalted(uint256 claimID);

  event UMAHORenounced();

  enum State {
    NonExistent, // Claim doesn't exist (this is the default state on creation)
    SpccPending, // Claim is created, SPCC is able to set state to valid
    SpccApproved, // Final state, claim is valid
    SpccDenied, // Claim denied by SPCC, claim can be escalated within 7 days
    UmaPriceProposed, // Price is proposed by not escalated
    ReadyToProposeUmaDispute, // Price is proposed, callback receiver, ready to submit dispute
    UmaDisputeProposed, // Escaltion is done, waiting for confirmation
    UmaPending, // Claim is escalated, in case Spcc denied or didn't act within 7 days.
    UmaApproved, // Final state, claim is valid, claim can be enacted after 3 day, umaHaltOperator has 3 day to change to denied
    UmaDenied // Final state, claim is invalid
  }

  struct Claim {
    uint256 created;
    uint256 updated;
    address initiator;
    bytes32 protocol;
    uint256 amount;
    address receiver;
    uint32 timestamp;
    bytes ancillaryData;
    State state;
  }

  // requestAndProposePriceFor() --> proposer = protocolAgent
  // disputePriceFor() --> disputor = sherlock.strategyManager() (current active one)
  // priceSettled will be the the callback that contains the main data

  // user has to pay 7.5k to dispute a claim, we will execute a safeTransferFrom(user, address(this), 7.5k)
  // we need to approve the contract 7.5k as it will be transferred from address(this)  // + 2x final fee
  // the bond will be 5k on requestAndProposePriceFor()                                 // + 1x final fee
  // the bond will be 2.5k on disputePriceFor()                                         // + 1x final fee
  // on settle eiter strategy gets 7.5k. or the proposer get their bond back.           // + 1x final fee

  // lastClaimID <-- starts with 0, so initial id = 1
  // have claim counter, easy to identify certain clams by their number
  // but use hash(callback.request.propose + callback.timestamp) as the internal UUID to handle the callbacks

  // So SPCC and UHO are hardcoded (UHO can be renounced)
  // In case these need to be updated, deploy different contract and upgrade it on the sherlock gov side.

  // On price proposed callback --> call disputePriceFor with callbackdata + sherlock.strategyManager() and address(this)

  /// @notice `SHERLOCK_CLAIM` in utf8
  function UMA_IDENTIFIER() external view returns (bytes32);

  function sherlockProtocolClaimsCommittee() external view returns (address);

  /// @notice operator is able to deny approved UMA claims
  function umaHaltOperator() external view returns (address);

  /// @notice gov is able to renounce the role
  function renounceUmaHaltOperator() external;

  function claims(uint256 _claimID) external view returns (Claim memory);

  /// @notice callable by protocol agent
  function startClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver,
    uint32 _timestamp,
    bytes memory ancillaryData
  ) external;

  function spccApprove(uint256 _claimID) external;

  function spccRefuse(uint256 _claimID) external;

  /// @notice callable by protocol agent
  /// @dev use hardcoded USDC address
  /// @dev use hardcoded bond amount (upgradable by big timelock boi)
  /// @dev use hardcoded liveness 7200
  /// @dev proposer = current protocl agent (could differ from protocol agent when claim was started)
  /// @dev proposedPrice = _amount
  /// @param _amount maximum amount to use to escaltion, remaining will be send back
  function escalate(uint256 _claimID, uint256 _amount) external;

  /// @notice execute claim, storage will be removed after
  /// @dev needs to be SpccApproved or UmaApproved && >1 day
  /// @dev funds will be pulled from core
  function payoutClaim(uint256 _claimID) external;

  /// @notice uho is able to execute a halt if the state is UmaApproved + less then 1 day changed
  function executeHalt(uint256 _claimID) external;
}
