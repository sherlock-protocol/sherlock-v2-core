// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';

import '../interfaces/euler/IEulerMarkets.sol';
import '../interfaces/euler/IEulerEToken.sol';

// This contract contains logic for depositing staker funds into Euler as a yield strategy
// https://docs.euler.finance/developers/integration-guide#deposit-and-withdraw

// TODO ask about EUL tokens

contract EulerStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  // Sub account used for Euler interactions
  uint256 private constant SUB_ACCOUNT = 0;

  // https://docs.euler.finance/protocol/addresses
  address constant EULER = 0x27182842E098f60e3D576794A5bFFb0777E025d3;
  IEulerMarkets constant EULER_MARKETS = IEulerMarkets(0x3520d5a913427E6F0D6A83E07ccD4A4da316e4d3);
  // https://github.com/euler-xyz/euler-contracts/blob/master/contracts/modules/EToken.sol
  IEulerEToken immutable eUSDC;

  /// @param _initialParent contract that will be the parent in the tree structure
  constructor(IMaster _initialParent) BaseNode(_initialParent) {
    want.approve(EULER, type(uint256).max);
    eUSDC = IEulerEToken(EULER_MARKETS.underlyingToEToken(address(want)));
  }

  /// @notice signal if strategy is ready to be used
  function setupCompleted() external view override returns (bool) {
    return true;
  }

  /// @dev will return wrong balance if this contract somehow has USDC instead of only eUSDC
  function balanceOf() public view override returns (uint256) {
    return eUSDC.balanceOfUnderlying(address(this));
  }

  /// @notice Deposit all USDC in this contract in Euler
  function _deposit() internal override whenNotPaused {
    // Deposit all current balance into euler
    // https://github.com/euler-xyz/euler-contracts/blob/master/contracts/modules/EToken.sol#L148
    eUSDC.deposit(SUB_ACCOUNT, type(uint256).max);
  }

  /// @notice Withdraw all USDC from Euler and send to core
  function _withdrawAll() internal override returns (uint256) {
    // Withdraw all underlying using max, this will translate to the full balance
    // https://github.com/euler-xyz/euler-contracts/blob/master/contracts/BaseLogic.sol#L387
    eUSDC.withdraw(SUB_ACCOUNT, type(uint256).max);

    // Transfer USDC to core
    want.safeTransfer(core, want.balanceOf(address(this)));
  }

  /// @notice Withdraw `_amount` USDC from Euler and send to core
  /// @param _amount Amount of USDC to withdraw
  function _withdraw(uint256 _amount) internal override {
    // Don't allow to withdraw max (reserved with withdrawAll call)
    if (_amount == type(uint256).max) revert InvalidArg();

    // Call withdraw with underlying amount of tokens (USDC instead of eUSDC)
    // https://github.com/euler-xyz/euler-contracts/blob/master/contracts/modules/EToken.sol#L177
    eUSDC.withdraw(SUB_ACCOUNT, _amount);

    // Transfer USDC to core
    want.safeTransfer(core, _amount);
  }
}
