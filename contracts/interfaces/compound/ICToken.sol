// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * Interface for Compound's cToken.
 */

interface ICToken is IERC20 {
  function mint(uint256) external virtual returns (uint256);

  function borrow(uint256) external virtual returns (uint256);

  function underlying() external view virtual returns (ERC20);

  function totalBorrows() external view virtual returns (uint256);

  function totalFuseFees() external view virtual returns (uint256);

  function repayBorrow(uint256) external virtual returns (uint256);

  function totalReserves() external view virtual returns (uint256);

  function exchangeRateCurrent() external virtual returns (uint256);

  function totalAdminFees() external view virtual returns (uint256);

  function fuseFeeMantissa() external view virtual returns (uint256);

  function adminFeeMantissa() external view virtual returns (uint256);

  function exchangeRateStored() external view virtual returns (uint256);

  function accrualBlockNumber() external view virtual returns (uint256);

  function redeemUnderlying(uint256) external virtual returns (uint256);

  function balanceOfUnderlying(address) external virtual returns (uint256);

  function reserveFactorMantissa() external view virtual returns (uint256);

  function borrowBalanceCurrent(address) external virtual returns (uint256);

  function interestRateModel() external view virtual returns (InterestRateModel);

  function initialExchangeRateMantissa() external view virtual returns (uint256);

  function repayBorrowBehalf(address, uint256) external virtual returns (uint256);
}
