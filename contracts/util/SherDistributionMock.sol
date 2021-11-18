// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/Manager.sol';
import '../interfaces/managers/ISherDistributionManager.sol';

contract SherDistributionMock is ISherDistributionManager, Manager {
  uint256 reward;
  IERC20 token;

  uint256 public lastAmount;
  uint256 public lastPeriod;

  constructor(IERC20 _token) {
    token = _token;
  }

  function setReward(uint256 _reward) external {
    reward = _reward;
  }

  function pullReward(uint256 _amount, uint256 _period) external override returns (uint256 _sher) {
    _sher = reward;
    token.transfer(msg.sender, reward);

    lastAmount = _amount;
    lastPeriod = _period;
  }

  function calcReward(
    uint256 _tvl,
    uint256 _amount,
    uint256 _period
  ) external view override returns (uint256 _sher) {}

  function isActive() external view override returns (bool) {}
}
