// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';

import '../interfaces/maple/IPool.sol';

// This contract contains logic for depositing staker funds into Aave V2 as a yield strategy
// https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol
// https://github.com/maple-labs/maple-core/wiki/Pools
contract MapleStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  // Current Maven11 pool:L 0x6f6c8013f639979c84b756c7fc1500eb5af18dc4, source: discord chat
  IPool immutable maplePool;

  constructor(IMaster _initialParent, IPool _maplePool) BaseNode(_initialParent) {
    maplePool = _maplePool;
  }

  function setupCompleted() external view override returns (bool) {
    return true;
  }

  /// @dev after this timestamp admin is able to call `withdraw()`
  /// @dev intendToWithdraw can be called before this
  // https://etherscan.io/address/0xc234c62c8c09687dff0d9047e40042cd166f3600#readContract
  // uint256 :  864000
  // uint256 :  172800
  // 10 days to cooldown
  // 2 days to get the money out
  function maturityTime() external view returns (uint256) {
    return maplePool.depositDate(address(this)) + maplePool.lockupPeriod();
  }

  // TODO write function that exposes first timestamp we are able to start cooldown and gives us 2 days to take it out?

  // https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol#L377
  // Multiple deposits = weighted average of unlock time https://github.com/maple-labs/maple-core/blob/main/contracts/library/PoolLib.sol#L209
  function _deposit() internal override whenNotPaused {
    maplePool.deposit(want.balanceOf(address(this)));
  }

  function _withdrawAll() internal override returns (uint256) {
    // just return usdc
    // TODO return USDC + try to maplePool withdraw?
    want.safeTransfer(core, want.balanceOf(address(this)));
  }

  function _withdraw(uint256 _amount) internal override {
    // just return usdc
    // TODO return USDC + try to maplePool withdraw?
    want.safeTransfer(core, _amount);
  }

  function balanceOf() public view override returns (uint256) {
    // Source Lucas Manuel | Maple
    return
      want.balanceOf(address(this)) +
      maplePool.balanceOf(address(this)) +
      maplePool.withdrawableFundsOf(address(this)) -
      maplePool.recognizableLossesOf(address(this));
  }

  function intendToWithdraw() external onlyOwner {
    maplePool.intendToWithdraw();
  }

  function withdraw(uint256 amount) external onlyOwner {
    // Will be either pool.balanceOf(address(user)) + pool.withdrawableFundsOf(address(user))
    // Or pool.balanceOf(address(user))
    // Or pool.withdrawableFundsOf(address(user)
    // to withdraw all

    // I think it is pool.balanceOf(address(user)) as the LP tokens represent your principle + yield

    // Potential losses are subtracted https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol#L442
    maplePool.withdraw(amount);
  }
}
