// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './AlphaBetaEqualDepositSplitter.sol';

/// Always withdraw from childOne first
/// Only to deposit to childTwo if childOne balance is lower
contract AlphaBetaEqualDepositMaxSplitter is AlphaBetaEqualDepositSplitter {
  uint256 immutable MAX_AMOUNT_FOR_ALPHA;
  uint256 immutable MAX_AMOUNT_FOR_BETA;

  constructor(
    IMaster _initialParent,
    INode _initialChildOne,
    INode _initialChildTwo,
    uint256 _MIN_AMOUNT_FOR_EQUAL_SPLIT,
    uint256 _MAX_AMOUNT_FOR_ALPHA,
    uint256 _MAX_AMOUNT_FOR_BETA
  )
    AlphaBetaEqualDepositSplitter(
      _initialParent,
      _initialChildOne,
      _initialChildTwo,
      _MIN_AMOUNT_FOR_EQUAL_SPLIT
    )
  {
    if (_MAX_AMOUNT_FOR_ALPHA != 0 && _MAX_AMOUNT_FOR_BETA != 0) revert('BOTH_LIMIT');

    MAX_AMOUNT_FOR_ALPHA = _MAX_AMOUNT_FOR_ALPHA;
    MAX_AMOUNT_FOR_BETA = _MAX_AMOUNT_FOR_BETA;
  }

  function _alphaDeposit(uint256 amount) internal virtual override {
    uint256 alphaBalance = childOne.balanceOf();

    if (MAX_AMOUNT_FOR_ALPHA == 0) {
      // Deposit all in alpha
      AlphaBetaSplitter._alphaDeposit(amount);
    }
    // Do we want to deposit into alpha at all?
    else if (alphaBalance < MAX_AMOUNT_FOR_ALPHA) {
      // Deposit total amount will be too much!
      if (alphaBalance + amount > MAX_AMOUNT_FOR_ALPHA) {
        uint256 alphaAmount = MAX_AMOUNT_FOR_ALPHA - alphaBalance;
        AlphaBetaSplitter._alphaDeposit(alphaAmount);

        // Deposit rest in beta
        AlphaBetaSplitter._betaDeposit(amount - alphaAmount);
      } else {
        // Deposit all in alpha
        AlphaBetaSplitter._alphaDeposit(amount);
      }
    } else {
      // Deposit all in beta
      AlphaBetaSplitter._betaDeposit(amount);
    }
  }

  function _betaDeposit(uint256 amount) internal virtual override {
    uint256 betaBalance = childTwo.balanceOf();

    if (MAX_AMOUNT_FOR_BETA == 0) {
      // Deposit all in beta
      AlphaBetaSplitter._betaDeposit(amount);
    }
    // Do we want to deposit into beta at all?
    else if (betaBalance < MAX_AMOUNT_FOR_BETA) {
      // Deposit total amount will be too much!
      if (betaBalance + amount > MAX_AMOUNT_FOR_BETA) {
        uint256 betaAmount = MAX_AMOUNT_FOR_BETA - betaBalance;
        AlphaBetaSplitter._betaDeposit(betaAmount);

        // Deposit rest in alpha
        AlphaBetaSplitter._alphaDeposit(amount - betaAmount);
      } else {
        // Deposit all in beta
        AlphaBetaSplitter._betaDeposit(amount);
      }
    } else {
      // Deposit all in alpha
      AlphaBetaSplitter._alphaDeposit(amount);
    }
  }
}
