// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/IStrategyManager.sol';

import '../interfaces/aaveV2/ILendingPool.sol';
import '../interfaces/aaveV2/ILendingPoolAddressesProvider.sol';
import '../interfaces/aaveV2/IAaveIncentivesController.sol';
import '../interfaces/aaveV2/IStakeAave.sol';
import '../interfaces/aaveV2/IAToken.sol';

contract AaveV2StrategyManager is IStrategyManager, Manager {
  using SafeERC20 for IERC20;

  ILendingPoolAddressesProvider public constant lpAddressProvider =
    ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
  IAaveIncentivesController public immutable aaveIncentivesController;

  IERC20 public immutable override want;
  IAToken public immutable aWant;

  address public immutable aaveLmReceiver;

  constructor(IAToken _aWant, address _aaveLmReceiver) {
    aWant = _aWant;
    want = IERC20(_aWant.UNDERLYING_ASSET_ADDRESS());
    aaveIncentivesController = _aWant.getIncentivesController();

    aaveLmReceiver = _aaveLmReceiver;
  }

  function getLp() internal view returns (ILendingPool) {
    return ILendingPool(lpAddressProvider.getLendingPool());
  }

  function balanceOf() public view override returns (uint256) {
    return aWant.balanceOf(address(this));
  }

  function deposit() external override {
    ILendingPool lp = getLp();
    uint256 amount = want.balanceOf(address(this));
    require(amount != 0, 'ZERO_AMOUNT');

    if (want.allowance(address(this), address(lp)) < amount) {
      want.safeApprove(address(lp), type(uint256).max);
    }

    lp.deposit(address(want), amount, address(this), 0);
  }

  function withdrawAll() external override onlySherlockCore returns (uint256) {
    ILendingPool lp = getLp();
    if (balanceOf() == 0) {
      return 0;
    }
    return lp.withdraw(address(want), type(uint256).max, msg.sender);
  }

  function withdraw(uint256 _amount) external override onlySherlockCore {
    require(_amount != type(uint256).max, 'MAX');

    ILendingPool lp = getLp();
    require(lp.withdraw(address(want), _amount, msg.sender) == _amount, 'AAVE');
  }

  function claimRewards() external {
    address[] memory assets = new address[](1);
    assets[0] = address(aWant);

    aaveIncentivesController.claimRewards(assets, type(uint256).max, aaveLmReceiver);
  }

  function isActive() public returns (bool) {
    // todo managing strategy should have the strategy() interface and return address(this)
    return address(sherlockCore.strategy()) == address(this);
  }

  function sweep(address _receiver, IERC20[] memory _extraTokens) external onlyOwner {
    require(!isActive());
    _sweep(_receiver, _extraTokens);
  }
}
