// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Fran Rimoldi <dev@sherlock.xyz> (https://twitter.com/fran_rimoldi)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';
import '../interfaces/compound/ICToken.sol';
import { FixedPointMathLib } from 'solmate/utils/FixedPointMathLib.sol';

/**
 * This contract implements the logic to deposit and withdraw
 * funds from Compund as a yield strategy.
 * @see https://compound.finance/docs
 */

contract CompoundStrategy is BaseStrategy {
  using SafeERC20 for IERC20;
  using FixedPointMathLib for uint256;

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
   * @notice Return the contract's want(USDC) balance.
   * note exchange rate isn't 1:1 between cToken and underlying asset.
   */
  function balanceOf() public view override returns (uint256) {
    return cWant.balanceOf(address(this)).mulWadDown(_viewExchangeRate());
  }

  /**
   * @notice Deposit the entire contract's balance into Compound.
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
   * @notice Withdraw the entire cWant balance from Compound.
   * @see _withdraw(uint256).
   */
  function _withdrawAll() internal override returns (uint256) {
    amount = balanceOf();

    return _withdraw(amount);
  }

  /**
   * @notice Withdraw a specific cWant amount from Compound.
   */
  function _withdraw(uint256 amount) internal override returns (uint256) {
    if (amount == 0) {
      return 0;
    }

    if (cWant.redeem(amount) != 0) revert InvalidState();

    return amount;
  }

  /**
   * @notice Calculate cToken to underlying asset exchange rate without mutating state.
   * note based on transmissions11's lib (https://github.com/transmissions11/libcompound)
   */
  function _viewExchangeRate() internal view returns (uint256) {
    uint256 accrualBlockNumberPrior = cWant.accrualBlockNumber();

    if (accrualBlockNumberPrior == block.number) return cWant.exchangeRateStored();

    uint256 totalCash = want.balanceOf(address(cWant));
    uint256 borrowsPrior = cWant.totalBorrows();
    uint256 reservesPrior = cWant.totalReserves();

    uint256 borrowRateMantissa = cWant.interestRateModel().getBorrowRate(
      totalCash,
      borrowsPrior,
      reservesPrior
    );

    if (borrowRateMantissa <= 0.0005e16) revert InvalidState();

    uint256 interestAccumulated = (borrowRateMantissa * (block.number - accrualBlockNumberPrior))
      .mulWadDown(borrowsPrior);

    uint256 totalReserves = cWant.reserveFactorMantissa().mulWadDown(interestAccumulated) +
      reservesPrior;
    uint256 totalBorrows = interestAccumulated + borrowsPrior;
    uint256 totalSupply = cWant.totalSupply();

    return
      totalSupply == 0
        ? cWant.initialExchangeRateMantissa()
        : (totalCash + totalBorrows - totalReserves).divWadDown(totalSupply);
  }
}
