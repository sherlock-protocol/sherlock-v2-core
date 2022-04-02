// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../strategy/base/BaseStrategy.sol';

abstract contract StrategyMock {
  function mockUpdateChild(IMaster _parent, INode _newNode) external {
    _parent.updateChild(_newNode);
  }
}

contract TreeStrategyMock is StrategyMock, BaseStrategy {
  event WithdrawAll();
  event Withdraw(uint256 amount);
  event Deposit();

  constructor(IMaster _initialParent) BaseNode(_initialParent) {}

  function balanceOf() public view override returns (uint256) {
    return want.balanceOf(address(this));
  }

  function _withdrawAll() internal override returns (uint256 amount) {
    amount = balanceOf();
    want.transfer(msg.sender, amount);

    emit WithdrawAll();
  }

  function _withdraw(uint256 _amount) internal override {
    want.transfer(msg.sender, _amount);

    emit Withdraw(_amount);
  }

  function _deposit() internal override {
    emit Deposit();
  }

  function mockSetParent(IMaster _newParent) external {
    parent = _newParent;
  }
}

contract TreeStrategyMockCustom is StrategyMock, IStrategy {
  address public override core;
  IERC20 public override want;
  IMaster public override parent;
  uint256 public depositCalled;
  uint256 public withdrawCalled;
  uint256 public withdrawByAdminCalled;
  uint256 public withdrawAllCalled;
  uint256 public withdrawAllByAdminCalled;

  function balanceOf() external view override returns (uint256) {}

  function setCore(address _core) external {
    core = _core;
  }

  function setWant(IERC20 _want) external {
    want = _want;
  }

  function setParent(IMaster _parent) external {
    parent = _parent;
  }

  function deposit() external override {
    depositCalled++;
  }

  function remove() external override {}

  function replace(INode _node) external override {}

  function replaceAsChild(ISplitter _node) external override {}

  function replaceForce(INode _node) external override {}

  function updateParent(IMaster _node) external override {}

  function withdraw(uint256 _amount) external override {
    withdrawCalled++;
  }

  function withdrawAll() external override returns (uint256) {
    withdrawAllCalled++;
    return type(uint256).max;
  }

  function withdrawAllByAdmin() external override returns (uint256) {
    withdrawAllByAdminCalled++;
  }

  function withdrawByAdmin(uint256 _amount) external override {
    withdrawByAdminCalled++;
  }
}