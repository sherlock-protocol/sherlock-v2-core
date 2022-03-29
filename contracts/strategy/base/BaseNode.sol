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

  function withdrawAll() external override onlyParent returns (uint256 amount) {
    amount = _withdrawAll();
  }

  function withdrawAllByAdmin() external override onlyOwner returns (uint256 amount) {
    amount = _withdrawAll();
    emit AdminWithdraw(amount);
  }

  function withdraw(uint256 _amount) external override onlyParent {
    _withdraw(_amount);
  }

  function withdrawByAdmin(uint256 _amount) external override onlyOwner {
    _withdraw(_amount);
    emit AdminWithdraw(_amount);
  }

  function deposit() external override onlyParent {
    _deposit();
  }

  function _verifyParentUpdate(ISplitter _currentParent, ISplitter _newParent) internal view {
    // Revert if it's the same address
    if (address(_newParent) == address(this)) revert('INVALID');
    // Revert if the address is parent
    if (address(_newParent) == address(_currentParent)) revert('INVALID');
    // Revert if core is invalid
    if (_currentParent.core() != _newParent.core()) revert('INVALID');

    // Get boolean if address(this) is the child
    bool firstChild = address(_newParent.childOne()) == address(this);
    bool secondChild = address(_newParent.childTwo()) == address(this);

    // Verify if address(this) is a child
    if (firstChild && secondChild) revert('DUPLICATE_CHILD');
    if (!firstChild && !secondChild) revert('NOT_CHILD');
  }

  function _executeParentUpdate(ISplitter _currentParent, ISplitter _newParent) internal {
    // Make `_newParent` our new parent
    parent = _newParent;
    emit ParentUpdate(_currentParent, _newParent);
  }

  function replaceAsChild(ISplitter _newParent) external virtual override onlyOwner {
    // Gas savings
    ISplitter _currentParent = parent;

    // Verify if the new parent has the right connections
    _verifyParentUpdate(_currentParent, _newParent);

    // Revert if parent connection isn't there
    // This is specific to `replaceAsChild` as it creates a connection between the parent and address(this)
    if (_currentParent != _newParent.parent()) revert('PARENT');

    // Make sure the parent recognizes the new child
    // This is specific to `replaceAsChild` as it creates a connection between the parent and address(this)
    _currentParent.updateChild(_newParent);

    // Update parent
    _executeParentUpdate(_currentParent, _newParent);

    emit ReplaceAsChild();
  }

  function updateParent(ISplitter _newParent) external virtual override onlyParent {
    // Verify if the parent can be updated
    _verifyParentUpdate(ISplitter(msg.sender), _newParent);

    // Update parent
    _executeParentUpdate(ISplitter(msg.sender), _newParent);
  }

  function _withdrawAll() internal virtual returns (uint256 amount) {}

  function _withdraw(uint256 _amount) internal virtual {}

  function _deposit() internal virtual {}
}
