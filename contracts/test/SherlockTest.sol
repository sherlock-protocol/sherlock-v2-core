// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../Sherlock.sol';

/// @notice this contract is used for testing to view all storage variables
contract SherlockTest is Sherlock {
  constructor(
    IERC20 _token,
    IERC20 _sher,
    string memory _name,
    string memory _symbol,
    IStrategyManager _strategy,
    ISherDistributionManager _sherDistributionManager,
    address _nonStakersAddress,
    ISherlockProtocolManager _sherlockProtocolManager,
    ISherlockClaimManager _sherlockClaimManager,
    uint256[] memory _initialPeriods
  )
    Sherlock(
      _token,
      _sher,
      _name,
      _symbol,
      _strategy,
      _sherDistributionManager,
      _nonStakersAddress,
      _sherlockProtocolManager,
      _sherlockClaimManager,
      _initialPeriods
    )
  {}

  function viewShares(uint256 _id) external view returns (uint256) {
    return shares[_id];
  }

  function viewTotalShares() external view returns (uint256) {
    return totalShares;
  }
}
