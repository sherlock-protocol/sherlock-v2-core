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

  constructor(
    IMaster _initialParent,
    INode _initialChildOne,
    INode _initialChildTwo
  ) BaseNode(_initialParent) {
    if (address(_initialChildOne) != address(0)) {
      _verifySetChildSkipParentCheck(INode(address(0)), _initialChildOne);
      _setChildOne(INode(address(0)), _initialChildOne);
    }

    if (address(_initialChildTwo) != address(0)) {
      _verifySetChildSkipParentCheck(INode(address(0)), _initialChildTwo);
      _setChildTwo(INode(address(0)), _initialChildTwo);
    }
  }

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
    emit ForceReplace();
  }

  function replace(INode __newNode) public virtual override onlyOwner {
    (bool completed, INode _childOne, INode _childTwo) = _setupCompleted();
    if (completed == false) revert SetupNotCompleted(INode(address(this)));

    ISplitter _newNode = ISplitter(address(__newNode));

    if (_newNode.childOne() != _childOne) revert InvalidChildOne();
    if (_newNode.childTwo() != _childTwo) revert InvalidChildTwo();

    _replace(_newNode);
    _childOne.updateParent(_newNode);
    _childTwo.updateParent(_newNode);
  }

  function updateChild(INode _newChild) external virtual override {
    (bool completed, INode _childOne, INode _childTwo) = _setupCompleted();
    if (completed == false) revert SetupNotCompleted(INode(address(this)));

    if (msg.sender == address(_childOne)) {
      if (_newChild == _childTwo) revert InvalidArg();

      _verifySetChild(_childOne, _newChild);
      _setChildOne(_childOne, _newChild);
    } else if (msg.sender == address(_childTwo)) {
      if (_newChild == _childOne) revert InvalidArg();

      _verifySetChild(_childTwo, _newChild);
      _setChildTwo(_childTwo, _newChild);
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
    childTwo = _newChild;
    emit ChildTwoUpdate(_currentChild, _newChild);
  }

  function setInitialChildTwo(INode _newChild) external override onlyOwner {
    if (address(childTwo) != address(0)) revert InvalidState();

    _verifySetChild(INode(address(0)), _newChild);
    _setChildTwo(INode(address(0)), _newChild);
  }

  /*//////////////////////////////////////////////////////////////
                        YIELD STRATEGY LOGIC
  //////////////////////////////////////////////////////////////*/

  uint256 cachedChildOneBalance;
  uint256 cachedChildTwoBalance;

  function prepareBalanceCache() external override onlyParent returns (uint256) {
    uint256 _cachedChildOneBalance = childOne.prepareBalanceCache();
    uint256 _cachedChildTwoBalance = childTwo.prepareBalanceCache();

    cachedChildOneBalance = _cachedChildOneBalance;
    cachedChildTwoBalance = _cachedChildTwoBalance;

    return _cachedChildOneBalance + _cachedChildTwoBalance;
  }

  function expireBalanceCache() external override onlyParent {
    delete cachedChildOneBalance;
    delete cachedChildTwoBalance;
  }

  // Remove external entry points from splitters (see issue #24)
  function withdrawAllByAdmin() external override onlyOwner returns (uint256 amount) {
    revert NotImplemented(msg.sig);
  }

  // Remove external entry points from splitters (see issue #24)
  function withdrawByAdmin(uint256 _amount) external override onlyOwner {
    revert NotImplemented(msg.sig);
  }

  function _withdrawAll() internal virtual override returns (uint256 amount) {
    // Children will withdraw to core()
    amount = childOne.withdrawAll();
    amount += childTwo.withdrawAll();
  }

  function _balanceOf() internal view virtual override returns (uint256 amount) {
    amount = childOne.balanceOf();
    amount += childTwo.balanceOf();
  }
}
