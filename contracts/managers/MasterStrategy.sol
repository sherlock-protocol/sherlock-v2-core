// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/IStrategyManager.sol';
import '../interfaces/strategy/IStrategy.sol';
import '../interfaces/strategy/INode.sol';

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract MasterStrategy is IStrategyManager, IMaster, Manager {
  using SafeERC20 for IERC20;

  INode root;
  IERC20 public immutable override(IStrategyManager, INode) want;

  constructor(INode _root, ISherlock _sherlock) {
    root = _root;
    want = _root.want();

    sherlockCore = _sherlock;
    emit SherlockCoreSet(_sherlock);
  }

  function isMaster() external view override returns (bool) {
    return true;
  }

  function balanceOf() public view override(IStrategyManager, INode) returns (uint256) {
    return root.balanceOf();
  }

  function deposit() external override(IStrategyManager, INode) whenNotPaused onlySherlockCore {
    want.safeTransfer(address(root), want.balanceOf(address(this)));

    root.deposit();
  }

  function withdrawAllByAdmin() external override onlyOwner returns (uint256) {
    root.withdrawAll();
    want.safeTransfer(address(sherlockCore), want.balanceOf(address(this)));
  }

  function withdrawAll()
    external
    override(IStrategyManager, INode)
    onlySherlockCore
    returns (uint256)
  {
    root.withdrawAll();

    want.safeTransfer(msg.sender, want.balanceOf(address(this)));
  }

  function withdrawByAdmin(uint256 _amount) external override onlyOwner {
    root.withdraw(_amount);
    want.safeTransfer(address(sherlockCore), _amount);
  }

  function withdraw(uint256 _amount) external override(IStrategyManager, INode) onlySherlockCore {
    root.withdraw(_amount);

    want.safeTransfer(msg.sender, _amount);
  }

  function childRemoved() external override {
    revert('CANT_REMOVE_ROOT');
  }

  function core() external view override returns (address) {
    return address(sherlockCore);
  }

  function parent() external view override returns (ISplitter) {
    return ISplitter(address(0));
  }

  function updateChild(INode _node) external override {
    if (msg.sender != address(root)) revert InvalidSender();
    emit ChildUpdated(root, _node);
    root = _node;
  }

  function updateParent(ISplitter _node) external override {
    revert('CANT_UPDATE_MASTER_PARENT');
  }

  function setInitialParent(ISplitter _newParent) external override {
    revert('CANT_SET_PARENT');
  }
}
