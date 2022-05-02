// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

interface IEulerMarkets {
  function underlyingToEToken(address underlying) external view returns (address);
}
