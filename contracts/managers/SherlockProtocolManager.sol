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

  uint256 constant MIN_WITHDRAWAL_LEFT = 3 days;

  mapping(bytes32 => address) public override protocolAgent;
  mapping(bytes32 => uint256) nonStakersShares;

  mapping(bytes32 => uint256) public override premiums;
  mapping(bytes32 => uint256) public balancesInternal;
  mapping(bytes32 => uint256) lastAccountedProtocol;
  mapping(bytes32 => uint256) nonStakersClaimableStored;

  uint256 lastAccounted;
  uint256 totalPremiumPerBlock;
  uint256 claimablePremiumsStored;

  uint256 public override minBalance; // @todo make constant?
  uint256 public override minSecondsOfCoverage; // @todo make constant?

  mapping(bytes32 => uint256) currentCoverage;
  mapping(bytes32 => uint256) previousCoverage;

  constructor(IERC20 _token) {
    token = _token;
  }

  function _verifyProtocolExists(bytes32 _protocol) internal returns (address _protocolAgent) {
    _protocolAgent = protocolAgent[_protocol];
    if (_protocolAgent == address(0)) revert ProtocolNotExists(_protocol);
  }

  //
  // View methods
  //
  function _nonStakersPerblock(bytes32 _protocol) internal view returns (uint256) {
    return (premiums[_protocol] * nonStakersShares[_protocol]) / 10**18;
  }

  function _calcProtocolDebt(bytes32 _protocol) internal view returns (uint256) {
    return (block.timestamp - lastAccountedProtocol[_protocol]) * premiums[_protocol];
  }

  function nonStakersClaimable(bytes32 _protocol) external view override returns (uint256) {
    return
      nonStakersClaimableStored[_protocol] +
      (block.timestamp - lastAccountedProtocol[_protocol]) *
      _nonStakersPerblock(_protocol);
  }

  function claimablePremiums() public view override returns (uint256) {
    return claimablePremiumsStored + (block.timestamp - lastAccounted) * totalPremiumPerBlock;
  }

  function secondsOfCoverageLeft(bytes32 _protocol) public view override returns (uint256) {
    return balances(_protocol) / premiums[_protocol];
  }

  function balances(bytes32 _protocol) public view override returns (uint256) {
    return balancesInternal[_protocol] - _calcProtocolDebt(_protocol);
  }

  //
  // State methods
  //

  function _setProtocolPremium(bytes32 _protocol, uint256 _premium)
    internal
    returns (uint256 oldPremium, uint256 nonStakerShares)
  {
    nonStakerShares = _settleProtocolDebt(_protocol);
    oldPremium = premiums[_protocol];

    if (oldPremium != _premium) {
      premiums[_protocol] = _premium;
      emit ProtocolPremiumChanged(_protocol, oldPremium, _premium);
    }

    require(secondsOfCoverageLeft(_protocol) >= minSecondsOfCoverage, 'BALANCE');
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
    protocolAgent[_protocol] = _protocolAgent;
    emit ProtocolAgentTransfer(_protocol, _oldAgent, _protocolAgent);
  }

  function _settleProtocolDebt(bytes32 _protocol) internal returns (uint256 _nonStakerShares) {
    uint256 debt = _calcProtocolDebt(_protocol);
    _nonStakerShares = nonStakersShares[_protocol];
    if (debt != 0) {
      balancesInternal[_protocol] -= debt;
      nonStakersClaimableStored[_protocol] += (_nonStakerShares * debt) / 10**18;
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
      ((10**18 - _nonStakerSharesNew) * _premiumNew) /
      10**18 -
      ((10**18 - _nonStakerSharesOld) * _premiumOld) /
      10**18;
  }

  function _forceRemoveProtocol(bytes32 _protocol, address _agent) internal {
    _setSingleProtocolPremium(_protocol, 0);

    uint256 balance = balancesInternal[_protocol];
    if (balance > 0) {
      token.safeTransfer(_agent, balance);
      delete balancesInternal[_protocol];
    }

    _setProtocolAgent(_protocol, _agent, address(0));
    delete nonStakersShares[_protocol];
    delete currentCoverage[_protocol];
    delete previousCoverage[_protocol];

    emit ProtocolUpdated(_protocol, bytes32(0), uint256(0), uint256(0));
    emit ProtocolRemoved(_protocol);
  }

  function setMinBalance(uint256 _minBalance) external override onlyOwner {
    minBalance = _minBalance;
  }

  function setMinSecondsOfCoverage(uint256 _minSeconds) external override onlyOwner {
    minSecondsOfCoverage = _minSeconds;
  }

  function nonStakersClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver
  ) external override {
    require(msg.sender == sherlockCore.nonStakersAddress());
    _settleProtocolDebt(_protocol);

    nonStakersClaimableStored[_protocol] -= _amount;
    token.safeTransfer(_receiver, _amount);
  }

  function claimPremiums() external override {
    token.safeTransfer(address(sherlockCore), claimablePremiums());

    claimablePremiumsStored = 0;
    lastAccounted = block.timestamp;
  }

  function viewCoverageAmounts(bytes32 _protocol)
    external
    view
    override
    returns (uint256 current, uint256 previous)
  {
    return (currentCoverage[_protocol], previousCoverage[_protocol]);
  }

  function protocolAdd(
    bytes32 _protocol,
    address _protocolAgent,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external override onlyOwner {
    require(_protocolAgent != address(0), 'AGENT');
    _setProtocolAgent(_protocol, address(0), _protocolAgent);

    emit ProtocolAdded(_protocol);
    protocolUpdate(_protocol, _coverage, _nonStakers, _coverageAmount);
  }

  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) public override onlyOwner {
    require(_protocol != bytes32(0), 'PROTOCOL');
    require(_coverage != bytes32(0), 'COVERAGE');
    require(_nonStakers <= 10**18, 'NONSTAKERS');
    require(_coverageAmount != uint256(0), 'AMOUNT');
    _verifyProtocolExists(_protocol);

    _settleProtocolDebt(_protocol);
    _settleTotalDebt();

    uint256 premium = premiums[_protocol];
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
    require(_protocol != bytes32(0), 'PROTOCOL');
    address agent = _verifyProtocolExists(_protocol);

    _forceRemoveProtocol(_protocol, agent);
  }

  function forceRemoveByBalance(bytes32 _protocol) external override {
    require(_protocol != bytes32(0), 'PROTOCOL');
    address agent = _verifyProtocolExists(_protocol);

    uint256 remainingBalance = balances(_protocol);
    require(remainingBalance > 0 && remainingBalance < minBalance, 'NOT_REMOVEABLE');

    token.safeTransfer(msg.sender, remainingBalance);
    _forceRemoveProtocol(_protocol, agent);
  }

  function forceRemoveByRemainingCoverage(bytes32 _protocol) external override {
    require(_protocol != bytes32(0), 'PROTOCOL');
    address agent = _verifyProtocolExists(_protocol);

    uint256 percentageScaled = (secondsOfCoverageLeft(_protocol) * 10**18) / minSecondsOfCoverage;
    require(percentageScaled < 10**18, 'NOT_REMOVEABLE');

    token.safeTransfer(msg.sender, (balances(_protocol) * percentageScaled) / 10**18);
    _forceRemoveProtocol(_protocol, agent);
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
    require(_protocol.length == _premium.length, 'LENGTH');
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
    require(_protocol != bytes32(0), 'PROTOCOL');
    require(_amount != uint256(0), 'AMOUNT');

    _verifyProtocolExists(_protocol);

    token.safeTransfer(address(this), _amount);
    balancesInternal[_protocol] += _amount;

    emit ProtocolBalanceDeposited(_protocol, _amount);
  }

  function withdrawProtocolBalance(bytes32 _protocol, uint256 _amount) external override {
    require(_protocol != bytes32(0), 'PROTOCOL');
    require(_amount != uint256(0), 'AMOUNT');

    if (msg.sender != _verifyProtocolExists(_protocol)) revert UnauthorizedAgent();

    balancesInternal[_protocol] -= _amount;
    require(secondsOfCoverageLeft(_protocol) >= MIN_WITHDRAWAL_LEFT);

    token.safeTransfer(msg.sender, _amount);
    emit ProtocolBalanceWithdrawn(_protocol, _amount);
  }

  function transferProtocolAgent(bytes32 _protocol, address _protocolAgent) external override {
    require(_protocol != bytes32(0), 'PROTOCOL');
    require(_protocolAgent != address(0), 'AGENT');
    require(msg.sender != _protocolAgent, 'SAME');

    if (msg.sender != _verifyProtocolExists(_protocol)) revert UnauthorizedAgent();

    _setProtocolAgent(_protocol, msg.sender, _protocolAgent);
  }

  // @todo implement sweep function
}
