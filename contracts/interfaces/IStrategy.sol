// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStrategy {
  function want() external view returns (IERC20);

  function withdrawAll() external returns (uint256);

  function withdraw(uint256 _amount) external;

  function deposit() external;

  function balanceOf() external view returns (uint256);

  function sweep(address _receiver, IERC20[] memory _extraTokens) external;
}
