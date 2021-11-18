// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/Manager.sol';
import '../interfaces/managers/IStrategyManager.sol';

contract StrategyMock is IStrategyManager, Manager {
  IERC20 public override want;

  constructor(IERC20 _token) {
    want = _token;
  }

  function withdrawAll() external override returns (uint256 b) {
    b = balanceOf();
    want.transfer(msg.sender, b);
  }

  function withdraw(uint256 _amount) external override {
    want.transfer(msg.sender, _amount);
  }

  function deposit() external override {}

  function balanceOf() public view override returns (uint256) {
    return want.balanceOf(address(this));
  }
}
