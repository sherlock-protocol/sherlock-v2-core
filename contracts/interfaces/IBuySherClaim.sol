// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

interface IBuySherClaim {
  error InvalidSender();
  error AlreadyUsed();
  error InvalidAmount();
  error ZeroArgument();
  error InvalidState();

  function add(address _user, uint256 _amount) external;
}
