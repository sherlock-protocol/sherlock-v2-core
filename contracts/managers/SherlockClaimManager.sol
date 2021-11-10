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

/// @dev expects 6 decimals input tokens
contract SherlockClaimManager is ISherlockClaimManager, Manager {
  using SafeERC20 for IERC20;

  uint256 constant BOND = 5 * 10**6;
  uint256 constant BOND_USER = (BOND * 3) / 2 + 1;
  uint256 constant UMAHO_TIME = 3 days;
  uint256 constant SPCC_TIME = 7 days;
  uint256 constant LIVENESS = 7200;
  bytes32 public constant override umaIdentifier = '0x534845524c4f434b5f434c41494d';
  SkinnyOptimisticOracleInterface immutable uma;
  IERC20 immutable token;

  address public override umaHaltOperator;
  address public override sherlockProtocolClaimsCommittee;

  mapping(bytes32 => bool) protocolClaimActive;

  mapping(uint256 => bytes32) publicToInternalID;
  mapping(bytes32 => uint256) internalToPublicID;
  mapping(bytes32 => Claim) claims_;

  uint256 internal lastClaimID;

  modifier onlyUMA(bytes32 identifier) {
    require(umaIdentifier == identifier);
    require(msg.sender == address(uma));
    _;
  }

  modifier onlySPCC() {
    require(msg.sender == sherlockProtocolClaimsCommittee);
    _;
  }

  modifier onlyUMAHO() {
    require(msg.sender == umaHaltOperator);
    _;
  }

  constructor(SkinnyOptimisticOracleInterface _uma, IERC20 _token) {
    uma = _uma;
    token = _token;
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
    delete umaHaltOperator;
    emit UMAHORenounced();
  }

  function claims(uint256 _claimID) external view override returns (Claim memory) {
    return claims_[publicToInternalID[_claimID]];
  }

  function startClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver,
    uint32 _timestamp,
    bytes memory ancillaryData
  ) external override {
    require(!protocolClaimActive[_protocol]);

    ISherlockProtocolManager protocolManager = sherlockCore.sherlockProtocolManager();
    address agent = protocolManager.protocolAgent(_protocol);
    require(msg.sender == agent);

    (uint256 current, uint256 previous) = protocolManager.viewCoverageAmounts(_protocol);
    uint256 maxClaim = current > previous ? current : previous;
    bool prevCoverage = _amount > current;
    require(_amount <= maxClaim);

    bytes32 claimIdentifier = keccak256(ancillaryData);
    require(claims_[claimIdentifier].state == State.NonExistent);

    uint256 claimID = lastClaimID++;
    protocolClaimActive[_protocol] = true;
    publicToInternalID[claimID] = claimIdentifier;
    internalToPublicID[claimIdentifier] = claimID;

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

  function spccApprove(uint256 _claimID) external override onlySPCC {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    require(_setState(claimIdentifier, State.SpccApproved) == State.SpccPending);
  }

  function spccRefuse(uint256 _claimID) external override onlySPCC {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    require(_setState(claimIdentifier, State.SpccDenied) == State.SpccPending);
  }

  function escalate(uint256 _claimID) external override {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    Claim storage claim = claims_[claimIdentifier];

    ISherlockProtocolManager protocolManager = sherlockCore.sherlockProtocolManager();
    address agent = protocolManager.protocolAgent(claim.protocol);
    require(msg.sender == agent);

    token.safeTransferFrom(msg.sender, address(this), BOND_USER);
    token.safeApprove(address(uma), BOND_USER);

    uint256 updated = claim.updated;
    State _oldState = _setState(claimIdentifier, State.UmaPriceProposed);
    require(
      _oldState == State.SpccDenied ||
        (_oldState == State.SpccPending && updated + SPCC_TIME >= block.timestamp)
    );

    uma.requestAndProposePriceFor(
      umaIdentifier,
      claim.timestamp,
      claim.ancillaryData,
      token,
      0,
      BOND,
      LIVENESS,
      agent,
      int256(claim.amount)
    );
  }

  function enactClaim(uint256 _claimID) external override {
    bytes32 claimIdentifier = publicToInternalID[_claimID];
    Claim storage claim = claims_[claimIdentifier];
    address receiver = claim.receiver;
    uint256 amount = claim.amount;
    uint256 updated = claim.updated;

    State _oldState = _setState(claimIdentifier, State.NonExistent);

    if (umaHaltOperator == address(0)) {
      require(_oldState == State.SpccApproved || _oldState == State.UmaApproved);
    } else {
      require(
        _oldState == State.SpccApproved ||
          (_oldState == State.UmaApproved && updated + UMAHO_TIME >= block.timestamp)
      );
    }

    emit ClaimPayout(_claimID);

    sherlockCore.payout(receiver, amount);
  }

  function executeHalt(uint256 _claimID) external override onlyUMAHO {
    bytes32 claimIdentifier = publicToInternalID[_claimID];

    require(_setState(claimIdentifier, State.UmaDenied) == State.UmaApproved);
    require(_setState(claimIdentifier, State.NonExistent) == State.UmaDenied);

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
