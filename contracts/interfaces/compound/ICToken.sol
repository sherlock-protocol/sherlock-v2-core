// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/**
 * Interface for Compound's cToken.
 */

interface ICToken is IERC20 {
  function mint(uint256) external returns (uint256);

  function exchangeRateCurrent() external returns (uint256);

  function supplyRatePerBlock() external returns (uint256);

  function redeem(uint256) external returns (uint256);

  function redeemUnderlying(uint256) external returns (uint256);
}
