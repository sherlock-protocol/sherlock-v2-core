// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';

import '../interfaces/truefi/ITrueFiPool2.sol';

// This contract contains logic for depositing staker funds into Aave V2 as a yield strategy

contract TrueFiStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  // https://github.com/trusttoken/contracts-pre22/blob/main/contracts/truefi2/TrueFiPool2.sol
  // https://docs.truefi.io/faq/main-lending-pools/pool#lending-pools-smart-contracts

  ITrueFiPool2 constant tfPool = ITrueFiPool2(0xA991356d261fbaF194463aF6DF8f0464F8f1c742);

  constructor(IMaster _initialParent) BaseNode(_initialParent) {
    want.approve(address(tfPool), type(uint256).max);
  }

  function setupCompleted() external view override returns (bool) {
    return true;
  }

  function _deposit() internal override whenNotPaused {
    tfPool.join(want.balanceOf(address(this)));
  }

  function _withdrawAll() internal override returns (uint256) {
    // just return usdc
    want.safeTransfer(core, want.balanceOf(address(this)));
  }

  function _withdraw(uint256 _amount) internal override {
    // just return usdc
    want.safeTransfer(core, _amount);
  }

  /// @dev return USDC in this contract + USDC in TrueFi
  function balanceOf() public view override returns (uint256) {
    return
      want.balanceOf(address(this)) +
      (tfPool.poolValue() * tfPool.balanceOf(address(this))) /
      tfPool.totalSupply();
  }

  // https://github.com/trusttoken/contracts-pre22/blob/main/contracts/truefi2/TrueFiPool2.sol#L487
  // here's a spreadsheet that shows the exit penalty at different liquidRatio levels ( = liquidValue / poolValue):
  // https://docs.google.com/spreadsheets/d/1ZXGRxunIwe0eYPu7j4QjCwXxe63tNKtpCvRiJnqK0jo/edit#gid=0
  function liquidExit(uint256 _amount) external onlyOwner {
    tfPool.liquidExit(_amount);
  }
}
