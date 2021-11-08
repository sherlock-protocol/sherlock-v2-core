// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/ISherDistributionManager.sol';

import 'hardhat/console.sol';

/// @dev expects 6 decimals input tokens
contract SherDistributionManager is ISherDistributionManager, Manager {
  using SafeERC20 for IERC20;

  uint256 constant multiplier = 10**6;

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
    // @todo sanity check params
  }

  function pullReward(uint256 _amount, uint256 _period)
    external
    override
    onlySherlockCore
    returns (uint256 _sher)
  {
    _sher = calcReward(sherlockCore.balanceOf() - _amount, _amount, _period);
    sher.safeTransfer(msg.sender, _sher);
  }

  function calcReward(
    uint256 _tvl,
    uint256 _amount,
    uint256 _period
  ) public view override returns (uint256 _sher) {
    uint256 maxRewardsAvailable = maxRewardsTVL - _tvl;
    uint256 slopeRewardsAvailable = zeroRewardsTVL - _tvl;

    if (maxRewardsAvailable != 0) {
      if (_amount < maxRewardsAvailable) {
        // enough liquidity available for max rate
        return (_amount * maxRewardsRate * _period) * multiplier;
      } else {
        // take the remaining liquidity for max rate + calc rest on the slope
        _tvl += maxRewardsAvailable;
        _amount -= maxRewardsAvailable;

        _sher += (maxRewardsAvailable * maxRewardsRate * _period) * multiplier;
      }
    }

    if (_amount != 0 && slopeRewardsAvailable != 0) {
      // take all remaining liquidity on the slope
      if (_amount > slopeRewardsAvailable) _amount = slopeRewardsAvailable;

      // take average on slope.
      // e.g. if tvl = 100m, 50m is deposited, point at 125m is taken
      uint256 position = _tvl + (_amount / 2);

      // calc SHER rewards based on position on the curve
      // @TODO, when overflow?
      _sher +=
        (((zeroRewardsTVL - position) * _amount * maxRewardsRate * _period) /
          (zeroRewardsTVL - maxRewardsTVL)) *
        multiplier;
    }
  }

  function isActive() public view override returns (bool) {
    return address(sherlockCore.sherDistributionManager()) == address(this);
  }

  function sweep(address _receiver, IERC20[] memory _extraTokens) external onlyOwner {
    require(!isActive(), 'is_active');
    _sweep(_receiver, _extraTokens);
  }
}