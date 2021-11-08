// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/ISherDistributionManager.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract SherDistributionManager is ISherDistributionManager, Manager {
  uint256 immutable maxRewardsTVL;
  uint256 immutable zeroRewardsTVL;
  uint256 immutable maxRewardsRate;

  IERC20 immutable sher;

  constructor(
    uint256 _maxRewardsTVL,
    uint256 _zeroRewardsTVL,
    uint256 _maxRewardsRate,
    IERC20 _sher
  ) {
    maxRewardsTVL = _maxRewardsTVL;
    zeroRewardsTVL = _zeroRewardsTVL;
    maxRewardsRate = _maxRewardsRate;
    sher = _sher;

    // @TODO, emit event to show constructor parmas
  }

  function pullReward(
    uint256 _tvl,
    uint256 _amount,
    uint256 _period
  ) external override returns (uint256 _sher) {}

  function calcReward(
    uint256 _tvl,
    uint256 _amount,
    uint256 _period
  ) public view override returns (uint256 _sher) {
    uint256 maxRewardsAvailable = maxRewardsTVL - _tvl;
    uint256 slopeRewardsAvailable = zeroRewardsTVL - _tvl;
  }

  function isActive() external view override returns (bool) {}

  function sweep(address _receiver, IERC20[] memory _extraTokens) external override {}
}
