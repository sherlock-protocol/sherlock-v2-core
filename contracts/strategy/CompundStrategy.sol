// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Fran Rimoldi <dev@sherlock.xyz> (https://twitter.com/fran_rimoldi)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';
import '../interfaces/compound/ICToken.sol';

/**
 * This contract implements the logic to deposit and withdraw
 * funds from Compund as a yield strategy.
 * @see https://compound.finance/docs
 */

contract CompoundStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  // This is the receipt token Compound gives in exchange for a token deposit (cUSDC)
  // @see https://compound.finance/docs#protocol-math
  ICToken public immutable cWant;

  constructor(IMaster _initialParent, ICToken _cWant) BaseNode(_initialParent) {
    if (address(_cWant) == address(0)) revert ZeroArg();

    cWant = _cWant;
  }

  function setupCompleted() external view override returns (bool) {
    return true;
  }

  /**
   * Returns the contract's cWant balance.
   */
  function balanceOf() public view override returns (uint256) {
    return cWant.balanceOf(address(this));
  }

  /**
   * Deposits the entire contract's balance into Compound.
   */
  function _deposit() internal override whenNotPaused {
    uint256 amount = want.balanceOf(address(this));
    if (amount == 0) revert InvalidState();

    if (want.allowance(address(this), address(cWant)) < amount) {
      want.safeIncreaseAllowance(address(cWant), type(uint256).max);
    }

    cWant.mint(amount);
  }

  /**
   * Withdraws the entire cWant balance from Compound.
   * @see _withdraw(uint256).
   */
  function _withdrawAll() internal override returns (uint256) {
    amount = balanceOf();

    return _withdraw(amount);
  }

  /**
   * Withdraws a specific cWant amount from Compound.
   */
  function _withdraw(uint256 amount) internal override returns (uint256) {
    if (amount == 0) {
      return 0;
    }

    if (cWant.redeem(amount) != 0) revert InvalidState();

    return amount;
  }
}
