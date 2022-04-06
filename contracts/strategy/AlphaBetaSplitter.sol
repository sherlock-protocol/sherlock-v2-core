// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseSplitter.sol';

/// Always withdraw from childOne first
/// Only to deposit to childTwo if childOne balance is lower
contract AlphaBetaSplitter is BaseSplitter {
  constructor(
    IMaster _initialParent,
    INode _initialChildOne,
    INode _initialChildTwo
  ) BaseSplitter(_initialParent, _initialChildOne, _initialChildTwo) {}

  function _withdraw(uint256 _amount) internal virtual override {
    uint256 alphaBalance = childOne.balanceOf();
    uint256 betaBalance = childTwo.balanceOf();

    // withdraws will send the USDC to core
    if (_amount > alphaBalance) {
      childTwo.withdraw(_amount - childOne.withdrawAll());
    } else {
      childOne.withdraw(_amount);
    }
  }

  function _deposit() internal virtual override {
    uint256 alphaBalance = childOne.balanceOf();
    uint256 betaBalance = childTwo.balanceOf();

    if (alphaBalance < betaBalance) {
      want.transfer(address(childOne), want.balanceOf(address(this)));
      childOne.deposit();
    } else {
      want.transfer(address(childTwo), want.balanceOf(address(this)));
      childTwo.deposit();
    }
  }
}
