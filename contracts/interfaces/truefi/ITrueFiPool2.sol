// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

interface ITrueLender2Deprecated {}

interface IFixedTermLoanAgency {}

interface ILoanToken2Deprecated {}

interface IDebtToken {}

interface ITrueFiPoolOracle {}

interface ISAFU {}

interface ILoanFactory2 {}

interface ITrueFiPool2 is IERC20 {
  function initialize(
    ERC20 _token,
    IFixedTermLoanAgency _ftlAgency,
    ISAFU safu,
    ILoanFactory2 _loanFactory,
    address __owner
  ) external;

  function singleBorrowerInitialize(
    ERC20 _token,
    IFixedTermLoanAgency _ftlAgency,
    ISAFU safu,
    ILoanFactory2 _loanFactory,
    address __owner,
    string memory borrowerName,
    string memory borrowerSymbol
  ) external;

  function token() external view returns (ERC20);

  function oracle() external view returns (ITrueFiPoolOracle);

  function poolValue() external view returns (uint256);

  /**
   * @dev Ratio of liquid assets in the pool after lending
   * @param afterAmountLent Amount of asset being lent
   */
  function liquidRatio(uint256 afterAmountLent) external view returns (uint256);

  /**
   * @dev Join the pool by depositing tokens
   * @param amount amount of tokens to deposit
   */
  function join(uint256 amount) external;

  /**
   * @dev borrow from pool
   * 1. Transfer TUSD to sender
   * 2. Only lending pool should be allowed to call this
   */
  function borrow(uint256 amount) external;

  /**
   * @dev pay borrowed money back to pool
   * 1. Transfer TUSD from sender
   * 2. Only lending pool should be allowed to call this
   */
  function repay(uint256 currencyAmount) external;

  function liquidateLegacyLoan(ILoanToken2Deprecated loan) external;

  /**
   * @dev SAFU buys DebtTokens from the pool
   */
  function liquidateDebt(IDebtToken debtToken) external;

  function addDebt(IDebtToken debtToken, uint256 amount) external;

  function liquidExit(uint256 amount) external;

  function liquidExitPenalty(uint256 amount) external view returns (uint256);
}
