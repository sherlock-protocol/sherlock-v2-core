// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';

import '../interfaces/euler/IEulerMarkets.sol';
import '../interfaces/euler/IEulerEToken.sol';

// This contract contains logic for depositing staker funds into Aave V2 as a yield strategy
// https://docs.euler.finance/developers/integration-guide#deposit-and-withdraw

contract EulerStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  address constant EULER = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
  IEulerMarkets constant EULER_MARKETS = IEulerMarkets(0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3);
  // https://github.com/euler-xyz/euler-contracts/blob/master/contracts/modules/EToken.sol
  IEulerEToken immutable eUSDC;

  constructor(IMaster _initialParent) BaseNode(_initialParent) {
    want.approve(EULER, type(uint256).max);
    eUSDC = IEulerEToken(EULER_MARKETS.underlyingToEToken(address(want)));
  }

  function setupCompleted() external view override returns (bool) {
    return true;
  }

  function balanceOf() public view override returns (uint256) {
    return eUSDC.balanceOfUnderlying(address(this));
  }

  function _deposit() internal override whenNotPaused {
    eUSDC.deposit(0, type(uint256).max);
  }

  function _withdrawAll() internal override returns (uint256) {
    eUSDC.withdraw(0, type(uint256).max);

    want.safeTransfer(core, want.balanceOf(address(this)));
  }

  function _withdraw(uint256 _amount) internal override {
    if (_amount == type(uint256).max) revert('INVALID');
    eUSDC.withdraw(0, _amount);

    want.safeTransfer(core, _amount);
  }
}
