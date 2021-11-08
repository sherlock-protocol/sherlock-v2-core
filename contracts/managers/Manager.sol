// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/access/Ownable.sol';
import '../interfaces/managers/IManager.sol';

abstract contract Manager is IManager, Ownable {
  ISherlock internal sherlockCore;

  modifier onlySherlockCore() {
    require(msg.sender == address(sherlockCore), 'CORE');
    _;
  }

  function setSherlockCoreAddress(ISherlock _sherlock) external override {
    require(address(sherlockCore) == address(0), 'SET');
    sherlockCore = _sherlock;

    emit SherlockCoreSet(_sherlock);
  }
}
