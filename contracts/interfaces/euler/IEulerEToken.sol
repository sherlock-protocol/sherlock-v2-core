// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

interface IEulerEToken {
  function balanceOfUnderlying(address account) external view returns (uint256);

  function balanceOf(address account) external view returns (uint256);

  function withdraw(uint256 subAccountId, uint256 amount) external;

  function deposit(uint256 subAccountId, uint256 amount) external;
}
