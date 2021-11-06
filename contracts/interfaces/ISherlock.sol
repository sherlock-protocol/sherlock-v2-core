// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import './ISherlockStake.sol';
import './ISherlockGov.sol';
import './ISherlockPayout.sol';
import './ISherlockNonStakerRewards.sol';
import './ISherlockStrategy.sol';

interface ISherlock is
  ISherlockStake,
  ISherlockGov,
  ISherlockPayout,
  ISherlockNonStakerRewards,
  ISherlockStrategy,
  IERC721
{}
