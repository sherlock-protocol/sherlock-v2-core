// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../managers/Manager.sol';
import '../interfaces/managers/IStrategyManager.sol';

contract StrategyMockFakeApy is IStrategyManager, Manager {
  IERC20 public override want;
  uint256 public depositCalled;
  uint256 public withdrawCalled;
  uint256 public withdrawAllCalled;
  bool public fail;

  uint256 private start;

  constructor(IERC20 _token) {
    want = _token;
    start = block.timestamp;
  }

  function setFail() external {
    fail = true;
  }

  function withdrawAll() external override returns (uint256 b) {
    b = balanceOf();
    if (b != 0) want.transfer(msg.sender, b);
    withdrawAllCalled++;
    require(!fail, 'FAIL');
  }

  function withdraw(uint256 _amount) external override {
    want.transfer(msg.sender, _amount);
    withdrawCalled++;
  }

  function deposit() external override {
    depositCalled++;
  }

  function balanceOf() public view override returns (uint256) {
    uint256 b = want.balanceOf(address(this));
    b += b * (block.timestamp - start) / 52 weeks;

    return b;
  }
}
