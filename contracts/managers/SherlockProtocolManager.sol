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

  //
  // State methods
  //
  function balances(bytes32 _protocol) public view override returns (uint256) {
    return balancesInternal[_protocol] - _calcProtocolDebt(_protocol);
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

  function _updateProtocolPremium(bytes32 _protocol, uint256 _premium)
    internal
    returns (uint256 _oldPremium)
  {
    _oldPremium = premiums[_protocol];
    premiums[_protocol] = _premium;
  }

  function _settleTotalDebt() internal {
    claimablePremiumsStored += (block.timestamp - lastAccounted) * totalPremiumPerBlock;
    lastAccounted = block.timestamp;
  }

  function _updateTotalPremiumPerBlock(
    bytes32 _protocol,
    uint256 _premiumOld,
    uint256 _premiumNew,
    uint256 _nonStakerSharesOld,
    uint256 _nonStakerSharesNew
  ) internal {
    console.log(((10**18 - _nonStakerSharesOld) * _premiumOld) / 10**18);
    console.log(((10**18 - _nonStakerSharesNew) * _premiumNew) / 10**18);
    totalPremiumPerBlock +=
      ((10**18 - _nonStakerSharesNew) * _premiumNew) /
      10**18 -
      ((10**18 - _nonStakerSharesOld) * _premiumOld) /
      10**18;
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
    uint256 _nonStakers
  ) external override onlyOwner {
    // @todo add coverage amount
    require(protocolAgent[_protocol] == address(0));
    require(_nonStakers <= 10**18);
    protocolAgent[_protocol] = _protocolAgent;
    nonStakersShares[_protocol] = _nonStakers;
  }

  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers
  ) external override onlyOwner {
    // @todo add coverage amount
    require(protocolAgent[_protocol] != address(0));
    require(_nonStakers <= 10**18);

    _settleProtocolDebt(_protocol);
    _settleTotalDebt();

    uint256 premium = premiums[_protocol];
    _updateTotalPremiumPerBlock(
      _protocol,
      premium,
      premium,
      nonStakersShares[_protocol],
      _nonStakers
    );
    nonStakersShares[_protocol] = _nonStakers;
  }

  function protocolRemove(bytes32 _protocol) external override onlyOwner {
    _protocolRemove(_protocol);
  }

  function _protocolRemove(bytes32 _protocol) internal {
    address agent = protocolAgent[_protocol];
    require(agent != address(0));
    require(premiums[_protocol] == 0);

    uint256 balance = balancesInternal[_protocol];
    if (balance > 0) {
      token.safeTransfer(agent, balance);
      delete balancesInternal[_protocol];
    }

    delete protocolAgent[_protocol];
    delete nonStakersShares[_protocol];
  }

  function _forceRemoveProtocol(bytes32 _protocol) internal {
    _setProtocolPremium(_protocol, 0);
    _protocolRemove(_protocol);
  }

  function forceRemoveByBalance(bytes32 _protocol) external override {
    uint256 remainingBalance = balances(_protocol);
    require(remainingBalance > 0 && remainingBalance < minBalance);

    token.safeTransfer(msg.sender, remainingBalance);
    _forceRemoveProtocol(_protocol);
  }

  function forceRemoveByRemainingCoverage(bytes32 _protocol) external override {
    uint256 percentageScaled = (secondsOfCoverageLeft(_protocol) * 10**18) / minSecondsOfCoverage;
    require(percentageScaled < 10**18, 'not able');

    token.safeTransfer(msg.sender, (balances(_protocol) * percentageScaled) / 10**18);
    _forceRemoveProtocol(_protocol);
  }

  function setMinBalance(uint256 _minBalance) external override onlyOwner {
    minBalance = _minBalance;
  }

  function setMinSecondsOfCoverage(uint256 _minSeconds) external override onlyOwner {
    minSecondsOfCoverage = _minSeconds;
  }

  function _setProtocolPremium(bytes32 _protocol, uint256 _premium) internal {
    uint256 nonStakerShares = _settleProtocolDebt(_protocol);
    uint256 oldPremium = _updateProtocolPremium(_protocol, _premium);

    _settleTotalDebt();
    _updateTotalPremiumPerBlock(_protocol, oldPremium, _premium, nonStakerShares, nonStakerShares);
  }

  function setProtocolPremium(bytes32 _protocol, uint256 _premium) external override onlyOwner {
    // @todo require protocol exist
    // @todo should have at least 1 day of of coverage left with the _premium amount
    _setProtocolPremium(_protocol, _premium);
  }

  function setProtocolPremiums(bytes32[] calldata _protocol, uint256[] calldata _premium)
    external
    override
    onlyOwner
  {}

  function depositProtocolBalance(bytes32 _protocol, uint256 _amount) external override {
    require(protocolAgent[_protocol] != address(0));

    token.safeTransfer(address(this), _amount);
    balancesInternal[_protocol] += _amount;
  }

  function withdrawProtocolBalance(bytes32 _protocol, uint256 _amount) external override {
    require(msg.sender == protocolAgent[_protocol]);
    balancesInternal[_protocol] -= _amount;
    require(secondsOfCoverageLeft(_protocol) >= MIN_WITHDRAWAL_LEFT);
    token.safeTransfer(msg.sender, _amount);
  }

  function transferProtocolAgent(bytes32 _protocol, address _protocolAgent) external override {
    require(msg.sender == protocolAgent[_protocol]);
    protocolAgent[_protocol] = _protocolAgent;
  }

  // @todo implement sweep function
}
