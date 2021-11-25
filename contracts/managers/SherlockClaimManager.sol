// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

// This contract contains the logic for handling claims
// The idea is that the first level of handling a claim is the Sherlock Protocol Claims Committee (SPCC)(a multisig)
// If a protocol agent doesn't like that result, they can escalate the claim to UMA's Optimistic Oracle (OO), who will be the final decision
// We also build in a multisig (controlled by UMA) to give the final approve to pay out after the OO approves a claim

import './Manager.sol';
import '../interfaces/managers/ISherlockClaimManager.sol';
import '../interfaces/managers/ISherlockProtocolManager.sol';
import '../interfaces/UMAprotocol/SkinnyOptimisticOracleInterface.sol';

import 'hardhat/console.sol';

// @todo everyone can escalate and enact?
// @todo add callback for payout
// @todo reentry guard?

/// @dev expects 6 decimals input tokens
contract SherlockClaimManager is ISherlockClaimManager, Manager {
  using SafeERC20 for IERC20;

  // The bond required for a protocol agent to escalate a claim to UMA Optimistic Oracle (OO)
  uint256 constant BOND = 5000 * 10**6; // 5k bond

  // The UMA Halt Operator (UMAHO) is the multisig (controlled by UMA) who gives final approval to pay out a claim
  // After the OO has voted to pay out
  // This variable represents the amount of time during which UMAHO can block a claim that was approved by the OO
  // After this time period, the claim (which was approved by the OO) is inferred to be approved by UMAHO as well
  uint256 constant UMAHO_TIME = 3 days;

  // The amount of time the Sherlock Protocol Claims Committee (SPCC) gets to decide on a claim
  // If no action is taken by SPCC during this time, then the protocol agent can escalate the decision to the UMA OO
  uint256 constant SPCC_TIME = 7 days;

  // A pre-defined amount of time for the claim to be disputed within the OO
  // Question Does Sherlock actually use this value? Need to understand it better.
  uint256 constant LIVENESS = 7200;

  // This is how UMA will know that Sherlock is requesting a decision from the OO
  // This is "SHERLOCK_CLAIM" in hex value
  // Question Why did we change this to a different value? What is this new value?
  bytes32 public constant override UMA_IDENTIFIER =
    bytes32(0x534845524c4f434b5f434c41494d000000000000000000000000000000000000);

  // The Optimistic Oracle contract that we interact with
  // Question Why do we create the instance a different way now? What is the hex string? Why not pass during constructor anymore?
  SkinnyOptimisticOracleInterface constant UMA =
    SkinnyOptimisticOracleInterface(0xeE3Afe347D5C74317041E2618C49534dAf887c24);

  // USDC
  // Question Why do we create the instance a different way now? What is the hex string? Why not pass during constructor anymore?
  IERC20 constant TOKEN = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

  // The address of the multisig controlled by UMA that can emergency halt a claim that was approved by the OO
  address public override umaHaltOperator;
  // The address of the multisig controlled by Sherlock advisors who make the first judgment on a claim
  address public immutable override sherlockProtocolClaimsCommittee;

  // Takes a protocol's internal ID as a key and whether or not the protocol has a claim active as the value
  // Note Each protocol can only have one claim active at a time (this prevents spam)
  mapping(bytes32 => bool) public protocolClaimActive;

  // A protocol's public claim ID is simply incremented by 1 from the last claim ID made by any protocol (1, 2, 3, etc.)
  // A protocol's internal ID is the keccak256() of a protocol's ancillary data field
  // A protocol's ancillary data field will contain info like the hash of the protocol's coverage agreement (each will be unique)
  // Question Why do we have both of these fields again?
  mapping(uint256 => bytes32) internal publicToInternalID;

  // Opposite of the last field, allows us to move between a protocol's public ID and internal ID
  mapping(bytes32 => uint256) internal internalToPublicID;

  // Protocol's internal ID is the key, active claim is the value
  // Claim object is initialized in startClaim() below
  // See ISherlockClaimManager.sol for Claim struct
  mapping(bytes32 => Claim) internal claims_;

  // The last claim ID we used for a claim (ID is incremented by 1 each time)
  uint256 internal lastClaimID;

  SkinnyOptimisticOracleInterface.Request private umaRequest;

  // Used for callbacks on UMA functions
  // This modifier is used for a function being called by the OO contract, requires this contract as caller
  // Requires the OO contract to pass in the Sherlock identifier
  modifier onlyUMA(bytes32 identifier) {
    if (identifier != UMA_IDENTIFIER) revert InvalidArgument();
    if (msg.sender != address(UMA)) revert InvalidSender();
    _;
  }

  // We pass in the contract addresses (both will be multisigs) in the constructor
  constructor(address _umaho, address _spcc) {
    if (_umaho == address(0)) revert ZeroArgument();
    if (_spcc == address(0)) revert ZeroArgument();

    umaHaltOperator = _umaho;
    sherlockProtocolClaimsCommittee = _spcc;
  }

  // Only the Sherlock Claims Committee multisig can call a function with this modifier
  modifier onlySPCC() {
    if (msg.sender != sherlockProtocolClaimsCommittee) revert InvalidSender();
    _;
  }

  // Only the UMA Halt Operator multisig can call a function with this modifier
  modifier onlyUMAHO() {
    if (msg.sender != umaHaltOperator) revert InvalidSender();
    _;
  }

  // Checks to see if a claim can be escalated to the UMA OO
  // Claim must be 1) Denied by SPCC or 2) Beyond the designated time window for SPCC to respond
  function _isEscalateState(State _oldState, uint256 updated) internal view returns (bool) {
    if (_oldState == State.SpccDenied) return true;
    if (_oldState == State.SpccPending && updated + SPCC_TIME < block.timestamp) return true;
    return false;
  }

  // Checks to see if a claim can be paid out
  // Will be paid out if:
  // 1) SPCC approved it
  // 2) UMA OO approved it and there is no UMAHO anymore
  // 3) UMA OO approved it and the designated window for the UMAHO to block it has passed
  function _isPayoutState(State _oldState, uint256 updated) internal view returns (bool) {
    if (_oldState == State.SpccApproved) return true;

    // If there is no UMA Halt Operator, then it can be paid out on UmaApproved state
    if (umaHaltOperator == address(0)) {
      if (_oldState == State.UmaApproved) return true;
    } else {
      // If there IS a nonzero UMAHO address, must wait for UMAHO halt period to pass
      if (_oldState == State.UmaApproved && updated + UMAHO_TIME < block.timestamp) return true;
    }
    return false;
  }

  // Deletes the data associated with a claim (after claim has reached its final state)
  // _claimIdentifier is the internal claim ID
  function _cleanUpClaim(bytes32 _claimIdentifier) internal {
    // Protocol no longer has an active claim associated with it
    delete protocolClaimActive[claims_[_claimIdentifier].protocol];
    // Claim object is deleted
    delete claims_[_claimIdentifier];

    uint256 publicID = internalToPublicID[_claimIdentifier];
    // Deletes the public and internal ID key mappings
    delete publicToInternalID[publicID];
    delete internalToPublicID[_claimIdentifier];
  }

  // Each claim has a state that represents what part of the claims process it is in
  // _claimIdentifier is the internal claim ID
  // _state represents the state to which a protocol's state field will be changed
  // See ISherlockClaimManager.sol for the State enum
  function _setState(bytes32 _claimIdentifier, State _state) internal returns (State _oldState) {
    // retrieves the Claim object
    Claim storage claim = claims_[_claimIdentifier];
    // retrieves the current state (which we preemptively set to the old state)
    _oldState = claim.state;

    emit ClaimStatusChanged(internalToPublicID[_claimIdentifier], _oldState, _state);

    // If the new state is NonExistent, then we clean up this claim (delete the claim effectively)
    // Else we update the state to the new state and record the last updated timestamp
    if (_state == State.NonExistent) {
      _cleanUpClaim(_claimIdentifier);
    } else {
      claims_[_claimIdentifier].state = _state;
      claims_[_claimIdentifier].updated = block.timestamp;
    }
  }

  // Allows us to remove the UMA Halt Operator multisig address if we decide we no longer need UMAHO's services
  function renounceUmaHaltOperator() external override onlyOwner {
    if (umaHaltOperator == address(0)) revert InvalidConditions();

    delete umaHaltOperator;
    emit UMAHORenounced();
  }

  // Returns the Claim struct for a given claim ID (function takes public ID but converts to internal ID)
  function claims(uint256 _claimID) external view override returns (Claim memory claim_) {
    bytes32 id_ = publicToInternalID[_claimID];
    if (id_ == bytes32(0)) revert InvalidArgument();

    claim_ = claims_[id_];
    if (claim_.state == State.NonExistent) revert InvalidArgument();
  }

  /// @notice Initiate a claim for a specific protocol as the protocol agent
  /// @param _protocol protocol ID (different from the internal or public claim ID fields)
  /// @param _amount amount of USDC which is being claimed by the protocol
  /// @param _receiver address to receive the amount of USDC being claimed
  /// @param _timestamp timestamp at which the exploit first occurred
  /// @param ancillaryData other data associated with the claim, such as the coverage agreement
  function startClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver,
    uint32 _timestamp,
    bytes memory ancillaryData
  ) external override {
    if (_protocol == bytes32(0)) revert ZeroArgument();
    if (_amount == uint256(0)) revert ZeroArgument();
    if (_receiver == address(0)) revert ZeroArgument();
    if (_timestamp == uint32(0)) revert ZeroArgument();
    if (_timestamp >= block.timestamp) revert InvalidArgument();
    if (ancillaryData.length == 0) revert ZeroArgument();
    if (address(sherlockCore) == address(0)) revert InvalidConditions();
    if (protocolClaimActive[_protocol]) revert ClaimActive();

    // Creates the internal ID for this claim
    bytes32 claimIdentifier = keccak256(ancillaryData);
    // State for this newly created claim must be equal to the default state (NonExistent)
    if (claims_[claimIdentifier].state != State.NonExistent) revert InvalidArgument();
    // Protocol must not already have another claim active
    require(!protocolClaimActive[_protocol]);

    // Gets the instance of the protocol manager contract
    ISherlockProtocolManager protocolManager = sherlockCore.sherlockProtocolManager();
    // Gets the protocol agent associated with the protocol ID passed in
    address agent = protocolManager.protocolAgent(_protocol);
    // Caller of this function must be the protocol agent address associated with the protocol ID passed in
    if (msg.sender != agent) revert InvalidSender();

    // Gets the current and previous coverage amount for this protocol
    (uint256 current, uint256 previous) = protocolManager.coverageAmounts(_protocol);
    // The max amount a protocol can claim is the higher of the current and previous coverage amounts
    uint256 maxClaim = current > previous ? current : previous;
    // True if a protocol is claiming based on its previous coverage amount (only used in event emission)
    bool prevCoverage = _amount > current;
    // Requires the amount claimed is less than or equal to the higher of the current and previous coverage amounts
    if (_amount > maxClaim) revert InvalidArgument();

    // Increments the last claim ID by 1 to get the public claim ID
    // Note ++variable is the same as variable++ but more gas efficient
    uint256 claimID = ++lastClaimID;
    // Protocol now has an active claim
    protocolClaimActive[_protocol] = true;
    // Sets the mappings for public and internal claim IDs
    publicToInternalID[claimID] = claimIdentifier;
    internalToPublicID[claimIdentifier] = claimID;

    // Initializes a Claim object and adds it to claims_ mapping
    // Created and updated fields are set to current time
    // State is updated to SpccPending (waiting on SPCC decision now)
    claims_[claimIdentifier] = Claim(
      block.timestamp,
      block.timestamp,
      msg.sender,
      _protocol,
      _amount,
      _receiver,
      _timestamp,
      ancillaryData,
      State.SpccPending
    );

    emit ClaimCreated(claimID, _protocol, _amount, _receiver, prevCoverage);
    emit ClaimStatusChanged(claimID, State.NonExistent, State.SpccPending);
  }

  // Only SPCC can call this
  // SPCC approves the claim and it can now be paid out
  // Requires that the last state of the claim was SpccPending
  function spccApprove(uint256 _claimID) external override onlySPCC {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    if (_setState(claimIdentifier, State.SpccApproved) != State.SpccPending) revert InvalidState();
  }

  // Only SPCC can call this
  // SPCC denies the claim and now the protocol agent can escalate to UMA OO if they desire
  function spccRefuse(uint256 _claimID) external override onlySPCC {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    if (_setState(claimIdentifier, State.SpccDenied) != State.SpccPending) revert InvalidState();
  }

  // If SPCC denied (or didn't respond to) the claim, a protocol agent can now escalate it to UMA's OO
  /// @notice Callable by protocol agent
  /// @param _claimID Public claim ID
  /// @param _amount Bond amount sent by protocol agent
  /// @dev Use hardcoded USDC address
  /// @dev Use hardcoded bond amount (upgradable with a large timelock)
  /// @dev Use hardcoded liveness 7200
  /// @dev Proposer = current protocl agent (could differ from protocol agent when claim was started)
  /// @dev proposedPrice = _amount
  function escalate(uint256 _claimID, uint256 _amount) external override {
    // Amount sent needs to be at least equal to the BOND amount required
    if (_amount < BOND) revert InvalidArgument();

    // Gets the internal ID of the claim
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    // Retrieves the claim struct
    Claim storage claim = claims_[claimIdentifier];
    // Requires the caller to be the protocol agent
    if (msg.sender != claim.initiator) revert InvalidSender();

    // Timestamp when claim was last updated
    uint256 updated = claim.updated;
    // Sets the state to UmaPriceProposed
    State _oldState = _setState(claimIdentifier, State.UmaPriceProposed);

    // Can this claim be updated (based on its current state)? If no, revert
    if (_isEscalateState(_oldState, updated) == false) revert InvalidState();

    // Transfers the bond amount from the protocol agent to this address
    TOKEN.safeTransferFrom(msg.sender, address(this), _amount);
    // Approves the OO contract to spend the bond amount
    TOKEN.safeApprove(address(UMA), _amount);

    // Sherlock protocol proposes a claim amount of $0 to the UMA OO to begin with
    // This line https://github.com/UMAprotocol/protocol/blob/master/packages/core/contracts/oracle/implementation/SkinnyOptimisticOracle.sol#L585
    // Will result in disputeSuccess=true if the DVM resolved price != 0
    // Note: The resolved price needs to exactly match the claim amount
    // Otherwise the `umaApproved` in our settled callback will be false
    UMA.requestAndProposePriceFor(
      UMA_IDENTIFIER, // Sherlock ID so UMA knows the request came from Sherlock
      claim.timestamp, // Timestamp to identify the request
      claim.ancillaryData, // Ancillary data such as the coverage agreement
      TOKEN, // USDC
      0, // Reward is 0, Sherlock handles rewards on its own
      BOND, // Cost of making a request to the UMA OO (as decided by Sherlock)
      LIVENESS, // Proposal liveness
      address(sherlockCore), // Sherlock core address
      0 // price
    );

    // If the state is not equal to ReadyToProposeUmaDispute, revert
    // Then set the new state to UmaDisputeProposed
    // Note State gets set to ReadyToProposeUmaDispute in the callback function from requestAndProposePriceFor()
    if (_setState(claimIdentifier, State.UmaDisputeProposed) != State.ReadyToProposeUmaDispute) {
      revert InvalidState();
    }

    // The protocol agent is now disputing Sherlock's proposed claim amount of $0
    UMA.disputePriceFor(
      UMA_IDENTIFIER, // Sherlock ID so UMA knows the request came from Sherlock
      claim.timestamp, // Timestamp to identify the request
      claim.ancillaryData, // Ancillary data such as the coverage agreement
      umaRequest, // Refers to the original request made by Sherlock in requestAndProposePriceFor()
      msg.sender, // Protocol agent, known as the disputer (the one who is disputing Sherlock's $0 proposed claim amount)
      address(this) // This contract's address is the requester (Sherlock made the original request and proposed $0 claim amount)
    );

    // State gets updated to UmaPending in the disputePriceFor() callback (priceDisputed())
    if (claim.state != State.UmaPending) revert InvalidState();

    // Deletes the original request made by Sherlock
    delete umaRequest;
    // Approves the OO to spend $0
    // Question Why do we do this?
    TOKEN.safeApprove(address(UMA), 0);
    // Checks for remaining balance in the contract
    uint256 remaining = TOKEN.balanceOf(address(this));
    // Sends remaining balance to the protocol agent
    // Question This seems like a messier flow than before, are we really going to spend gas to send 1 cent back to the protocol agent?
    if (remaining != 0) TOKEN.safeTransfer(msg.sender, remaining);
  }

  // Checks to make sure a payout is valid, then calls the core Sherlock payout function
  /// @notice Execute claim, storage will be removed after
  /// @param _claimID Public ID of the claim
  /// @dev Needs to be SpccApproved or UmaApproved && >UMAHO_TIME
  /// @dev Funds will be pulled from core
  // Question Should we allow UMAHO to make a positive payout call? So we can speed up the claim being paid out?
  function payoutClaim(uint256 _claimID) external override {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    Claim storage claim = claims_[claimIdentifier];
    // Only the claim initiator can call this, and payout gets sent to receiver address
    // Question In this case why do we even store receiver address? Could just be a param for this function?
    if (msg.sender != claim.initiator) revert InvalidSender();

    // Address to receive the payout
    address receiver = claim.receiver;
    // Amount (in USDC) to be paid out
    uint256 amount = claim.amount;
    // Time when claim was last updated
    uint256 updated = claim.updated;

    // Sets new state to NonExistent as the claim is over once it is paid out
    State _oldState = _setState(claimIdentifier, State.NonExistent);
    // Checks to make sure this claim can be paid out
    if (_isPayoutState(_oldState, updated) == false) revert InvalidState();

    emit ClaimPayout(_claimID, receiver, amount);

    // Transfers the actual tokens to the receiver
    sherlockCore.payoutClaim(receiver, amount);
  }

  /// @notice UMAHO is able to execute a halt if the state is UmaApproved and state was updated less than UMAHO_TIME ago
  // Once the UMAHO_TIME is up, UMAHO can still halt the claim, but only if the claim hasn't been paid out yet
  function executeHalt(uint256 _claimID) external override onlyUMAHO {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    // Sets state of claim to nonexistent, reverts if the old state was anything but UmaApproved
    if (_setState(claimIdentifier, State.NonExistent) != State.UmaApproved) revert InvalidState();

    emit ClaimHalted(_claimID);
  }

  //
  // UMA callbacks
  //

  // Once requestAndProposePriceFor() is executed in UMA's contracts, this function gets called
  // We change the claim's state from UmaPriceProposed to UmaDisputeProposed
  // Then we call the next function in the process, disputePriceFor()
  function priceProposed(
    bytes32 identifier,
    uint32 timestamp,
    bytes memory ancillaryData,
    SkinnyOptimisticOracleInterface.Request memory request
  ) external override onlyUMA(identifier) {
    bytes32 claimIdentifier = keccak256(ancillaryData);

    Claim storage claim = claims_[claimIdentifier];
    if (claim.updated != block.timestamp) revert InvalidConditions();

    // Sets state to ReadyToProposeUmaDispute
    if (_setState(claimIdentifier, State.ReadyToProposeUmaDispute) != State.UmaPriceProposed) {
      revert InvalidState();
    }
    // Sets global umaRequest variable to the request coming from this price proposal
    umaRequest = request;
  }

  // Once disputePriceFor() is executed in UMA's contracts, this function gets called
  // We change the claim's state from UmaDisputeProposed to UmaPending
  // Then we call the next function in the process, priceSettled()
  function priceDisputed(
    bytes32 identifier,
    uint32 timestamp,
    bytes memory ancillaryData,
    SkinnyOptimisticOracleInterface.Request memory request
  ) external override onlyUMA(identifier) {
    bytes32 claimIdentifier = keccak256(ancillaryData);

    Claim storage claim = claims_[claimIdentifier];
    if (claim.updated != block.timestamp) revert InvalidConditions();

    // Sets state to UmaPending
    if (_setState(claimIdentifier, State.UmaPending) != State.UmaDisputeProposed) {
      revert InvalidState();
    }
  }

  // Once priceDisputed() is executed in UMA's contracts, this function gets called
  // UMA OO gives back a resolved price (either 0 or claim.amount) and
  // Claim's state is changed to either UmaApproved or UmaDenied
  // If UmaDenied, the claim is dead and state is immediately changed to NonExistent and cleaned up
  function priceSettled(
    bytes32 identifier,
    uint32 timestamp,
    bytes memory ancillaryData,
    SkinnyOptimisticOracleInterface.Request memory request
  ) external override onlyUMA(identifier) {
    bytes32 claimIdentifier = keccak256(ancillaryData);

    Claim storage claim = claims_[claimIdentifier];

    // Retrives the resolved price for this claim (either 0 if Sherlock wins, or the amount of the claim as proposed by the protocol agent)
    uint256 resolvedPrice = uint256(request.resolvedPrice);
    // UMA approved the claim if the resolved price is equal to the claim amount set by the protocol agent
    bool umaApproved = resolvedPrice == claim.amount;

    // If UMA approves the claim, set state to UmaApproved
    // If UMA denies, set state to UmaDenied, then to NonExistent (deletes the claim data)
    // Question For UMAHO executeHalt(), we go straight to NonExistent state, here we do UmaDenied first, why?
    if (umaApproved) {
      if (_setState(claimIdentifier, State.UmaApproved) != State.UmaPending) revert InvalidState();
    } else {
      if (_setState(claimIdentifier, State.UmaDenied) != State.UmaPending) revert InvalidState();
      if (_setState(claimIdentifier, State.NonExistent) != State.UmaDenied) revert InvalidState();
    }
  }
}
