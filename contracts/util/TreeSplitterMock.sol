// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../strategy/base/BaseSplitter.sol';

contract TreeSplitterMock is BaseSplitter {
  constructor(INode _childOne, INode _childTwo) BaseSplitter(_childOne, _childTwo) {}

  function _withdraw(uint256 _amount) internal virtual override {
    if (_amount % (2 * 10**6) == 0) {
      // if USDC amount is even
      childOne.withdraw(_amount);
    } else if (_amount % (1 * 10**6) == 0) {
      // if USDC amount is uneven
      childTwo.withdraw(_amount);
    } else {
      // if USDC has decimals
      revert('WITHDRAW');
    }
  }

  function _deposit() internal virtual override {
    uint256 balance = want.balanceOf(address(this));

    if (balance % (2 * 10**6) == 0) {
      // if USDC amount is even
      want.transfer(address(childOne), balance);
      childOne.deposit();
    } else if (balance % (1 * 10**6) == 0) {
      // if USDC amount is uneven
      want.transfer(address(childTwo), balance);
      childTwo.deposit();
    } else {
      // if USDC has decimals
      revert('DEPOSIT');
    }
  }
}
