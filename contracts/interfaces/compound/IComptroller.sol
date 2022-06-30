// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

import './ICToken.sol';

interface IComptroller is IERC20 {
  function compAccrued(address _address) external view returns (uint256);

  function claimComp(
    address[] memory holders,
    ICToken[] memory cTokens,
    bool borrowers,
    bool suppliers
  ) external;
}
