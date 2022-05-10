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
    uint256 alphaBalance = cachedChildOneBalance;
    uint256 betaBalance = cachedChildTwoBalance;

    // withdraws will send the USDC to core
    if (_amount > alphaBalance) {
      childTwo.withdraw(_amount - childOne.withdrawAll());
    } else {
      childOne.withdraw(_amount);
    }
  }

  function _alphaDeposit(uint256 amount) internal virtual {
    want.transfer(address(childOne), amount);
    childOne.deposit();
  }

  function _betaDeposit(uint256 amount) internal virtual {
    want.transfer(address(childTwo), amount);
    childTwo.deposit();
  }

  function _deposit() internal virtual override {
    uint256 alphaBalance = cachedChildOneBalance;
    uint256 betaBalance = cachedChildTwoBalance;

    if (alphaBalance < betaBalance) {
      _alphaDeposit(want.balanceOf(address(this)));
    } else {
      _betaDeposit(want.balanceOf(address(this)));
    }
  }
}
