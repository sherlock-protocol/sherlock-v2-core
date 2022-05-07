// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './base/BaseStrategy.sol';

import '../interfaces/maple/IPool.sol';

// This contract contains logic for depositing staker funds into maple finance as a yield strategy
// https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol
// https://github.com/maple-labs/maple-core/wiki/Pools

contract MapleStrategy is BaseStrategy {
  using SafeERC20 for IERC20;

  // Current Maven11 USDC pool: 0x6f6c8013f639979c84b756c7fc1500eb5af18dc4
  // https://app.maple.finance/#/earn/pool/0x6f6c8013f639979c84b756c7fc1500eb5af18dc4

  // Current Orthogonal Trading  USDC pool: 0xfebd6f15df3b73dc4307b1d7e65d46413e710c27
  // https://app.maple.finance/#/earn/pool/0xfebd6f15df3b73dc4307b1d7e65d46413e710c27
  IPool public immutable maplePool;

  /// @param _initialParent Contract that will be the parent in the tree structure
  /// @param _maplePool Maple USDC pool
  constructor(IMaster _initialParent, IPool _maplePool) BaseNode(_initialParent) {
    // revert if the pool isn't USDC
    if (_initialParent.want() != _maplePool.liquidityAsset()) revert InvalidArg();
    // revert if the pool isn't public
    if (_maplePool.openToPublic() == false) revert InvalidState();

    // Approve Maple Pool max amount of USDC
    want.safeIncreaseAllowance(address(_maplePool), type(uint256).max);

    // Store maple pool for future usage
    maplePool = _maplePool;
  }

  /// @notice Signal if strategy is ready to be used
  /// @return Boolean indicating if strategy is ready
  function setupCompleted() external view override returns (bool) {
    return true;
  }

  /// @notice View timestamp the deposit matures
  /// @dev After this timestamp admin is able to call `withdraw()` if this contract is in the unstake window
  /// @dev Step 1: call `intendToWithdraw()` on `maturityTime` - `stakerCooldownPeriod`
  /// @dev Step 2: when `maturityTime` is reached, the contract is in the unstake window, call `withdraw()` to unstake USDC
  /// @dev https://etherscan.io/address/0xc234c62c8c09687dff0d9047e40042cd166f3600#readContract
  /// @dev stakerCooldownPeriod uint256 :  864000 (10 days to cooldown)
  /// @dev stakerUnstakeWindow  uint256 :  172800 (2 days to unstake)
  function maturityTime() external view returns (uint256) {
    // Get current deposit date from the maple pool
    // Value uses a weigthed average on multiple deposits
    uint256 date = maplePool.depositDate(address(this));

    // Return 0 if no USDC is deposited into the Maple pool
    if (date == 0) return 0;

    // Deposit will mature when lockup period ends
    return date + maplePool.lockupPeriod();
  }

  /// @notice Deposit all USDC in this contract in Maple
  /// @notice Works under the assumption this contract contains USDC
  /// @dev Weighted average is used for depositDate calculation
  /// @dev https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol#L377
  /// @dev Multiple deposits = weighted average of unlock time https://github.com/maple-labs/maple-core/blob/main/contracts/library/PoolLib.sol#L209
  function _deposit() internal override whenNotPaused {
    // Deposit all USDC into maple
    maplePool.deposit(want.balanceOf(address(this)));
  }

  /// @notice Send all USDC in this contract to core
  /// @notice Funds need to be withdrawn using `withdrawFromMaple()` first
  /// @return amount Amount of USDC withdrawn
  function _withdrawAll() internal override returns (uint256 amount) {
    // Amount of USDC in the contract
    amount = want.balanceOf(address(this));
    // Transfer USDC to core
    if (amount != 0) want.safeTransfer(core, amount);
  }

  /// @notice Send `_amount` USDC in this contract to core
  /// @notice Funds need to be withdrawn using `withdrawFromMaple()` first
  /// @param _amount Amount of USDC to withdraw
  function _withdraw(uint256 _amount) internal override {
    // Transfer USDC to core
    want.safeTransfer(core, _amount);
  }

  /// @notice View USDC in this contract + USDC in Maple
  /// @dev Important the balance is only increasing after a `claim()` call by the pool admin
  /// @dev This means people can get anticipate these `claim()` calls and get a better entry/exit position in the Sherlock pool
  /// @return Amount of USDC in this strategy
  // Ideally `withdrawableFundsOf` would be incrementing every block
  // This value mostly depends on `accumulativeFundsOf` https://github.com/maple-labs/maple-core/blob/main/contracts/token/BasicFDT.sol#L70
  // Where `pointsPerShare` is the main variable used to increase balance https://github.com/maple-labs/maple-core/blob/main/contracts/token/BasicFDT.sol#L92
  // This variable is mutated in the internal `_distributeFunds` function https://github.com/maple-labs/maple-core/blob/main/contracts/token/BasicFDT.sol#L47
  // This internal function is called by the public `updateFundsReceived()` which depends on `_updateFundsTokenBalance()` to be > 0 https://github.com/maple-labs/maple-core/blob/main/contracts/token/BasicFDT.sol#L179
  // This can only be >0 if `interestSum` mutates to a bigger value https://github.com/maple-labs/maple-core/blob/main/contracts/token/PoolFDT.sol#L51
  // The place where `interestSum` is mutated is the `claim()` function restricted by pool admin / delegate https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol#L222
  function balanceOf() public view override returns (uint256) {
    // Source Lucas Manuel | Maple
    return
      want.balanceOf(address(this)) +
      ((maplePool.balanceOf(address(this)) +
        maplePool.withdrawableFundsOf(address(this)) -
        maplePool.recognizableLossesOf(address(this))) / 10**12);
  }

  /// @notice Start cooldown period for Maple withdrawal
  /// @dev Can only be called by owner
  function intendToWithdraw() external onlyOwner {
    maplePool.intendToWithdraw();
  }

  /// @notice Withdraw funds to this contract
  /// @dev Can only be called by owner
  /// @notice Actual USDC amount can be bigger or greater based on losses or gains
  /// @notice If `_amount` == `maplePool.balanceOf(address(this)` / 10*12, it will withdraw the max amount of USDC
  /// @notice If `_amount` < `recognizableLossesOf(this)` the transaction will revert
  /// @notice If `_amount` = `recognizableLossesOf(this)`, it will send `withdrawableFundsOf` USDC
  /// @param _amount Amount of USDC tokens to withdraw
  function withdrawFromMaple(uint256 _amount) external onlyOwner {
    // On withdraw this function is used for the `withdrawableFundsOf()` https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol#L438
    // As it's calling `_prepareWithdraw()` https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol#L472
    // Which is using the `withdrawableFundsOf()` function https://github.com/maple-labs/maple-core/blob/main/contracts/token/BasicFDT.sol#L58
    // These earned funds ar send to this contract https://github.com/maple-labs/maple-core/blob/main/contracts/Pool.sol#L476
    // It will automatically add USDC gains and subtract USDC losses.

    // Exiting 0 tokens doesn't make sense
    if (_amount == 0) revert ZeroArg();

    // Withdraw all USDC
    if (_amount == type(uint256).max) {
      // maplePool = 18 decimals
      // USDC = 6 decimals
      // Dividing by 10**12 to make up the difference
      _amount = maplePool.balanceOf(address(this)) / 10**12;

      // Exiting 0 tokens doesn't make sense
      if (_amount == 0) revert InvalidState();
    }

    maplePool.withdraw(_amount);
  }
}
