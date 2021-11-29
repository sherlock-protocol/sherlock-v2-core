// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

interface ISherlockClaimManagerCallbackReceiver {
    function PreCorePayoutCallback(bytes32 _protocol, uint256 _claimID, uint256 _amount) external;
}
