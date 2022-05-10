// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';

import '../interfaces/tempus/ITempusController.sol';

// This contract contains logic for depositing staker funds into Tempus as a yield strategy

contract TempusStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  ITempusController constant tempusController =
    ITempusController(0xdB5fD0678eED82246b599da6BC36B56157E4beD8);

  ITempusPool immutable tempusPool;
  ITempusAMM immutable tempusAmm;

  // Account shares in tempusPool, used for exiting
  uint256 private principleShares;

  // https://github.com/tempus-finance/tempus-protocol/blob/master/contracts/ITempusController.sol
  // https://docs.tempus.finance/docs/deployed-contracts
  //

  // Current pool is 0x443297DE16C074fDeE19d2C9eCF40fdE2f5F62C2
  // Current pool amm is 0x811f4F0241A9A4583C052c08BDA7F6339DBb13f7
  constructor(
    IMaster _initialParent,
    ITempusPool _tempusPool,
    ITempusAMM _tempusAmm
  ) BaseNode(_initialParent) {
    tempusPool = _tempusPool;
    // TODO require tempusPool.matured() == false

    tempusAmm = _tempusAmm;
  }

  function setupCompleted() external view override returns (bool) {
    return true;
  }

  function maturityTime() external view returns (uint256) {
    return tempusPool.maturityTime();
  }

  // NOTE `_deposit()` is not used as we need extra arguments for non EVM sandwich deposits

  function _withdrawAll() internal override returns (uint256) {
    // just return usdc
    want.safeTransfer(core, want.balanceOf(address(this)));
  }

  function _withdraw(uint256 _amount) internal override {
    // just return usdc
    want.safeTransfer(core, _amount);
  }

  // https://github.com/tempus-finance/tempus-protocol/blob/master/contracts/ITempusPool.sol#L269
  /// @dev return USDC in this contract + USDC in Tempus
  function _balanceOf() internal view override returns (uint256) {
    return
      want.balanceOf(address(this)) +
      tempusPool.estimatedRedeem(
        principleShares,
        0, /* TODO what should this value be */
        true
      );
  }

  // https://github.com/tempus-finance/tempus-protocol/blob/master/contracts/ITempusController.sol#L165
  function tempusDeposit(
    uint256 _minTYSRate,
    uint256 _deadline,
    uint256 _amount
  ) external whenNotPaused onlyOwner {
    // TODO _amount < usdc.balance(this)

    (, uint256 _principleShares) = tempusController.depositAndFix(
      tempusAmm,
      tempusPool,
      _amount,
      true,
      _minTYSRate,
      _deadline
    );

    principleShares += _principleShares;
  }

  // https://github.com/tempus-finance/tempus-protocol/blob/master/contracts/ITempusController.sol#L249
  function liquidate(uint256 _shares) external onlyOwner {
    // TODO _shares < principleShares

    principleShares -= _shares;

    tempusController.redeemToBacking(
      tempusPool,
      _shares,
      _shares, /* TODO what should this value be */
      address(this)
    );
  }
}
