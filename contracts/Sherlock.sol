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

import './interfaces/ISherlock.sol';

contract Sherlock is ISherlock, ERC721, Ownable {
  using SafeERC20 for IERC20;

  uint256 constant ARB_RESTAKE_WAIT_TIME = 2 weeks;
  uint256 constant ARB_RESTAKE_GROWTH_TIME = 2 weeks;
  uint256 constant ARB_RESTAKE_PERIOD = 12 weeks;
  uint256 constant ARB_RESTAKE_MAX_PERCENTAGE = (10**18 / 100) * 20; // 20%

  IERC20 public immutable token;
  IERC20 public immutable sher;

  mapping(uint256 => bool) public override periods;

  mapping(uint256 => uint256) public override deadlines;
  mapping(uint256 => uint256) public override sherRewards;
  mapping(uint256 => uint256) internal shares;
  uint256 internal totalShares;

  IStrategyManager public override strategy;
  ISherDistributionManager public override sherDistributionManager;
  address public override nonStakersAddress;
  ISherlockProtocolManager public override sherlockProtocolManager;
  ISherlockClaimManager public override sherlockClaimManager;

  uint256 nftCounter;

  constructor(
    IERC20 _token,
    IERC20 _sher,
    string memory _name,
    string memory _symbol,
    IStrategyManager _strategy,
    ISherDistributionManager _sherDistributionManager,
    address _nonStakersAddress,
    ISherlockProtocolManager _sherlockProtocolManager,
    ISherlockClaimManager _sherlockClaimManager,
    uint256[] memory _initialPeriods
  ) ERC721(_name, _symbol) {
    token = _token;
    sher = _sher;
    strategy = _strategy;
    sherDistributionManager = _sherDistributionManager;
    nonStakersAddress = _nonStakersAddress;
    sherlockProtocolManager = _sherlockProtocolManager;
    sherlockClaimManager = _sherlockClaimManager;

    for (uint256 i; i < _initialPeriods.length; i++) {
      _setPeriod(_initialPeriods[i]);
    }
  }

  //
  // View functions
  //
  function balanceOf(uint256 _tokenID) public view override returns (uint256) {
    return (shares[_tokenID] * balanceOf()) / totalShares;
  }

  function balanceOf() public view override returns (uint256) {
    return
      token.balanceOf(address(this)) +
      strategy.balanceOf() +
      sherlockProtocolManager.claimablePremiums();
  }

  //
  // Gov functions
  //

  function _setPeriod(uint256 _period) internal {
    periods[_period] = true;
    // todo emit event
  }

  function enablePeriod(uint256 _period) external override onlyOwner {
    require(!periods[_period], 'active');
    _setPeriod(_period);
  }

  function disablePeriod(uint256 _period) external override onlyOwner {
    require(periods[_period], 'inactive');
    periods[_period] = false;
  }

  function updateSherDistributionManager(ISherDistributionManager _manager)
    external
    override
    onlyOwner
  {
    require(address(_manager) != address(0), 'ZERO');
    sherDistributionManager = _manager;
  }

  function removeSherDistributionManager() external override onlyOwner {
    delete sherDistributionManager;
  }

  function updateNonStakersAddress(address _nonStakers) external override onlyOwner {
    require(address(_nonStakers) != address(0), 'ZERO');
    nonStakersAddress = _nonStakers;
  }

  function updateSherlockProtocolManager(ISherlockProtocolManager _protocolManager)
    external
    override
    onlyOwner
  {
    require(address(_protocolManager) != address(0), 'ZERO');
    sherlockProtocolManager = _protocolManager;
  }

  function updateSherlockClaimManager(ISherlockClaimManager _sherlockClaimManager)
    external
    override
    onlyOwner
  {
    require(address(_sherlockClaimManager) != address(0), 'ZERO');
    sherlockClaimManager = _sherlockClaimManager;
  }

  function updateStrategy(IStrategyManager _strategy) external override onlyOwner {
    require(address(_strategy) != address(0), 'ZERO');
    strategy = _strategy;
  }

  function strategyDeposit(uint256 _amount) external override onlyOwner {
    require(_amount != 0, 'amount');
    sherlockProtocolManager.claimPremiums();
    token.transfer(address(strategy), _amount);
    strategy.deposit();
  }

  function strategyWithdraw(uint256 _amount) external override onlyOwner {
    require(_amount != 0, 'amount');
    strategy.withdraw(_amount);
  }

  function strategyWithdrawAll() external override onlyOwner {
    strategy.withdrawAll();
  }

  //
  // Access control functions
  //

  function payout(address _receiver, uint256 _amount) external override {
    require(msg.sender == address(sherlockClaimManager), 'manager');
    _transferOut(_receiver, _amount);
  }

  //
  // Non-access control functions
  //

  function _stake(
    uint256 _amount,
    uint256 _period,
    uint256 _id
  ) internal returns (uint256 _sher) {
    deadlines[_id] = block.timestamp + _period;

    uint256 before = sher.balanceOf(address(this));
    _sher = sherDistributionManager.pullReward(_amount, _period);
    require(sher.balanceOf(address(this)) - before == _sher, 'calc');

    sherRewards[_id] = _sher;
  }

  function _verifyPositionAccessability(uint256 _id) internal view returns (address _nftOwner) {
    _nftOwner = ownerOf(_id);

    require(_nftOwner == msg.sender, 'owner');
    require(deadlines[_id] <= block.timestamp, 'time');
  }

  function _sendSherRewardsToOwner(uint256 _id, address _nftOwner) internal {
    uint256 sherReward = sherRewards[_id];
    if (sherReward == 0) return;

    sher.safeTransfer(_nftOwner, sherReward);
    delete sherRewards[_id];
  }

  function _transferOut(address _receiver, uint256 _amount) internal {
    sherlockProtocolManager.claimPremiums();
    uint256 mainBalance = token.balanceOf(address(this));
    if (_amount > mainBalance) {
      strategy.withdraw(_amount - mainBalance);
    }
    token.safeTransfer(_receiver, _amount);
  }

  function _burnSharesCalc(uint256 _shares) internal view returns (uint256) {
    return (_shares * balanceOf()) / totalShares;
  }

  function _burnShares(
    uint256 _id,
    uint256 _shares,
    address _receiver
  ) internal returns (uint256 _amount) {
    _amount = _burnSharesCalc(_shares);
    if (_amount != 0) _transferOut(_receiver, _amount);

    shares[_id] -= _shares;
    totalShares -= _shares;
  }

  function _hold(
    uint256 _id,
    uint256 _period,
    address _nftOwner
  ) internal returns (uint256 _sher) {
    _sendSherRewardsToOwner(_id, _nftOwner);
    _sher = _stake(balanceOf(_id), _period, _id);
  }

  function mint(
    uint256 _amount,
    uint256 _period,
    address _receiver
  ) external override returns (uint256 _id, uint256 _sher) {
    require(_amount != 0, 'AMOUNT');
    require(periods[_period], 'PERIOD');
    require(address(_receiver) != address(0), 'ADDRESS');
    _id = nftCounter++;

    token.safeTransferFrom(msg.sender, address(this), _amount);

    uint256 shares_;
    uint256 totalShares_ = totalShares;
    if (totalShares_ != 0) shares_ = (_amount * totalShares_) / balanceOf();
    else shares_ = _amount * 10**18;

    shares[_id] = shares_;
    totalShares += shares_;

    _sher = _stake(_amount, _period, _id);
    // todo use safemint
    _mint(_receiver, _id);
  }

  function burn(uint256 _id) external override returns (uint256 _amount) {
    address nftOwner = _verifyPositionAccessability(_id);

    _amount = _burnShares(_id, shares[_id], nftOwner);
    _sendSherRewardsToOwner(_id, nftOwner);
    _burn(_id);

    delete deadlines[_id];
  }

  function hold(uint256 _id, uint256 _period) external override returns (uint256 _sher) {
    address nftOwner = _verifyPositionAccessability(_id);
    _sher = _hold(_id, _period, nftOwner);
  }

  function _holdArbCalcShares(uint256 _id) internal view returns (uint256) {
    uint256 initialArbTime = deadlines[_id] + ARB_RESTAKE_WAIT_TIME;

    if (initialArbTime >= block.timestamp) return 0;

    uint256 maxRewardArbTime = initialArbTime + ARB_RESTAKE_GROWTH_TIME;
    uint256 targetTime = block.timestamp < maxRewardArbTime ? block.timestamp : maxRewardArbTime;

    // scaled by 10**18
    uint256 maxRewardScaled = ARB_RESTAKE_MAX_PERCENTAGE * shares[_id];

    return
      ((targetTime - initialArbTime) * maxRewardScaled) /
      (maxRewardArbTime - initialArbTime) /
      10**18;
  }

  function holdArbCalc(uint256 _id) external view returns (uint256) {
    return _burnSharesCalc(_holdArbCalcShares(_id));
  }

  function holdArb(uint256 _id) external override returns (uint256 _sher, uint256 _arbReward) {
    address nftOwner = ownerOf(_id);
    require(nftOwner != address(0), 'owner');

    uint256 arbRewardShares = _holdArbCalcShares(_id);
    _arbReward = _burnShares(_id, arbRewardShares, msg.sender);
    _sher = _hold(_id, ARB_RESTAKE_PERIOD, nftOwner);
  }
}
