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

  INode public override childOne;
  IERC20 public immutable override(IStrategyManager, INode) want;

  constructor(INode _root) {
    IERC20 _want = _root.want();
    if (address(_want) == address(0)) revert InvalidWant();
    want = _want;

    ISherlock _core = ISherlock(_root.core());
    if (address(_core) == address(0)) revert InvalidCore();
    sherlockCore = _core;

    childOne = _root;

    emit ChildOneUpdate(INode(address(0)), _root);
    emit SherlockCoreSet(_core);
  }

  /*//////////////////////////////////////////////////////////////
                        TREE STRUCTURE LOGIC
  //////////////////////////////////////////////////////////////*/

  function isMaster() external view override returns (bool) {
    return true;
  }

  function core() public view override returns (address) {
    return address(sherlockCore);
  }

  function parent() external view override returns (IMaster) {
    return IMaster(address(0));
  }

  function childRemoved() external override {
    // not implemented as the system can not function without `childOne` in this contract
    revert NotImplemented(msg.sig);
  }

  function updateChild(INode _node) external override {
    INode _childOne = childOne;

    if (msg.sender != address(_childOne)) revert InvalidSender();
    if (address(_node) == address(0)) revert ZeroArgument();
    if (_node == _childOne) revert InvalidArgument();
    if (address(_node.parent()) != address(this)) revert InvalidParent();
    if (core() != _node.core()) revert InvalidCore();
    if (want != _node.want()) revert InvalidWant();

    childOne = _node;

    emit ChildUpdated(_childOne, _node);
  }

  function updateParent(IMaster _node) external override {
    // not implemented as the parent can not be updated by the tree system
    revert NotImplemented(msg.sig);
  }

  function setInitialParent(IMaster _newParent) external override {
    // not implemented as the parent can not be updated by the tree system
    revert NotImplemented(msg.sig);
  }

  /*//////////////////////////////////////////////////////////////
                        YIELD STRATEGY LOGIC
  //////////////////////////////////////////////////////////////*/

  function balanceOf() public view override(IStrategyManager, INode) returns (uint256) {
    return childOne.balanceOf();
  }

  function deposit() external override(IStrategyManager, INode) whenNotPaused onlySherlockCore {
    want.safeTransfer(address(childOne), want.balanceOf(address(this)));

    childOne.deposit();
  }

  function withdrawAllByAdmin() external override onlyOwner returns (uint256) {
    childOne.withdrawAll();
    want.safeTransfer(address(sherlockCore), want.balanceOf(address(this)));
  }

  function withdrawAll()
    external
    override(IStrategyManager, INode)
    onlySherlockCore
    returns (uint256)
  {
    childOne.withdrawAll();

    want.safeTransfer(msg.sender, want.balanceOf(address(this)));
  }

  function withdrawByAdmin(uint256 _amount) external override onlyOwner {
    childOne.withdraw(_amount);
    want.safeTransfer(address(sherlockCore), _amount);
  }

  function withdraw(uint256 _amount) external override(IStrategyManager, INode) onlySherlockCore {
    childOne.withdraw(_amount);

    want.safeTransfer(msg.sender, _amount);
  }
}
