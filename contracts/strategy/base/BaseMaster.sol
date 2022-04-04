// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/access/Ownable.sol';

import '../../interfaces/strategy/INode.sol';
import '../../interfaces/strategy/INode.sol';
import './BaseNode.sol';

abstract contract BaseMaster is IMaster, BaseNode {
  INode public override childOne;

  function _verifySetChild(INode _currentChild, INode _newChild) internal {
    if (address(_newChild) == address(0)) revert ZeroArg();
    if (_newChild == _currentChild) revert InvalidArg();
    if (address(_newChild.parent()) != address(this)) revert InvalidParent();
    if (core != _newChild.core()) revert InvalidCore();
    if (want != _newChild.want()) revert InvalidWant();
    // TODO could theoretically be a node where `setInitialChildOne()` has ChildTwo hasn't been called on
    // Maybe expose an `setupCompleted() bool` function that checks if it can be added
    // If the child has children for splitters || If the yield strategy can be used.
  }

  function _setChildOne(INode _currentChild, INode _newChild) internal {
    _verifySetChild(_currentChild, _newChild);

    childOne = _newChild;
    emit ChildOneUpdate(_currentChild, _newChild);
  }

  function setInitialChildOne(INode _newChild) external override onlyOwner {
    if (address(childOne) != address(0)) revert InvalidState();
    // TODO not address(this)

    _setChildOne(INode(address(0)), _newChild);
  }
}
