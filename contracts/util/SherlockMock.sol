// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC721/ERC721.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '../interfaces/ISherlock.sol';

contract SherlockMock is ISherlock, ERC721, Ownable {
  mapping(uint256 => bool) public override periods;

  mapping(uint256 => uint256) public override deadlines;
  mapping(uint256 => uint256) public override sherRewards;

  IStrategyManager public override strategy;
  ISherDistributionManager public override sherDistributionManager;
  address public override nonStakersAddress;
  ISherlockProtocolManager public override sherlockProtocolManager;
  ISherlockClaimManager public override sherlockClaimManager;

  IERC20 token;

  constructor() ERC721('mock', 'm') {}

  function setNonStakersAddress(address _a) external {
    nonStakersAddress = _a;
  }

  //
  // View functions
  //
  function balanceOf(uint256 _tokenID) public view override returns (uint256) {}

  function setToken(IERC20 _token) external {
    token = _token;
  }

  function balanceOf() public view override returns (uint256) {
    return token.balanceOf(address(this));
  }

  //
  // Gov functions
  //

  function _setPeriod(uint256 _period) internal {}

  function enablePeriod(uint256 _period) external override onlyOwner {}

  function disablePeriod(uint256 _period) external override onlyOwner {}

  function pullSherReward(uint256 _amount, uint256 _period) external {
    sherDistributionManager.pullReward(_amount, _period);
  }

  function updateSherDistributionManager(ISherDistributionManager _manager)
    external
    override
    onlyOwner
  {
    sherDistributionManager = _manager;
  }

  function removeSherDistributionManager() external override onlyOwner {}

  function updateNonStakersAddress(address _nonStakers) external override onlyOwner {
    nonStakersAddress = _nonStakers;
  }

  function updateSherlockProtocolManager(ISherlockProtocolManager _protocolManager)
    external
    override
    onlyOwner
  {
    sherlockProtocolManager = _protocolManager;
  }

  function updateSherlockClaimManager(ISherlockClaimManager _sherlockClaimManager)
    external
    override
    onlyOwner
  {
    sherlockClaimManager = _sherlockClaimManager;
  }

  function updateStrategy(IStrategyManager _strategy) external override onlyOwner {}

  function strategyDeposit(uint256 _amount) external override onlyOwner {}

  function strategyWithdraw(uint256 _amount) external override onlyOwner {}

  function strategyWithdrawAll() external override onlyOwner {}

  //
  // Access control functions
  //

  function payout(address _receiver, uint256 _amount) external override {}

  //
  // Non-access control functions
  //

  function _stake(
    uint256 _amount,
    uint256 _period,
    uint256 _id
  ) internal returns (uint256 _sher) {}

  function _verifyPositionAccessability(uint256 _id) internal view returns (address _nftOwner) {}

  function _sendSherRewardsToOwner(uint256 _id, address _nftOwner) internal {}

  function _transferOut(address _receiver, uint256 _amount) internal {}

  function _burnSharesCalc(uint256 _shares) internal view returns (uint256) {}

  function _burnShares(
    uint256 _id,
    uint256 _shares,
    address _receiver
  ) internal returns (uint256 _amount) {}

  function _hold(
    uint256 _id,
    uint256 _period,
    address _nftOwner
  ) internal returns (uint256 _sher) {}

  function mint(
    uint256 _amount,
    uint256 _period,
    address _receiver
  ) external override returns (uint256 _id, uint256 _sher) {}

  function burn(uint256 _id) external override returns (uint256 _amount) {}

  function hold(uint256 _id, uint256 _period) external override returns (uint256 _sher) {}

  function _holdArbCalcShares(uint256 _id) internal view returns (uint256) {}

  function holdArbCalc(uint256 _id) external view returns (uint256) {}

  function holdArb(uint256 _id) external override returns (uint256 _sher, uint256 _arbReward) {}
}
