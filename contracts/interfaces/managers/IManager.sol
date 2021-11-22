// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../ISherlock.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IManager {
  error ZeroArgument();

  error InvalidArgument();

  error InvalidConditions();

  event SherlockCoreSet(ISherlock sherlock);

  /// @notice Set sherlock core address where premiums should be send too
  /// @param _sherlock Current core contract
  /// @dev One time function, will revert once `sherlock` != address(0)
  /// @dev This contract will be deployed first, passed on as argument in core constuctor
  /// @dev ^ that's needed for tvl accounting, once core is deployed this function is called
  /// @dev throws `SherlockCoreSet`
  function setSherlockCoreAddress(ISherlock _sherlock) external;
}
