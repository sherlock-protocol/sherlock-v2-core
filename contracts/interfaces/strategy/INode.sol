// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface INode {
  event AdminWithdraw(uint256 amount);
  event ReplaceAsChild();
  event ParentUpdate(ISplitter previousParent, ISplitter newParent);
  event Obsolete(INode implementation);
  event Replace(INode newAddress);

  /// @return Returns the token type being deposited into a node
  function want() external view returns (IERC20);

  /// @notice Withdraws all tokens back into core.
  /// @return The final amount withdrawn
  function withdrawAll() external returns (uint256);

  /// @notice Withdraws all token from the node back into core
  /// @return The final amount withdrawn
  function withdrawAllByAdmin() external returns (uint256);

  /// @notice Withdraws a specific amount of tokens from the node back into core
  /// @param _amount Amount of tokens to withdraw
  function withdraw(uint256 _amount) external;

  /// @notice Withdraws a specific amount of tokens from the node back into core
  /// @param _amount Amount of tokens to withdraw
  function withdrawByAdmin(uint256 _amount) external;

  /// @notice Deposits all tokens held in this contract into the children on strategy
  /// @dev Splitter will deposit the tokens in their children
  /// @dev Strategy will deposit the tokens into a yield strategy
  function deposit() external;

  /// @return Returns the token balance managed by this contract
  /// @dev For Splitter this will be the sum of balances of the children
  function balanceOf() external view returns (uint256);

  /// @notice Parent will always inherit ISplitter interface.
  /// @notice Parent of root node will inherit IStrategyManager
  function parent() external view returns (ISplitter);

  /// @notice View core controller of funds
  function core() external view returns (address);

  /// @notice Update parent of node
  /// @dev Can only be called by current parent
  function updateParent(ISplitter _node) external;
}

interface INodeReplaceable {
  /// @notice Replace the node
  /// @notice If this is executed on a strategy, the funds will be withdrawn
  /// @notice If this is executed on a splitter, the children are expected to be the same
  function replace(INode _node) external;

  /// @notice Replace the node
  /// @notice If this is executed on a strategy, attempt is made to withdraw the funds
  /// @notice If this is executed on a splitter, check of children is skipped
  function replaceForce(INode _node) external;

  /// @notice Move the current node as the child of `_node`
  function replaceAsChild(ISplitter _node) external;
}

interface IMaster is INode {
  event ChildUpdated(INode _previous, INode _current);

  /// @notice Call by child if it's needs to be updated
  function updateChild(INode _node) external;

  /// @notice Call by child if removed
  function childRemoved() external;

  function isMaster() external view returns (bool);
}

interface ISplitter is IMaster {
  event ChildOneUpdate(INode oldAddress, INode newAddress);
  event ChildTwoUpdate(INode oldAddress, INode newAddress);

  function childOne() external view returns (INode);

  function childTwo() external view returns (INode);
}
