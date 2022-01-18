// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './ISherlock.sol';

interface IBuySher {
  error InvalidSender();
  error AlreadyUsed();
  error InvalidAmount();
  error ZeroArgument();
  error InvalidState();

  /// @notice Emitted when SHER tokens are bought
  /// @param buyer Account that bought SHER tokens
  /// @param paid How much USDC is paid
  /// @param amount How much SHER tokens are bought
  event Purchase(address indexed buyer, address indexed receiver, uint256 paid, uint256 amount);

  function sher() external view returns (IERC20);

  function usdc() external view returns (IERC20);

  function buy(
    uint256 _sherlockPositionID,
    uint256 _amountOfSher,
    address _sherReceiver
  ) external;

  function deadline() external view returns (uint256);

  function rate() external view returns (uint256);

  function price() external view returns (uint256);

  function sherlockPosition() external view returns (ISherlock);
}
