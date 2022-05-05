// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface ITrueDistributor {}

interface ITrueMultiFarm {
  function trueDistributor() external view returns (ITrueDistributor);

  function stake(IERC20 token, uint256 amount) external;

  function unstake(IERC20 token, uint256 amount) external;

  function claim(IERC20[] calldata tokens) external;

  function exit(IERC20[] calldata tokens) external;

  function staked(IERC20 token, address staker) external view returns (uint256);
}
