// include claimPremiums func()

// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/Manager.sol';
import '../interfaces/managers/ISherlockProtocolManager.sol';

contract SherlockProtocolManagerMock is ISherlockProtocolManager, Manager {
  uint256 amount;

  uint256 public claimCalled;

  IERC20 token;

  constructor(IERC20 _token) {
    token = _token;
  }

  function setAmount(uint256 _amount) external {
    amount = _amount;
  }

  function claimablePremiums() external view override returns (uint256) {}

  function claimPremiums() external override {
    token.transfer(msg.sender, amount);
    claimCalled++;
  }

  function protocolAgent(bytes32 _protocol) external view override returns (address) {}

  function premiums(bytes32 _protocol) external view override returns (uint256) {}

  function balances(bytes32 _protocol) external view override returns (uint256) {}

  function secondsOfCoverageLeft(bytes32 _protocol) external view override returns (uint256) {}

  function protocolAdd(
    bytes32 _protocol,
    address _protocolAgent,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external override {}

  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external override {}

  function protocolRemove(bytes32 _protocol) external override {}

  function forceRemoveByBalance(bytes32 _protocol) external override {}

  function forceRemoveByRemainingCoverage(bytes32 _protocol) external override {}

  function minBalance() external view override returns (uint256) {}

  function minSecondsOfCoverage() external view override returns (uint256) {}

  function setMinBalance(uint256 _minBalance) external override {}

  function setMinSecondsOfCoverage(uint256 _minSeconds) external override {}

  function setProtocolPremium(bytes32 _protocol, uint256 _premium) external override {}

  function setProtocolPremiums(bytes32[] calldata _protocol, uint256[] calldata _premium)
    external
    override
  {}

  function depositProtocolBalance(bytes32 _protocol, uint256 _amount) external override {}

  function withdrawProtocolBalance(bytes32 _protocol, uint256 _amount) external override {}

  function transferProtocolAgent(bytes32 _protocol, address _protocolAgent) external override {}

  function nonStakersClaimable(bytes32 _protocol) external view override returns (uint256) {}

  function nonStakersClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver
  ) external override {}

  function coverageAmounts(bytes32 _protocol)
    external
    view
    override
    returns (uint256 current, uint256 previous)
  {}
}
