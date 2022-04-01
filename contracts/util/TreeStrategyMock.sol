// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../strategy/base/BaseStrategy.sol';

contract TreeStrategyMock is BaseStrategy {
  event WithdrawAll();
  event Withdraw(uint256 amount);
  event Deposit();

  constructor(address _core, IERC20 _want) BaseStrategy(_want, _core) {}

  function balanceOf() public view override returns (uint256) {
    return want.balanceOf(address(this));
  }

  function _withdrawAll() internal override returns (uint256 amount) {
    amount = balanceOf();
    want.transfer(msg.sender, amount);

    emit WithdrawAll();
  }

  function _withdraw(uint256 _amount) internal override {
    want.transfer(msg.sender, _amount);

    emit Withdraw(_amount);
  }

  function _deposit() internal override {
    emit Deposit();
  }
}
