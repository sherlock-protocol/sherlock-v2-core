// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../../interfaces/strategy/INode.sol';

abstract contract BaseNode is INode, INodeReplaceable, Ownable {
  using SafeERC20 for IERC20;

  ISplitter public override parent;
  IERC20 public immutable override want;
  address public immutable override core;

  constructor(ISplitter _parent) {
    parent = _parent;
    want = parent.want();
    core = parent.core();
  }

  modifier onlyParent() {
    if (msg.sender != address(parent)) revert('NOT_PARENT');
    _;
  }

  modifier onlyCore() {
    if (msg.sender != address(core)) revert('NOT_CORE');
    _;
  }

  function _isChild(ISplitter _parent, INode _child) internal view returns (bool) {
    if (_parent.childOne() == _child) return true;
    if (_parent.childTwo() == _child) return true;

    return false;
  }

  function withdrawAll() external override onlyParent returns (uint256 amount) {
    amount = _withdrawAll();
  }

  function withdrawAllByAdmin() external override onlyOwner returns (uint256 amount) {
    amount = _withdrawAll();
  }

  function withdraw(uint256 _amount) external override onlyParent {
    _withdraw(_amount);
  }

  function withdrawByAdmin(uint256 _amount) external override onlyOwner {
    _withdraw(_amount);
  }

  function deposit() external override onlyParent {
    _deposit();
  }

  // TOOD make sure it's not referencing itself
  function replaceAsChild(ISplitter _node) external virtual override onlyOwner {
    // Verify if (this) is a child of `_node`
    if (_isChild(_node, INode(address(this))) == false) revert('NOT_CHILD');

    // Verify if this.parent is the same as _node.parent
    // Make sure the child recognizes the parent
    if (parent != _node.parent()) revert('PARENT');

    // Make sure the parent recognizes the new child
    parent.updateChild(_node);
  }

  // TOOD make sure it's not referencing itself
  function updateParent(ISplitter _node) external virtual override onlyParent {
    if (parent == _node) revert('SAME');
    parent = _node;
  }

  function _withdrawAll() internal virtual returns (uint256 amount) {}

  function _withdraw(uint256 _amount) internal virtual {}

  function _deposit() internal virtual {}
}
