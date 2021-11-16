// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/SherlockProtocolManager.sol';

/// @notice this contract is used for testing to view all storage variables
contract SherlockProtocolManagerTest is SherlockProtocolManager {
  constructor(IERC20 _token) SherlockProtocolManager(_token) {}

  function privateSettleTotalDebt() external {
    _settleTotalDebt();
  }

  function privateSetMinBalance(uint256 _min) external {
    minBalance = _min;
  }

  function privateSetMinSecondsOfCoverage(uint256 _min) external {
    minSecondsOfCoverage = _min;
  }

  function viewMinSecondsOfCoverage() external view returns (uint256) {
    return minSecondsOfCoverage;
  }

  function viewMinBalance() external view returns (uint256) {
    return minBalance;
  }

  function viewProtocolAgent(bytes32 _protocol) external view returns (address) {
    return protocolAgent_[_protocol];
  }

  function viewRemovedProtocolAgent(bytes32 _protocol) external view returns (address) {
    return removedProtocolAgent[_protocol];
  }

  function viewRemovedProtocolValidUntil(bytes32 _protocol) external view returns (uint256) {
    return removedProtocolValidUntil[_protocol];
  }

  function viewNonStakersShares(bytes32 _protocol) external view returns (uint256) {
    return nonStakersShares[_protocol];
  }

  function viewCurrentCoverage(bytes32 _protocol) external view returns (uint256) {
    return currentCoverage[_protocol];
  }

  function viewPreviousCoverage(bytes32 _protocol) external view returns (uint256) {
    return previousCoverage[_protocol];
  }

  function viewLastAccountedProtocol(bytes32 _protocol) external view returns (uint256) {
    return lastAccountedProtocol[_protocol];
  }

  function viewNonStakersClaimableStored(bytes32 _protocol) external view returns (uint256) {
    return nonStakersClaimableStored[_protocol];
  }

  function viewLastAccounted() external view returns (uint256) {
    return lastAccounted;
  }

  function viewTotalPremiumPerBlock() external view returns (uint256) {
    return totalPremiumPerBlock;
  }

  function viewClaimablePremiumsStored() external view returns (uint256) {
    return claimablePremiumsStored;
  }

  function viewBalancesInternal(bytes32 _protocol) external view returns (uint256) {
    return balancesInternal[_protocol];
  }
}
