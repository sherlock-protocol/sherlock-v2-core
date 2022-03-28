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
import './BaseNode.sol';

abstract contract BaseSplitter is BaseNode, ISplitter {
  using SafeERC20 for IERC20;

  INode public override childOne;
  INode public override childTwo;

  function _withdrawAll() internal virtual override returns (uint256 amount) {
    // Children will withdraw to core()
    amount = childOne.withdrawAll();
    amount += childTwo.withdrawAll();

    // emit event amount old balance, new balance, removed
  }

  function balanceOf() external view virtual override returns (uint256 amount) {
    amount = childOne.balanceOf();
    amount += childTwo.balanceOf();
  }

  function updateChild(INode _node) external virtual override {
    if (msg.sender == address(childOne)) {
      childOne = _node;
      // emit first child updated
    } else if (msg.sender == address(childTwo)) {
      childTwo = _node;
      // emit second child updated
    } else {
      revert('SENDER');
    }
  }

  function childRemoved() external virtual override {
    if (msg.sender == address(childOne)) {
      parent.updateChild(childTwo);
      childTwo.updateParent(parent);
      // childOne implementation is now obsolete
    } else if (msg.sender == address(childTwo)) {
      parent.updateChild(childOne);
      childOne.updateParent(parent);
      // childTwo implementation is now obsolete
    } else {
      revert('SENDER');
    }

    // this contract is now obsolete
  }

  function replace(INode _node) public virtual override onlyOwner {
    if (ISplitter(address(_node)).childOne() != childOne) revert('CHILD');
    if (ISplitter(address(_node)).childTwo() != childTwo) revert('CHILD');

    parent.updateChild(_node);

    // this contract is now obsolete
  }

  function replaceForce(INode _node) external virtual override {
    replace(_node);
  }
}
