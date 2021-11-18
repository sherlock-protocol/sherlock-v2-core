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
    if (address(_token) == address(0)) revert ZeroArgument();
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (address(_strategy) == address(0)) revert ZeroArgument();
    if (_nonStakersAddress == address(0)) revert ZeroArgument();
    if (address(_sherlockProtocolManager) == address(0)) revert ZeroArgument();
    if (address(_sherlockClaimManager) == address(0)) revert ZeroArgument();

    token = _token;
    sher = _sher;
    strategy = _strategy;
    sherDistributionManager = _sherDistributionManager;
    nonStakersAddress = _nonStakersAddress;
    sherlockProtocolManager = _sherlockProtocolManager;
    sherlockClaimManager = _sherlockClaimManager;

    for (uint256 i; i < _initialPeriods.length; i++) {
      enablePeriod(_initialPeriods[i]);
    }

    emit YieldStrategyUpdated(IStrategyManager(address(0)), _strategy);
    emit SherDistributionManagerUpdated(
      ISherDistributionManager(address(0)),
      _sherDistributionManager
    );
    emit NonStakerAddressUpdated(address(0), _nonStakersAddress);
    emit ProtocolManagerUpdated(ISherlockProtocolManager(address(0)), _sherlockProtocolManager);
    emit ClaimManagerUpdated(ISherlockClaimManager(address(0)), _sherlockClaimManager);
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

  function enablePeriod(uint256 _period) public override onlyOwner {
    if (_period == 0) revert ZeroArgument();
    if (periods[_period]) revert InvalidArgument();

    periods[_period] = true;
    emit StakingPeriodEnabled(_period);
  }

  function disablePeriod(uint256 _period) external override onlyOwner {
    if (!periods[_period]) revert InvalidArgument();
    periods[_period] = false;

    emit StakingPeriodDisabled(_period);
  }

  function updateSherDistributionManager(ISherDistributionManager _manager)
    external
    override
    onlyOwner
  {
    if (address(_manager) == address(0)) revert ZeroArgument();
    if (sherDistributionManager == _manager) revert InvalidArgument();

    emit SherDistributionManagerUpdated(sherDistributionManager, _manager);
    sherDistributionManager = _manager;
  }

  function removeSherDistributionManager() external override onlyOwner {
    if (address(sherDistributionManager) == address(0)) revert InvalidConditions();

    emit SherDistributionManagerUpdated(
      sherDistributionManager,
      ISherDistributionManager(address(0))
    );
    delete sherDistributionManager;
  }

  function updateNonStakersAddress(address _nonStakers) external override onlyOwner {
    if (address(_nonStakers) == address(0)) revert ZeroArgument();
    if (nonStakersAddress == _nonStakers) revert InvalidArgument();

    emit NonStakerAddressUpdated(nonStakersAddress, _nonStakers);
    nonStakersAddress = _nonStakers;
  }

  function updateSherlockProtocolManager(ISherlockProtocolManager _protocolManager)
    external
    override
    onlyOwner
  {
    if (address(_protocolManager) == address(0)) revert ZeroArgument();
    if (sherlockProtocolManager == _protocolManager) revert InvalidArgument();

    emit ProtocolManagerUpdated(sherlockProtocolManager, _protocolManager);
    sherlockProtocolManager = _protocolManager;
  }

  function updateSherlockClaimManager(ISherlockClaimManager _sherlockClaimManager)
    external
    override
    onlyOwner
  {
    if (address(_sherlockClaimManager) == address(0)) revert ZeroArgument();
    if (sherlockClaimManager == _sherlockClaimManager) revert InvalidArgument();

    emit ClaimManagerUpdated(sherlockClaimManager, _sherlockClaimManager);
    sherlockClaimManager = _sherlockClaimManager;
  }

  function updateStrategy(IStrategyManager _strategy) external override onlyOwner {
    if (address(_strategy) == address(0)) revert ZeroArgument();
    if (strategy == _strategy) revert InvalidArgument();

    emit YieldStrategyUpdated(strategy, _strategy);
    strategy = _strategy;
  }

  function strategyDeposit(uint256 _amount) external override onlyOwner {
    if (_amount == 0) revert ZeroArgument();

    sherlockProtocolManager.claimPremiums();
    token.safeTransfer(address(strategy), _amount);
    strategy.deposit();
  }

  function strategyWithdraw(uint256 _amount) external override onlyOwner {
    if (_amount == 0) revert ZeroArgument();

    strategy.withdraw(_amount);
  }

  function strategyWithdrawAll() external override onlyOwner {
    strategy.withdrawAll();
  }

  //
  // Access control functions
  //

  function payout(address _receiver, uint256 _amount) external override {
    if (msg.sender != address(sherlockClaimManager)) revert Unauthorized();

    if (_amount != 0) {
      _transferOut(_receiver, _amount);
    }
    emit ClaimPayout(_receiver, _amount);
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

    if (address(sherDistributionManager) == address(0)) return 0;

    uint256 before = sher.balanceOf(address(this));

    try sherDistributionManager.pullReward(_amount, _period) returns (uint256 amount) {
      _sher = amount;
    } catch (bytes memory reason) {
      return 0;
    }

    uint256 actualAmount = sher.balanceOf(address(this)) - before;
    if (actualAmount != _sher) revert InvalidSherAmount(_sher, actualAmount);
    sherRewards[_id] = _sher;
  }

  function _verifyPositionAccessability(uint256 _id) internal view returns (address _nftOwner) {
    _nftOwner = ownerOf(_id);

    if (_nftOwner != msg.sender) revert Unauthorized();
    if (deadlines[_id] > block.timestamp) revert InvalidConditions();
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
    if (_amount == 0) revert ZeroArgument();
    if (!periods[_period]) revert InvalidArgument();
    if (address(_receiver) == address(0)) revert ZeroArgument();
    _id = nftCounter++;

    token.safeTransferFrom(msg.sender, address(this), _amount);

    // @note looks like the staker doesn't get sufficient amount of shares

    uint256 shares_;
    uint256 totalShares_ = totalShares;
    if (totalShares_ != 0) shares_ = (_amount * totalShares_) / balanceOf();
    else shares_ = _amount * 10**6;

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
    // @todo revert explicitly if arb can not be executed
    address nftOwner = ownerOf(_id);
    if (nftOwner == address(0)) revert InvalidArgument();

    uint256 arbRewardShares = _holdArbCalcShares(_id);
    _arbReward = _burnShares(_id, arbRewardShares, msg.sender);
    _sher = _hold(_id, ARB_RESTAKE_PERIOD, nftOwner);
  }
}
