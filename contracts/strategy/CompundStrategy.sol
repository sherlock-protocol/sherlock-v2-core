// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Fran Rimoldi <dev@sherlock.xyz> (https://twitter.com/fran_rimoldi)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';
import '../interfaces/compound/ICToken.sol';
import { FixedPointMathLib } from '@rari-capital/solmate/src/utils/FixedPointMathLib.sol';

/**
 * This contract implements the logic to deposit and withdraw
 * funds from Compund as a yield strategy.
 *
 * Docs: https://compound.finance/docs
 */

contract CompoundStrategy is BaseStrategy {
  using SafeERC20 for IERC20;
  using FixedPointMathLib for uint256;

  // This is the receipt token Compound gives in exchange for a token deposit (cUSDC)
  // https://compound.finance/docs#protocol-math

  address constant CUSDC = 0x39AA39c021dfbaE8faC545936693aC917d5E7563;
  ICToken immutable cUSDC;

  constructor(IMaster _initialParent) BaseNode(_initialParent) {
    cUSDC = ICToken(CUSDC);
  }

  function setupCompleted() external view override returns (bool) {
    return true;
  }

  /**
   * @notice Return the contract's want(USDC) balance.
   * @dev Since balanceOf() is pure, we can't use Compound's balanceOfUnderlying(adress) function
   * We calculate the exchange rate ourselves instead.
   */
  function balanceOf() public view override returns (uint256) {
    return cUSDC.balanceOf(address(this)).mulWadDown(_viewExchangeRate());
  }

  /**
   * @notice Deposit the entire contract's want(USDC) balance into Compound.
   */
  function _deposit() internal override whenNotPaused {
    uint256 amount = want.balanceOf(address(this));

    if (want.allowance(address(this), address(cUSDC)) < amount) {
      want.safeIncreaseAllowance(address(cUSDC), amount);
    }

    // https://compound.finance/docs/ctokens#mint
    if (cUSDC.mint(amount) != 0) revert InvalidState();
  }

  /**
   * @notice Withdraw the entire underlying asset balance from Compound.
   */
  function _withdrawAll() internal override returns (uint256 amount) {
    amount = balanceOf();
    _withdraw(amount);
  }

  /**
   * @notice Withdraw a specific underlying asset amount from Compound.
   */
  function _withdraw(uint256 amount) internal override {
    if (amount == 0) revert ZeroArg();

    if (cUSDC.redeemUnderlying(amount) != 0) revert InvalidState();

    want.safeTransfer(core, amount);
  }

  /**
   * @notice Calculate cToken to underlying asset exchange rate without mutating state.
   * @dev based on transmissions11's lib (https://github.com/transmissions11/libcompound)
   */
  function _viewExchangeRate() internal view returns (uint256) {
    uint256 accrualBlockNumberPrior = cUSDC.accrualBlockNumber();

    if (accrualBlockNumberPrior == block.number) return cUSDC.exchangeRateStored();

    uint256 totalCash = want.balanceOf(address(cUSDC));
    uint256 borrowsPrior = cUSDC.totalBorrows();
    uint256 reservesPrior = cUSDC.totalReserves();

    uint256 borrowRateMantissa = cUSDC.interestRateModel().getBorrowRate(
      totalCash,
      borrowsPrior,
      reservesPrior
    );

    // This value is the same set as borrowRateMaxMantissa in CtokenInterfaces.sol
    // https://github.com/compound-finance/compound-protocol/blob/3affca87636eecd901eb43f81a4813186393905d/contracts/CTokenInterfaces.sol#L32
    if (borrowRateMantissa > 0.0005e16) revert InvalidState();

    uint256 interestAccumulated = (borrowRateMantissa * (block.number - accrualBlockNumberPrior))
      .mulWadDown(borrowsPrior);

    uint256 totalReserves = cUSDC.reserveFactorMantissa().mulWadDown(interestAccumulated) +
      reservesPrior;
    uint256 totalBorrows = interestAccumulated + borrowsPrior;
    uint256 totalSupply = cUSDC.totalSupply();

    return
      totalSupply == 0
        ? cUSDC.initialExchangeRateMantissa()
        : (totalCash + totalBorrows - totalReserves).divWadDown(totalSupply);
  }
}
