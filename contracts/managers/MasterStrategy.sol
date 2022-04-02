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
import '../strategy/base/BaseMaster.sol';

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

contract InfoStorage {
  IERC20 public immutable want;
  address public immutable core;

  constructor(IERC20 _want, address _core) {
    want = _want;
    core = _core;
  }
}

// This contract is not desgined to hold funds (except during runtime)
// If it does (by someone sending funds directly) it will not be reflected in the balanceOf()
// On `deposit()` the funds will be added to the balance
// As an observer, if the TVL is 10m and this contract contains 10m, you can easily double your money if you
// enter the pool before `deposit()` is called.
contract MasterStrategy is
  BaseMaster,
  Manager /* IStrategyManager */
{
  using SafeERC20 for IERC20;

  constructor(IMaster _initialParent) BaseNode(_initialParent) {
    sherlockCore = ISherlock(core);

    emit SherlockCoreSet(ISherlock(core));
  }

  /*//////////////////////////////////////////////////////////////
                        TREE STRUCTURE LOGIC
  //////////////////////////////////////////////////////////////*/

  function isMaster() external view override returns (bool) {
    return true;
  }

  function childRemoved() external override {
    // not implemented as the system can not function without `childOne` in this contract
    revert NotImplemented(msg.sig);
  }

  function replace(INode _node) external override {
    revert NotImplemented(msg.sig);
  }

  function replaceForce(INode _node) external override {
    revert NotImplemented(msg.sig);
  }

  function updateChild(INode _newChild) external override {
    address _childOne = address(childOne);
    if (_childOne == address(0)) revert NotSetup();
    if (_childOne != msg.sender) revert InvalidSender();

    _setChildOne(INode(msg.sender), _newChild);
  }

  function updateParent(IMaster _node) external override {
    // not implemented as the parent can not be updated by the tree system
    revert NotImplemented(msg.sig);
  }

  /*//////////////////////////////////////////////////////////////
                        YIELD STRATEGY LOGIC
  //////////////////////////////////////////////////////////////*/

  function balanceOf()
    public
    view
    override(
      /*IStrategyManager, */
      INode
    )
    returns (uint256)
  {
    return childOne.balanceOf();
  }

  function deposit()
    external
    override(
      /*IStrategyManager, */
      INode
    )
    whenNotPaused
    onlySherlockCore
  {
    uint256 balance = want.balanceOf(address(this));
    if (balance == 0) revert InvalidConditions();

    want.safeTransfer(address(childOne), balance);

    childOne.deposit();
  }

  function withdrawAllByAdmin() external override onlyOwner returns (uint256 amount) {
    amount = childOne.withdrawAll();
    emit AdminWithdraw(_amount);
  }

  function withdrawAll()
    external
    override(
      /*IStrategyManager, */
      INode
    )
    onlySherlockCore
    returns (uint256)
  {
    return childOne.withdrawAll();
  }

  function withdrawByAdmin(uint256 _amount) external override onlyOwner {
    childOne.withdraw(_amount);
    emit AdminWithdraw(_amount);
  }

  function withdraw(uint256 _amount)
    external
    override(
      /*IStrategyManager, */
      INode
    )
    onlySherlockCore
  {
    childOne.withdraw(_amount);
  }
}
