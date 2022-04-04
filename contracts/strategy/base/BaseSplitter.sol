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

  /*//////////////////////////////////////////////////////////////
                        TREE STRUCTURE LOGIC
  //////////////////////////////////////////////////////////////*/

  function isMaster() external view override returns (bool) {
    return false;
  }

  function setupCompleted() external view override returns (bool completed) {
    (completed, , ) = _setupCompleted();
  }

  function _setupCompleted()
    internal
    view
    returns (
      bool completed,
      INode _childOne,
      INode _childTwo
    )
  {
    _childOne = childOne;
    _childTwo = childTwo;

    completed = address(_childOne) != address(0) && address(_childTwo) != address(0);
  }

  function replaceForce(INode _node) external virtual override {
    replace(_node);
  }

  function replace(INode __newNode) public virtual override onlyOwner {
    (bool completed, INode _childOne, INode _childTwo) = _setupCompleted();
    if (completed == false) revert SetupNotCompleted(INode(address(this)));

    ISplitter _newNode = ISplitter(address(__newNode));

    if (_newNode.setupCompleted() == false) revert SetupNotCompleted(_newNode);
    if (address(_newNode) == address(this)) revert InvalidArg();
    if (_newNode.childOne() != _childOne) revert InvalidChildOne();
    if (_newNode.childTwo() != _childTwo) revert InvalidChildTwo();
    if (_newNode.parent() != parent) revert InvalidParent();
    if (_newNode.core() != core) revert InvalidCore();
    if (_newNode.want() != want) revert InvalidWant();

    _childOne.updateParent(_newNode);
    _childTwo.updateParent(_newNode);

    parent.updateChild(_newNode);

    emit Replace(_newNode);
    emit Obsolete(INode(address(this)));
  }

  function updateChild(INode _newChild) external virtual override {
    (bool completed, INode _childOne, INode _childTwo) = _setupCompleted();
    if (completed == false) revert SetupNotCompleted(INode(address(this)));

    if (_newChild.setupCompleted() == false) revert SetupNotCompleted(_newChild);
    if (address(_newChild) == address(this)) revert InvalidArg();
    if (_newChild == _childOne) revert InvalidArg();
    if (_newChild == _childTwo) revert InvalidArg();
    if (_newChild.core() != core) revert InvalidCore();
    if (_newChild.want() != want) revert InvalidWant();
    if (address(_newChild.parent()) != address(this)) revert InvalidParent();

    if (msg.sender == address(_childOne)) {
      childOne = _newChild;
      emit ChildOneUpdate(_childOne, _newChild);
    } else if (msg.sender == address(_childTwo)) {
      childTwo = _newChild;
      emit ChildTwoUpdate(_childTwo, _newChild);
    } else {
      revert SenderNotChild();
    }
  }

  function childRemoved() external virtual override {
    (bool completed, INode _childOne, INode _childTwo) = _setupCompleted();
    if (completed == false) revert SetupNotCompleted(INode(address(this)));

    if (msg.sender == address(_childOne)) {
      _childTwo.siblingRemoved();
      parent.updateChild(_childTwo);

      emit Obsolete(_childOne);
    } else if (msg.sender == address(_childTwo)) {
      _childOne.siblingRemoved();
      parent.updateChild(_childOne);

      emit Obsolete(_childTwo);
    } else {
      revert SenderNotChild();
    }

    emit Obsolete(INode(address(this)));
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

  /*//////////////////////////////////////////////////////////////
                        YIELD STRATEGY LOGIC
  //////////////////////////////////////////////////////////////*/

  function _withdrawAll() internal virtual override returns (uint256 amount) {
    // Children will withdraw to core()
    amount = childOne.withdrawAll();
    amount += childTwo.withdrawAll();
  }

  function balanceOf() external view virtual override returns (uint256 amount) {
    amount = childOne.balanceOf();
    amount += childTwo.balanceOf();
  }
}
