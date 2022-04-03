// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/security/Pausable.sol';

import '../../interfaces/strategy/INode.sol';
import './BaseMaster.sol';

abstract contract BaseSplitter is BaseMaster, ISplitter {
  using SafeERC20 for IERC20;

  INode public override childTwo;

  function isMaster() external view override returns (bool) {
    return false;
  }

  function _withdrawAll() internal virtual override returns (uint256 amount) {
    // Children will withdraw to core()
    amount = childOne.withdrawAll();
    amount += childTwo.withdrawAll();
  }

  function balanceOf() external view virtual override returns (uint256 amount) {
    amount = childOne.balanceOf();
    amount += childTwo.balanceOf();
  }

  function updateChild(INode _newChild) external virtual override {
    INode _currentChildOne = childOne;
    INode _currentChildTwo = childTwo;

    if (_newChild == _currentChildOne) revert('SAME');
    if (_newChild == _currentChildTwo) revert('SAME');
    if (address(_newChild) == address(this)) revert('INVALID');
    if (_newChild.core() != core) revert('INVALID');
    if (_newChild.want() != want) revert('INVALID');
    if (address(_newChild.parent()) != address(this)) revert('INVALID');

    if (msg.sender == address(_currentChildOne)) {
      childOne = _newChild;
      emit ChildOneUpdate(_currentChildOne, _newChild);
    } else if (msg.sender == address(_currentChildTwo)) {
      childTwo = _newChild;
      emit ChildTwoUpdate(_currentChildTwo, _newChild);
    } else {
      revert('SENDER');
    }
  }

  function childRemoved() external virtual override {
    INode _childOne = childOne;
    INode _childTwo = childTwo;

    if (msg.sender == address(_childOne)) {
      parent.updateChild(_childTwo);
      _childTwo.updateParent(parent);

      emit Obsolete(_childOne);
    } else if (msg.sender == address(_childTwo)) {
      parent.updateChild(_childOne);
      _childOne.updateParent(parent);

      emit Obsolete(_childTwo);
    } else {
      revert('SENDER');
    }

    emit Obsolete(INode(address(this)));
  }

  function replace(INode _newNode) public virtual override onlyOwner {
    if (address(_newNode) == address(this)) revert('SAME');
    if (ISplitter(address(_newNode)).childOne() != childOne) revert('CHILD_ONE');
    if (ISplitter(address(_newNode)).childTwo() != childTwo) revert('CHILD_TWO');
    if (_newNode.parent() != parent) revert('PARENT');
    if (_newNode.core() != core) revert('INVALID');
    if (_newNode.want() != want) revert('INVALID');

    // TODO childOne.updateParent(address(this))
    // TODO childTwo.updateParent(address(this))

    parent.updateChild(_newNode);

    emit Replace(_newNode);
    emit Obsolete(INode(address(this)));
  }

  function replaceForce(INode _node) external virtual override {
    replace(_node);
  }

  function _setChildTwo(INode _currentChild, INode _newChild) internal {
    _verifySetChild(_currentChild, _newChild);

    childTwo = _newChild;
    emit ChildTwoUpdate(_currentChild, _newChild);
  }

  function setInitialChildTwo(INode _newChild) external override onlyOwner {
    if (address(childTwo) != address(0)) revert InvalidState();

    _setChildTwo(INode(address(0)), _newChild);
  }
}
