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
import '../../interfaces/strategy/IStrategy.sol';
import './BaseNode.sol';

abstract contract BaseStrategy is IStrategy, BaseNode, Pausable {
  using SafeERC20 for IERC20;

  function pause() external virtual onlyOwner {
    _pause();
  }

  function unpause() external virtual onlyOwner {
    _unpause();
  }

  function remove() external virtual override onlyOwner {
    _withdrawAll();
    parent.childRemoved();
  }

  function _replace(INode _newNode) internal {
    // TODO, make internal replace code in ANode? For splitter and strategy
    if (address(_newNode) == address(this)) revert('SAME');
    if (_newNode.parent() != parent) revert('PARENT');
    if (_newNode.core() != core) revert('INVALID');
    if (_newNode.want() != want) revert('INVALID');

    parent.updateChild(_newNode);

    emit Replace(_newNode);
    emit Obsolete(INode(address(this)));
  }

  function replace(INode _newNode) external virtual override onlyOwner {
    _withdrawAll();
    _replace(_newNode);
  }

  function replaceForce(INode _newNode) external virtual override onlyOwner {
    _replace(_newNode);
  }
}
