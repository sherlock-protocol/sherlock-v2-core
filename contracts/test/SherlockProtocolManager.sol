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

  function viewNonStakersShares(bytes32 _protocol) external view returns (uint256) {
    return nonStakersShares[_protocol];
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

  function viewNonStakersPerBlock(bytes32 _protocol) external view returns (uint256) {
    return _nonStakersPerblock(_protocol);
  }
}
