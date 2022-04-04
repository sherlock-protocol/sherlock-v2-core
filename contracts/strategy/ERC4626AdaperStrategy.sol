// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';

import '../interfaces/strategy/IERC4626.sol';

// This contract contains logic for depositing staker funds into Aave V2 as a yield strategy

contract ERC4624AdaperStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  IERC4626 public immutable instance;

  constructor(IMaster _initialParent, IERC4626 _instance) BaseNode(_initialParent) {
    instance = _instance;
    if (address(want) != _instance.asset()) revert('INVALUD');
  }

  function setupCompleted() external view override returns (bool) {
    return true;
  }

  function balanceOf() public view override returns (uint256) {
    return instance.maxWithdraw(address(this));
  }

  function _deposit() internal override whenNotPaused {
    uint256 amount = want.balanceOf(address(this));
    instance.deposit(amount, address(this));
  }

  function _withdrawAll() internal override returns (uint256 amount) {
    amount = balanceOf();
    instance.withdraw(amount, core, address(this));
  }

  function _withdraw(uint256 _amount) internal override {
    instance.withdraw(_amount, core, address(this));
  }
}
