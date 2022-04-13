// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './AlphaBetaSplitter.sol';

/// Always withdraw from childOne first
/// Only to deposit to childTwo if childOne balance is lower
contract AlphaBetaEqualDepositSplitter is AlphaBetaSplitter {
  uint256 immutable MIN_AMOUNT_FOR_EQUAL_SPLIT;

  constructor(
    IMaster _initialParent,
    INode _initialChildOne,
    INode _initialChildTwo,
    uint256 _MIN_AMOUNT_FOR_EQUAL_SPLIT
  ) AlphaBetaSplitter(_initialParent, _initialChildOne, _initialChildTwo) {
    MIN_AMOUNT_FOR_EQUAL_SPLIT = _MIN_AMOUNT_FOR_EQUAL_SPLIT;
  }

  function _deposit() internal virtual override {
    uint256 alphaBalance = childOne.balanceOf();
    uint256 betaBalance = childTwo.balanceOf();
    uint256 amount = want.balanceOf(address(this));

    if (amount >= MIN_AMOUNT_FOR_EQUAL_SPLIT) {
      if (alphaBalance < betaBalance) {
        // How much balance does beta have extra?
        uint256 betaBalanceExtra = betaBalance - alphaBalance;
        if (betaBalanceExtra >= amount) {
          // If it's more or equal to amount, deposit all in alpha
          _alphaDeposit(amount);
        } else {
          // It's less, so split between two
          uint256 betaAdd = (amount - betaBalanceExtra) / 2;
          _betaDeposit(betaAdd);
          _alphaDeposit(amount - betaAdd);
        }
      }
    } else {
      AlphaBetaSplitter._deposit();
    }
  }
}
