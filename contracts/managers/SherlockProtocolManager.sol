// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/ISherlockProtocolManager.sol';

import 'hardhat/console.sol';

contract SherlockProtocolManager is ISherlockProtocolManager, Manager {
  using SafeERC20 for IERC20;
  IERC20 immutable token;

  uint256 constant PROTOCOL_CLAIM_DEADLINE = 7 days;
  uint256 constant MIN_SECONDS_LEFT = 3 days;
  uint256 constant HUNDRED_PERCENT = 10**18;

  mapping(bytes32 => address) protocolAgent_;
  mapping(bytes32 => uint256) nonStakersShares;

  mapping(bytes32 => uint256) premiums_;
  mapping(bytes32 => uint256) balancesInternal;
  mapping(bytes32 => uint256) lastAccountedProtocol;
  mapping(bytes32 => uint256) nonStakersClaimableStored;

  uint256 lastAccounted;
  uint256 totalPremiumPerBlock;
  uint256 claimablePremiumsStored;

  uint256 public override minBalance; // @todo make constant?
  uint256 public override minSecondsOfCoverage; // @todo make constant?

  mapping(bytes32 => uint256) removedProtocolValidUntil;
  mapping(bytes32 => address) removedProtocolAgent;
  mapping(bytes32 => uint256) currentCoverage;
  mapping(bytes32 => uint256) previousCoverage;

  constructor(IERC20 _token) {
    token = _token;
  }

  modifier protocolExists(bytes32 _protocol) {
    _verifyProtocolExists(_protocol);
    _;
  }

  function protocolAgent(bytes32 _protocol) external view override returns (address) {
    address agent = protocolAgent_[_protocol];
    if (agent != address(0)) return agent;

    // Note old protocol agent will never be address(0)
    if (block.timestamp <= removedProtocolValidUntil[_protocol]) {
      return removedProtocolAgent[_protocol];
    }

    revert ProtocolNotExists(_protocol);
  }

  function premiums(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return premiums_[_protocol];
  }

  function _verifyProtocolExists(bytes32 _protocol) internal view returns (address _protocolAgent) {
    _protocolAgent = protocolAgent_[_protocol];
    if (_protocolAgent == address(0)) revert ProtocolNotExists(_protocol);
  }

  //
  // View methods
  //
  function _calcProtocolDebt(bytes32 _protocol) internal view returns (uint256) {
    return (block.timestamp - lastAccountedProtocol[_protocol]) * premiums_[_protocol];
  }

  function nonStakersClaimable(bytes32 _protocol) external view override returns (uint256) {
    // non stakers can claim rewards after protocol is removed
    uint256 debt = _calcProtocolDebt(_protocol);
    uint256 balance = balancesInternal[_protocol];
    if (debt > balance) debt = balance;

    return
      nonStakersClaimableStored[_protocol] + (nonStakersShares[_protocol] * debt) / HUNDRED_PERCENT;
  }

  function claimablePremiums() public view override returns (uint256) {
    return claimablePremiumsStored + (block.timestamp - lastAccounted) * totalPremiumPerBlock;
  }

  function secondsOfCoverageLeft(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return _secondsOfCoverageLeft(_protocol);
  }

  function _secondsOfCoverageLeft(bytes32 _protocol) internal view returns (uint256) {
    uint256 premium = premiums_[_protocol];
    if (premium == 0) return 0;
    return _balances(_protocol) / premiums_[_protocol];
  }

  function balances(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return _balances(_protocol);
  }

  function _balances(bytes32 _protocol) internal view returns (uint256) {
    uint256 debt = _calcProtocolDebt(_protocol);
    uint256 balance = balancesInternal[_protocol];
    if (debt > balance) return 0;
    return balance - debt;
  }

  //
  // State methods
  //

  function _setProtocolPremium(bytes32 _protocol, uint256 _premium)
    internal
    returns (uint256 oldPremium, uint256 nonStakerShares)
  {
    nonStakerShares = _settleProtocolDebt(_protocol);
    oldPremium = premiums_[_protocol];

    if (oldPremium != _premium) {
      premiums_[_protocol] = _premium;
      emit ProtocolPremiumChanged(_protocol, oldPremium, _premium);
    }

    if (_premium != 0 && _secondsOfCoverageLeft(_protocol) < MIN_SECONDS_LEFT) {
      revert InsufficientBalance(_protocol);
    }
  }

  function _setSingleProtocolPremium(bytes32 _protocol, uint256 _premium) internal {
    (uint256 oldPremium, uint256 nonStakerShares) = _setProtocolPremium(_protocol, _premium);
    _settleTotalDebt();
    totalPremiumPerBlock = _calcTotalPremiumPerBlockValue(
      oldPremium,
      _premium,
      nonStakerShares,
      nonStakerShares,
      totalPremiumPerBlock
    );
  }

  function _setProtocolAgent(
    bytes32 _protocol,
    address _oldAgent,
    address _protocolAgent
  ) internal {
    protocolAgent_[_protocol] = _protocolAgent;
    emit ProtocolAgentTransfer(_protocol, _oldAgent, _protocolAgent);
  }

  function _settleProtocolDebt(bytes32 _protocol) internal returns (uint256 _nonStakerShares) {
    uint256 debt = _calcProtocolDebt(_protocol);
    _nonStakerShares = nonStakersShares[_protocol];
    if (debt != 0) {
      uint256 balance = balancesInternal[_protocol];
      if (debt > balance) {
        // Economically seen, this should never be reached as arb can remove a protocol and make a profit
        // using forceRemoveByBalance and forceRemoveByRemainingCoverage
        // premium should be set to 0 as soon as possible
        // otherise stakers/nonstakers will be disadvantaged
        uint256 error = debt - balance;
        // premiums were optimistically added, subtract them
        _settleTotalDebt();
        // @note to production, set premium first to zero before solving accounting issue.
        // otherwise the accounting error keeps increasing
        uint256 claimablePremiumsStored_ = claimablePremiumsStored;

        uint256 claimablePremiumError = ((HUNDRED_PERCENT - _nonStakerShares) * error) /
          HUNDRED_PERCENT;

        uint256 insufficientTokens;
        if (claimablePremiumError > claimablePremiumsStored_) {
          insufficientTokens = claimablePremiumError - claimablePremiumsStored_;
          claimablePremiumsStored = 0;
        } else {
          // insufficientTokens = 0
          claimablePremiumsStored = claimablePremiumsStored_ - claimablePremiumError;
        }

        emit AccountingError(_protocol, claimablePremiumError, insufficientTokens);
        debt = balance;
      }
      balancesInternal[_protocol] = balance - debt;
      nonStakersClaimableStored[_protocol] += (_nonStakerShares * debt) / HUNDRED_PERCENT;
    }
    lastAccountedProtocol[_protocol] = block.timestamp;
  }

  function _settleTotalDebt() internal {
    claimablePremiumsStored += (block.timestamp - lastAccounted) * totalPremiumPerBlock;
    lastAccounted = block.timestamp;
  }

  function _calcTotalPremiumPerBlockValue(
    uint256 _premiumOld,
    uint256 _premiumNew,
    uint256 _nonStakerSharesOld,
    uint256 _nonStakerSharesNew,
    uint256 _inMemTotalPremiumPerBlock
  ) internal pure returns (uint256) {
    return
      _inMemTotalPremiumPerBlock +
      ((HUNDRED_PERCENT - _nonStakerSharesNew) * _premiumNew) /
      HUNDRED_PERCENT -
      ((HUNDRED_PERCENT - _nonStakerSharesOld) * _premiumOld) /
      HUNDRED_PERCENT;
  }

  function _forceRemoveProtocol(bytes32 _protocol, address _agent) internal {
    _setSingleProtocolPremium(_protocol, 0);

    uint256 balance = balancesInternal[_protocol];
    if (balance != 0) {
      token.safeTransfer(_agent, balance);
      delete balancesInternal[_protocol];

      emit ProtocolBalanceWithdrawn(_protocol, balance);
    }

    _setProtocolAgent(_protocol, _agent, address(0));
    delete nonStakersShares[_protocol];
    delete lastAccountedProtocol[_protocol];
    removedProtocolValidUntil[_protocol] = block.timestamp + PROTOCOL_CLAIM_DEADLINE;
    removedProtocolAgent[_protocol] = _agent;

    emit ProtocolUpdated(_protocol, bytes32(0), uint256(0), uint256(0));
    emit ProtocolRemoved(_protocol);
  }

  function setMinBalance(uint256 _minBalance) external override onlyOwner {
    // @todo emit event
    minBalance = _minBalance;
  }

  function setMinSecondsOfCoverage(uint256 _minSeconds) external override onlyOwner {
    // @todo emit event
    minSecondsOfCoverage = _minSeconds;
  }

  function nonStakersClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver
  ) external override {
    if (_protocol == bytes32(0)) revert ZeroArgument();
    if (_amount == uint256(0)) revert ZeroArgument();
    if (_receiver == address(0)) revert ZeroArgument();
    if (msg.sender != sherlockCore.nonStakersAddress()) revert Unauthorized();

    // call can be executed on protocol that is removed
    if (protocolAgent_[_protocol] != address(0)) {
      _settleProtocolDebt(_protocol);
    }

    uint256 balance = nonStakersClaimableStored[_protocol];
    if (_amount > balance) revert InsufficientBalance(_protocol);

    nonStakersClaimableStored[_protocol] = balance - _amount;
    token.safeTransfer(_receiver, _amount);
  }

  function claimPremiums() external override {
    address sherlock = address(sherlockCore);
    if (sherlock == address(0)) revert InvalidConditions();

    token.safeTransfer(sherlock, claimablePremiums());

    claimablePremiumsStored = 0;
    lastAccounted = block.timestamp;
  }

  function coverageAmounts(bytes32 _protocol)
    external
    view
    override
    returns (uint256 current, uint256 previous)
  {
    if (
      protocolAgent_[_protocol] != address(0) ||
      block.timestamp <= removedProtocolValidUntil[_protocol]
    ) {
      return (currentCoverage[_protocol], previousCoverage[_protocol]);
    }

    revert ProtocolNotExists(_protocol);
  }

  function protocolAdd(
    bytes32 _protocol,
    address _protocolAgent,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external override onlyOwner {
    if (_protocol == bytes32(0)) revert ZeroArgument();
    if (_protocolAgent == address(0)) revert ZeroArgument();
    if (protocolAgent_[_protocol] != address(0)) revert InvalidConditions();

    _setProtocolAgent(_protocol, address(0), _protocolAgent);

    // Delete mappings that are potentially non default values
    // From previous time protocol was added/removed
    delete removedProtocolValidUntil[_protocol];
    delete removedProtocolAgent[_protocol];
    delete currentCoverage[_protocol];
    delete previousCoverage[_protocol];

    emit ProtocolAdded(_protocol);
    protocolUpdate(_protocol, _coverage, _nonStakers, _coverageAmount);
  }

  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) public override onlyOwner {
    if (_coverage == bytes32(0)) revert ZeroArgument();
    if (_nonStakers > HUNDRED_PERCENT) revert InvalidArgument();
    if (_coverageAmount == uint256(0)) revert ZeroArgument();
    _verifyProtocolExists(_protocol);

    _settleProtocolDebt(_protocol);
    _settleTotalDebt();

    uint256 premium = premiums_[_protocol];
    totalPremiumPerBlock = _calcTotalPremiumPerBlockValue(
      premium,
      premium,
      nonStakersShares[_protocol],
      _nonStakers,
      totalPremiumPerBlock
    );
    nonStakersShares[_protocol] = _nonStakers;

    previousCoverage[_protocol] = currentCoverage[_protocol];
    currentCoverage[_protocol] = _coverageAmount;

    emit ProtocolUpdated(_protocol, _coverage, _nonStakers, _coverageAmount);
  }

  function protocolRemove(bytes32 _protocol) external override onlyOwner {
    address agent = _verifyProtocolExists(_protocol);

    _forceRemoveProtocol(_protocol, agent);
  }

  function forceRemoveByBalance(bytes32 _protocol) external override {
    address agent = _verifyProtocolExists(_protocol);

    _settleProtocolDebt(_protocol);
    uint256 remainingBalance = balancesInternal[_protocol];

    if (remainingBalance >= minBalance) revert InvalidConditions();
    if (remainingBalance != 0) {
      token.safeTransfer(msg.sender, remainingBalance);
      balancesInternal[_protocol] = 0;
    }

    _forceRemoveProtocol(_protocol, agent);
    emit ProtocolRemovedByArb(_protocol, msg.sender, remainingBalance);
  }

  function forceRemoveByRemainingCoverage(bytes32 _protocol) external override {
    address agent = _verifyProtocolExists(_protocol);

    uint256 percentageScaled = (_secondsOfCoverageLeft(_protocol) * HUNDRED_PERCENT) /
      minSecondsOfCoverage;
    if (percentageScaled > HUNDRED_PERCENT) revert InvalidConditions();

    _settleProtocolDebt(_protocol);
    uint256 remainingBalance = balancesInternal[_protocol];

    uint256 arbAmount = (remainingBalance * percentageScaled) / HUNDRED_PERCENT;
    if (arbAmount != 0) {
      token.safeTransfer(msg.sender, arbAmount);
      balancesInternal[_protocol] -= arbAmount;
    }

    _forceRemoveProtocol(_protocol, agent);
    emit ProtocolRemovedByArb(_protocol, msg.sender, arbAmount);
  }

  function setProtocolPremium(bytes32 _protocol, uint256 _premium) external override onlyOwner {
    _verifyProtocolExists(_protocol);

    _setSingleProtocolPremium(_protocol, _premium);
  }

  function setProtocolPremiums(bytes32[] calldata _protocol, uint256[] calldata _premium)
    external
    override
    onlyOwner
  {
    if (_protocol.length != _premium.length) revert UnequalArrayLength();

    _settleTotalDebt();

    uint256 totalPremiumPerBlock_ = totalPremiumPerBlock;
    for (uint256 i; i < _protocol.length; i++) {
      _verifyProtocolExists(_protocol[i]);

      (uint256 oldPremium, uint256 nonStakerShares) = _setProtocolPremium(
        _protocol[i],
        _premium[i]
      );

      totalPremiumPerBlock_ = _calcTotalPremiumPerBlockValue(
        oldPremium,
        _premium[i],
        nonStakerShares,
        nonStakerShares,
        totalPremiumPerBlock_
      );
    }

    totalPremiumPerBlock = totalPremiumPerBlock_;
  }

  function depositProtocolBalance(bytes32 _protocol, uint256 _amount) external override {
    if (_amount == uint256(0)) revert ZeroArgument();
    _verifyProtocolExists(_protocol);

    token.safeTransferFrom(msg.sender, address(this), _amount);
    balancesInternal[_protocol] += _amount;

    emit ProtocolBalanceDeposited(_protocol, _amount);
  }

  function withdrawProtocolBalance(bytes32 _protocol, uint256 _amount) external override {
    if (_amount == uint256(0)) revert ZeroArgument();
    if (msg.sender != _verifyProtocolExists(_protocol)) revert Unauthorized();

    uint256 currentBalance = balancesInternal[_protocol];
    if (_amount > currentBalance) revert InsufficientBalance(_protocol);

    balancesInternal[_protocol] = currentBalance - _amount;
    if (_secondsOfCoverageLeft(_protocol) < MIN_SECONDS_LEFT) revert InsufficientBalance(_protocol);

    token.safeTransfer(msg.sender, _amount);
    emit ProtocolBalanceWithdrawn(_protocol, _amount);
  }

  function transferProtocolAgent(bytes32 _protocol, address _protocolAgent) external override {
    if (_protocolAgent == address(0)) revert ZeroArgument();
    if (msg.sender == _protocolAgent) revert InvalidArgument();
    if (msg.sender != _verifyProtocolExists(_protocol)) revert Unauthorized();

    _setProtocolAgent(_protocol, msg.sender, _protocolAgent);
  }

  // @todo implement sweep function
}