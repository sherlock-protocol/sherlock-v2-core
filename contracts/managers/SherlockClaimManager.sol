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

// @todo everyone can escalate and enact?

/// @dev expects 6 decimals input tokens
contract SherlockClaimManager is ISherlockClaimManager, Manager {
  using SafeERC20 for IERC20;

  // The bond required by the UMA Optimistic Oracle
  // Question How to explain this vs. BOND_USER?
  uint256 constant BOND = 5 * 10**6;

  // The bond required for a protocol agent to escalate a claim to UMA
  uint256 constant BOND_USER = (BOND * 3) / 2 + 1;

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
  bytes32 public constant override umaIdentifier = '0x534845524c4f434b5f434c41494d';

  // The Optimistic Oracle contract that we interact with
  SkinnyOptimisticOracleInterface immutable uma;

  // USDC
  IERC20 immutable token;

  // The address of the multisig controlled by UMA that can emergency halt a claim that was approved by the OO
  address public override umaHaltOperator;

  // The address of the multisig controlled by Sherlock advisors who make the first judgment on a claim
  address public override sherlockProtocolClaimsCommittee;

  // Takes a protocol's internal ID as a key and whether or not the protocol has a claim active as the value
  // Note Each protocol can only have one claim active at a time (this prevents spam)
  mapping(bytes32 => bool) protocolClaimActive;

  // A protocol's public claim ID is simply incremented by 1 from the last claim ID made by any protocol (1, 2, 3, etc.)
  // A protocol's internal ID is the keccak256() of a protocol's ancillary data field
  // A protocol's ancillary data field will contain info like the hash of the protocol's coverage agreement (each will be unique)
  // Question Why do we have both of these fields again?
  mapping(uint256 => bytes32) publicToInternalID;

  // Opposite of the last field, allows us to move between a protocol's public ID and internal ID
  mapping(bytes32 => uint256) internalToPublicID;

  // Protocol's internal ID is the key, active claim is the value
  // Claim object is initialized in startClaim() below
  // See ISherlockClaimManager.sol for Claim struct
  mapping(bytes32 => Claim) claims_;

  // The last claim ID we used for a claim (ID is incremented by 1 each time)
  uint256 internal lastClaimID;

  // Used for callbacks on UMA functions
  // This modifier is used for a function being called by the OO contract, requires this contract as caller
  // Requires the OO contract to pass in the Sherlock identifier
  modifier onlyUMA(bytes32 identifier) {
    require(umaIdentifier == identifier);
    require(msg.sender == address(uma));
    _;
  }

  // Only the Sherlock Claims Committee multisig can call a function with this modifier
  modifier onlySPCC() {
    require(msg.sender == sherlockProtocolClaimsCommittee);
    _;
  }

  // Only the UMA Halt Operator multisig can call a function with this modifier
  modifier onlyUMAHO() {
    require(msg.sender == umaHaltOperator);
    _;
  }

  // Constructor intializes OO contract and USDC contract
  constructor(SkinnyOptimisticOracleInterface _uma, IERC20 _token) {
    uma = _uma;
    token = _token;
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
    delete umaHaltOperator;
    emit UMAHORenounced();
  }

  // Returns the Claim struct for a given claim ID (function takes public ID but converts to internal ID)
  function claims(uint256 _claimID) external view override returns (Claim memory) {
    return claims_[publicToInternalID[_claimID]];
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
    // Protocol must not already have another claim active
    require(!protocolClaimActive[_protocol]);

    // Gets the instance of the protocol manager contract
    ISherlockProtocolManager protocolManager = sherlockCore.sherlockProtocolManager();
    // Gets the protocol agent associated with the protocol ID passed in 
    address agent = protocolManager.protocolAgent(_protocol);
    // Caller of this function must be the protocol agent address associated with the protocol ID passed in
    require(msg.sender == agent);

    // Gets the current and previous coverage amount for this protocol
    (uint256 current, uint256 previous) = protocolManager.coverageAmounts(_protocol);
    // The max amount a protocol can claim is the higher of the current and previous coverage amounts
    uint256 maxClaim = current > previous ? current : previous;
    // True if a protocol is claiming based on its previous coverage amount (only used in event emission) 
    bool prevCoverage = _amount > current;
    // Requires the amount claimed is less than or equal to the higher of the current and previous coverage amounts
    require(_amount <= maxClaim);

    // Creates the internal ID for this claim
    bytes32 claimIdentifier = keccak256(ancillaryData);
    // State for this newly created claim must be equal to the default state (NonExistent)
    require(claims_[claimIdentifier].state == State.NonExistent);

    // Increments the last claim ID by 1 to get the public claim ID
    uint256 claimID = lastClaimID++;
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
    require(_setState(claimIdentifier, State.SpccApproved) == State.SpccPending);
  }

  // Only SPCC can call this
  // SPCC denies the claim and now the protocol agent can escalate to UMA OO if they desire
  function spccRefuse(uint256 _claimID) external override onlySPCC {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    require(_setState(claimIdentifier, State.SpccDenied) == State.SpccPending);
  }

  // If SPCC denied (or didn't respond to) the claim, a protocol agent can now escalate it to UMA's OO
  /// @notice Callable by protocol agent
  /// @param _claimID Public claim ID 
  /// @dev Use hardcoded USDC address
  /// @dev Use hardcoded bond amount (upgradable by a large timelock)
  /// @dev Use hardcoded liveness 7200
  /// @dev Proposer = current protocl agent (could differ from protocol agent when claim was started)
  /// @dev proposedPrice = _amount
  function escalate(uint256 _claimID) external override {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    Claim storage claim = claims_[claimIdentifier];

    ISherlockProtocolManager protocolManager = sherlockCore.sherlockProtocolManager();
    address agent = protocolManager.protocolAgent(claim.protocol);
    // Requires the caller to be the protocol agent
    require(msg.sender == agent);

    // Transfers the bond amount from the protocol agent to this address
    token.safeTransferFrom(msg.sender, address(this), BOND_USER);
    // Approves the OO contract to spend the bond amount
    token.safeApprove(address(uma), BOND_USER);

    // Timestamp when claim was last updated
    uint256 updated = claim.updated;
    // Sets the state to UmaPriceProposed
    State _oldState = _setState(claimIdentifier, State.UmaPriceProposed);
    // Requires that the old state is either SpccDenied or the SPCC didn't respond within the time window
    // Question If SPCC denies, a protocol can still escalate a year later?
    require(
      _oldState == State.SpccDenied ||
        (_oldState == State.SpccPending && updated + SPCC_TIME >= block.timestamp)
    );

    // Initial call to UMA OO 
    uma.requestAndProposePriceFor(
      umaIdentifier, // Sherlock ID so UMA knows the request came from Sherlock
      claim.timestamp, // Timestamp to identify the request
      claim.ancillaryData, // ancillary data such as the coverage agreement
      token, // USDC
      0, // Reward is 0, Sherlock handles rewards on its own
      BOND, // Cost of making a request to the UMA OO (as decided by Sherlock)
      LIVENESS, // Proposal liveness
      agent, // proposer is the protocol agent
      int256(claim.amount) // "price" in this case is the claim amount being requested
    );
  }

  // Checks to make sure a payout is valid, then calls the core Sherlock payout function
  /// @notice Execute claim, storage will be removed after
  /// @param _claimID Public ID of the claim
  /// @dev Needs to be SpccApproved or UmaApproved && >UMAHO_TIME
  /// @dev Funds will be pulled from core
  // Question Should we allow UMAHO to make a positive payout call? So we can speed up the claim being paid out?
  function payoutClaim(uint256 _claimID) external override {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    Claim storage claim = claims_[claimIdentifier];
    // Address to receive the payout
    address receiver = claim.receiver;
    // Amount (in USDC) to be paid out
    uint256 amount = claim.amount;
    // Time when claim was last updated
    uint256 updated = claim.updated;

    // Sets new state to NonExistent as the claim is over once it is paid out
    State _oldState = _setState(claimIdentifier, State.NonExistent);

    // If no UMAHO, then the state can be SpccApproved or UmaApproved for a payout
    // If UMAHO exists, then the UmaApproved case needs to wait until the "halt period" is over for UMAHO
    if (umaHaltOperator == address(0)) {
      require(_oldState == State.SpccApproved || _oldState == State.UmaApproved);
    } else {
      require(
        _oldState == State.SpccApproved ||
          (_oldState == State.UmaApproved && updated + UMAHO_TIME <= block.timestamp)
      );
    }

    emit ClaimPayout(_claimID);

    // Transfers the actual tokens to the receiver
    sherlockCore.payoutClaim(receiver, amount);
  }

  /// @notice UMAHO is able to execute a halt if the state is UmaApproved and state was updated less than UMAHO_TIME ago
  // Once the UMAHO_TIME is up, UMAHO can still halt the claim, but only if the claim hasn't been paid out yet
  function executeHalt(uint256 _claimID) external override onlyUMAHO {
    bytes32 claimIdentifier = publicToInternalID[_claimID];

    // Sets state to UmaDenied, then sets state to NonExistent
    // Question Why don't we just set state immediately to NonExistent?
    require(_setState(claimIdentifier, State.UmaDenied) == State.UmaApproved);
    require(_setState(claimIdentifier, State.NonExistent) == State.UmaDenied);

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
    require(claim.updated == block.timestamp);

    require(_setState(claimIdentifier, State.UmaDisputeProposed) == State.UmaPriceProposed);

    uma.disputePriceFor(
      umaIdentifier,
      claim.timestamp,
      claim.ancillaryData,
      request,
      address(sherlockCore),
      address(this)
    );
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
    require(claim.updated == block.timestamp);

    require(_setState(claimIdentifier, State.UmaPending) == State.UmaDisputeProposed);
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

    uint256 resolvedPrice = uint256(request.resolvedPrice);
    bool umaApproved = resolvedPrice == claim.amount;
    if (umaApproved) {
      require(_setState(claimIdentifier, State.UmaApproved) == State.UmaPending);
    } else {
      require(_setState(claimIdentifier, State.UmaDenied) == State.UmaPending);
      require(_setState(claimIdentifier, State.NonExistent) == State.UmaDenied);
    }
  }
}
