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

abstract contract BaseNode is INode, Ownable {
  using SafeERC20 for IERC20;

  IMaster public override parent;
  IERC20 public immutable override want;
  address public immutable override core;

  constructor(IMaster _initialParent) {
    want = _initialParent.want();
    core = _initialParent.core();
    parent = _initialParent;

    // TODO zero checks

    emit ParentUpdate(IMaster(address(0)), _initialParent);
  }

  modifier onlyParent() {
    if (msg.sender != address(parent)) revert SenderNotParent();
    _;
  }

  /*//////////////////////////////////////////////////////////////
                        TREE STRUCTURE LOGIC
  //////////////////////////////////////////////////////////////*/

  /*
    Replace as child ensures that (this) is the child of the _newParent.
    It will also enfore a `_executeParentUpdate` to make that relation bi-directional

    For the other child is does minimal checks, it only checks if it isn't the same as address(this)
    We should check if the parent is the same as `_newParent`
  */
  function replaceAsChild(ISplitter _newParent) external virtual override onlyOwner {
    // Gas savings
    IMaster _currentParent = parent;

    // Revert is parent is master
    if (_newParent.isMaster()) revert IsMaster();

    // Verify if the new parent has the right connections
    _verifyParentUpdate(_currentParent, _newParent);
    INode otherChild = _verifyNewParent(_newParent);
    if (address(otherChild) != address(0)) {
      if (otherChild.parent() != _newParent) revert InvalidParent();
    }

    // Revert if parent connection isn't there
    // This is specific to `replaceAsChild` as it creates a connection between the parent and address(this)
    if (_currentParent != _newParent.parent()) revert InvalidParent();

    // Make sure the parent recognizes the new child
    // This is specific to `replaceAsChild` as it creates a connection between the parent and address(this)
    _currentParent.updateChild(_newParent);

    // Update parent
    _executeParentUpdate(_currentParent, _newParent);

    emit ReplaceAsChild();
  }

  function updateParent(IMaster _newParent) external virtual override onlyParent {
    // Verify if the parent can be updated
    _verifyParentUpdate(IMaster(msg.sender), _newParent);
    _verifyNewParent(_newParent);

    // Update parent
    _executeParentUpdate(IMaster(msg.sender), _newParent);
  }

  function siblingRemoved() external override onlyParent {
    IMaster _newParent = parent.parent();

    _verifyParentUpdate(IMaster(msg.sender), _newParent);
    // NOTE: _verifyNewParent() is skipped on this call
    // as address(this) should be added as a child after the callback
    _executeParentUpdate(IMaster(msg.sender), _newParent);
  }

  function _verifyNewParent(IMaster _newParent) internal view returns (INode otherChild) {
    if (_newParent.setupCompleted() == false) revert SetupNotCompleted(_newParent);

    INode firstChild = _newParent.childOne();
    INode secondChild;

    bool isFirstChild = address(firstChild) == address(this);
    bool isSecondChild = false;

    if (!_newParent.isMaster()) {
      secondChild = ISplitter(address(_newParent)).childTwo();
      isSecondChild = address(secondChild) == address(this);
    }

    // Verify if address(this) is a child
    if (isFirstChild && isSecondChild) revert BothChild();
    if (!isFirstChild && !isSecondChild) revert NotChild();

    if (isFirstChild) {
      return secondChild;
    }
    return firstChild;
  }

  function _verifyParentUpdate(IMaster _currentParent, IMaster _newParent) internal view {
    // Revert if it's the same address
    if (address(_newParent) == address(this)) revert InvalidParentAddress();
    // Revert if the address is parent
    if (address(_newParent) == address(_currentParent)) revert InvalidParentAddress();
    // Revert if core is invalid
    if (_currentParent.core() != _newParent.core()) revert InvalidCore();
    // Revert if want is invalid
    if (_currentParent.want() != _newParent.want()) revert InvalidWant();
  }

  function _executeParentUpdate(IMaster _currentParent, IMaster _newParent) internal {
    // Make `_newParent` our new parent
    parent = _newParent;
    emit ParentUpdate(_currentParent, _newParent);
  }

  function _replace(INode _newNode) internal {
    if (address(_newNode) == address(0)) revert ZeroArg();
    if (_newNode.setupCompleted() == false) revert SetupNotCompleted(_newNode);
    if (address(_newNode) == address(this)) revert InvalidArg();
    if (_newNode.parent() != parent) revert InvalidParent();
    if (_newNode.core() != core) revert InvalidCore();
    if (_newNode.want() != want) revert InvalidWant();

    parent.updateChild(_newNode);

    emit Replace(_newNode);
    emit Obsolete(INode(address(this)));
  }

  /*//////////////////////////////////////////////////////////////
                        YIELD STRATEGY LOGIC
  //////////////////////////////////////////////////////////////*/

  function withdrawAll() external override onlyParent returns (uint256 amount) {
    amount = _withdrawAll();
  }

  function withdrawAllByAdmin() external override onlyOwner returns (uint256 amount) {
    amount = _withdrawAll();
    emit AdminWithdraw(amount);
  }

  function withdraw(uint256 _amount) external override onlyParent {
    if (_amount == 0) revert ZeroArg();

    _withdraw(_amount);
  }

  function withdrawByAdmin(uint256 _amount) external override onlyOwner {
    if (_amount == 0) revert ZeroArg();

    _withdraw(_amount);
    emit AdminWithdraw(_amount);
  }

  function deposit() external override onlyParent {
    _deposit();
  }

  function _withdrawAll() internal virtual returns (uint256 amount) {}

  function _withdraw(uint256 _amount) internal virtual {}

  function _deposit() internal virtual {}
}
