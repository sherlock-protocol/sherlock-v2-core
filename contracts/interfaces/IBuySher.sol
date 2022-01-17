// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

interface IBuySher {
  function viewFundsNeeded(uint256 _maxSher)
    external
    view
    returns (
      uint256 sherAmount,
      uint256 stake,
      uint256 price
    );

  function buy(
    uint256 _sherlockPositionID,
    uint256 _amountOfSher,
    address _sherReceiver
  ) external;
}
