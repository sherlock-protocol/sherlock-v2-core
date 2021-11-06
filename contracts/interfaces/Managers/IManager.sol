// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

interface IManager {
  event SherlockCoreSet(address sherlock);

  /// @notice Set sherlock core address where premiums should be send too
  /// @param _sherlock Current core contract
  /// @dev One time function, will revert once `_sherlock` != address(0)
  /// @dev This contract will be deployed first, passed on as argument in core constuctor
  /// @dev ^ that's needed for tvl accounting, once core is deployed this function is called
  /// @dev throws `SherlockCoreSet`
  function setSherlockCoreAddress(address _sherlock) external;
}
