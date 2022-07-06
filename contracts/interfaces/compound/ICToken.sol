// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import { InterestRateModel } from './InterestRateModel.sol';

/**
 * Interface for Compound's cToken.
 */

interface ICToken is IERC20 {
  function mint(uint256) external returns (uint256);

  function borrow(uint256) external returns (uint256);

  function underlying() external view returns (IERC20);

  function totalBorrows() external view returns (uint256);

  function totalFuseFees() external view returns (uint256);

  function repayBorrow(uint256) external returns (uint256);

  function totalReserves() external view returns (uint256);

  function exchangeRateCurrent() external returns (uint256);

  function totalAdminFees() external view returns (uint256);

  function fuseFeeMantissa() external view returns (uint256);

  function adminFeeMantissa() external view returns (uint256);

  function exchangeRateStored() external view returns (uint256);

  function accrualBlockNumber() external view returns (uint256);

  function redeem(uint256) external returns (uint256);

  function redeemUnderlying(uint256) external returns (uint256);

  function balanceOfUnderlying(address) external returns (uint256);

  function reserveFactorMantissa() external view returns (uint256);

  function borrowBalanceCurrent(address) external returns (uint256);

  function interestRateModel() external view returns (InterestRateModel);

  function initialExchangeRateMantissa() external view returns (uint256);

  function repayBorrowBehalf(address, uint256) external returns (uint256);
}
