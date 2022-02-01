// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity ^0.8.10;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract SherToken is ERC20 {
  constructor(uint256 initialSupply) ERC20('Sherlock', 'SHER') {
    _mint(msg.sender, initialSupply);
  }
}
