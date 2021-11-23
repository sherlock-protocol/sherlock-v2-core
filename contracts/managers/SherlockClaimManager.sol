// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/ISherlockClaimManager.sol';
import '../interfaces/managers/ISherlockProtocolManager.sol';
import '../interfaces/UMAprotocol/SkinnyOptimisticOracleInterface.sol';

import 'hardhat/console.sol';

// @todo everyone can escalate and enact?
// @todo add callback for payout

/// @dev expects 6 decimals input tokens
contract SherlockClaimManager is ISherlockClaimManager, Manager {
  using SafeERC20 for IERC20;

  uint256 constant BOND = 5000 * 10**6; // 5k bond
  uint256 constant UMAHO_TIME = 3 days;
  uint256 constant SPCC_TIME = 7 days;
  uint256 constant LIVENESS = 7200;
  bytes32 public constant override umaIdentifier =
    bytes32(0x534845524c4f434b5f434c41494d000000000000000000000000000000000000);
  SkinnyOptimisticOracleInterface constant UMA =
    SkinnyOptimisticOracleInterface(0xeE3Afe347D5C74317041E2618C49534dAf887c24);
  IERC20 constant TOKEN = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

  address public override umaHaltOperator;
  address public immutable override sherlockProtocolClaimsCommittee;

  mapping(bytes32 => bool) public protocolClaimActive;

  mapping(uint256 => bytes32) internal publicToInternalID;
  mapping(bytes32 => uint256) internal internalToPublicID;
  mapping(bytes32 => Claim) internal claims_;

  SkinnyOptimisticOracleInterface.Request private umaRequest;

  uint256 internal lastClaimID;

  modifier onlyUMA(bytes32 identifier) {
    if (umaIdentifier != identifier) revert InvalidArgument();
    if (msg.sender != address(UMA)) revert InvalidSender();
    _;
  }

  constructor(address _umaho, address _spcc) {
    if (_umaho == address(0)) revert ZeroArgument();
    if (_spcc == address(0)) revert ZeroArgument();

    umaHaltOperator = _umaho;
    sherlockProtocolClaimsCommittee = _spcc;
  }

  modifier onlySPCC() {
    if (msg.sender != sherlockProtocolClaimsCommittee) revert InvalidSender();
    _;
  }

  modifier onlyUMAHO() {
    if (msg.sender != umaHaltOperator) revert InvalidSender();
    _;
  }

  function _cleanUpClaim(bytes32 _claimIdentifier) internal {
    delete protocolClaimActive[claims_[_claimIdentifier].protocol];
    delete claims_[_claimIdentifier];

    uint256 publicID = internalToPublicID[_claimIdentifier];
    delete publicToInternalID[publicID];
    delete internalToPublicID[_claimIdentifier];
  }

  function _setState(bytes32 _claimIdentifier, State _state) internal returns (State _oldState) {
    Claim storage claim = claims_[_claimIdentifier];
    _oldState = claim.state;

    emit ClaimStatusChanged(internalToPublicID[_claimIdentifier], _oldState, _state);

    if (_state == State.NonExistent) {
      _cleanUpClaim(_claimIdentifier);
    } else {
      claims_[_claimIdentifier].state = _state;
      claims_[_claimIdentifier].updated = block.timestamp;
    }
  }

  function renounceUmaHaltOperator() external override onlyOwner {
    if (umaHaltOperator == address(0)) revert InvalidConditions();

    delete umaHaltOperator;
    emit UMAHORenounced();
  }

  function claims(uint256 _claimID) external view override returns (Claim memory claim_) {
    bytes32 id_ = publicToInternalID[_claimID];
    if (id_ == bytes32(0)) revert InvalidArgument();

    claim_ = claims_[id_];
    if (claim_.state == State.NonExistent) revert InvalidArgument();
  }

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

    bytes32 claimIdentifier = keccak256(ancillaryData);
    if (claims_[claimIdentifier].state != State.NonExistent) revert InvalidArgument();

    ISherlockProtocolManager protocolManager = sherlockCore.sherlockProtocolManager();
    address agent = protocolManager.protocolAgent(_protocol);
    if (msg.sender != agent) revert InvalidSender();

    (uint256 current, uint256 previous) = protocolManager.coverageAmounts(_protocol);
    uint256 maxClaim = current > previous ? current : previous;
    bool prevCoverage = _amount > current;
    if (_amount > maxClaim) revert InvalidArgument();

    uint256 claimID = ++lastClaimID;
    protocolClaimActive[_protocol] = true;
    publicToInternalID[claimID] = claimIdentifier;
    internalToPublicID[claimIdentifier] = claimID;

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

  function spccApprove(uint256 _claimID) external override onlySPCC {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    if (_setState(claimIdentifier, State.SpccApproved) != State.SpccPending) revert InvalidState();
  }

  function spccRefuse(uint256 _claimID) external override onlySPCC {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    if (_setState(claimIdentifier, State.SpccDenied) != State.SpccPending) revert InvalidState();
  }

  function escalate(uint256 _claimID, uint256 _amount) external override {
    if (_amount < BOND) revert InvalidArgument();

    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    Claim storage claim = claims_[claimIdentifier];
    if (msg.sender != claim.initiator) revert InvalidSender();

    uint256 updated = claim.updated;
    State _oldState = _setState(claimIdentifier, State.UmaPriceProposed);
    if (
      _oldState != State.SpccDenied &&
      !(_oldState == State.SpccPending && updated + SPCC_TIME < block.timestamp)
    ) revert InvalidState();

    TOKEN.safeTransferFrom(msg.sender, address(this), _amount);
    TOKEN.safeApprove(address(UMA), _amount);

    UMA.requestAndProposePriceFor(
      umaIdentifier,
      claim.timestamp,
      claim.ancillaryData,
      TOKEN,
      0,
      BOND,
      LIVENESS,
      msg.sender, // claim initiator
      int256(claim.amount)
    );

    if (_setState(claimIdentifier, State.UmaDisputeProposed) != State.ReadyToProposeUmaDispute) {
      revert InvalidState();
    }

    UMA.disputePriceFor(
      umaIdentifier,
      claim.timestamp,
      claim.ancillaryData,
      umaRequest,
      address(sherlockCore), // disputor
      address(this)
    );

    if (claim.state != State.UmaPending) revert InvalidState();

    delete umaRequest;
    TOKEN.safeApprove(address(UMA), 0);
    uint256 remaining = TOKEN.balanceOf(address(this));
    if (remaining != 0) TOKEN.safeTransfer(msg.sender, remaining);
  }

  function payoutClaim(uint256 _claimID) external override {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    Claim storage claim = claims_[claimIdentifier];
    if (msg.sender != claim.initiator) revert InvalidSender();

    address receiver = claim.receiver;
    uint256 amount = claim.amount;
    uint256 updated = claim.updated;

    State _oldState = _setState(claimIdentifier, State.NonExistent);

    if (umaHaltOperator == address(0)) {
      if (_oldState != State.SpccApproved || _oldState != State.UmaApproved) revert InvalidState();
    } else {
      if (
        _oldState != State.SpccApproved ||
        !(_oldState == State.UmaApproved && updated + UMAHO_TIME <= block.timestamp)
      ) revert InvalidState();
    }

    emit ClaimPayout(_claimID);

    sherlockCore.payoutClaim(receiver, amount);
  }

  function executeHalt(uint256 _claimID) external override onlyUMAHO {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    if (claimIdentifier == bytes32(0)) revert InvalidArgument();

    if (_setState(claimIdentifier, State.UmaDenied) != State.UmaApproved) revert InvalidState();
    if (_setState(claimIdentifier, State.NonExistent) != State.UmaDenied) revert InvalidState();

    emit ClaimHalted(_claimID);
  }

  //
  // UMA callbacks
  //

  function priceProposed(
    bytes32 identifier,
    uint32 timestamp,
    bytes memory ancillaryData,
    SkinnyOptimisticOracleInterface.Request memory request
  ) external override onlyUMA(identifier) {
    bytes32 claimIdentifier = keccak256(ancillaryData);

    Claim storage claim = claims_[claimIdentifier];
    if (claim.updated != block.timestamp) revert InvalidConditions();

    if (_setState(claimIdentifier, State.ReadyToProposeUmaDispute) != State.UmaPriceProposed) {
      revert InvalidState();
    }

    umaRequest = request;
  }

  function priceDisputed(
    bytes32 identifier,
    uint32 timestamp,
    bytes memory ancillaryData,
    SkinnyOptimisticOracleInterface.Request memory request
  ) external override onlyUMA(identifier) {
    bytes32 claimIdentifier = keccak256(ancillaryData);

    Claim storage claim = claims_[claimIdentifier];
    if (claim.updated != block.timestamp) revert InvalidConditions();

    if (_setState(claimIdentifier, State.UmaPending) != State.UmaDisputeProposed) {
      revert InvalidState();
    }
  }

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
      if (_setState(claimIdentifier, State.UmaApproved) != State.UmaPending) revert InvalidState();
    } else {
      if (_setState(claimIdentifier, State.UmaDenied) != State.UmaPending) revert InvalidState();
      if (_setState(claimIdentifier, State.NonExistent) != State.UmaDenied) revert InvalidState();
    }
  }
}
