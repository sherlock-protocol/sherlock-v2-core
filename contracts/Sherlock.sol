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

import 'hardhat/console.sol';

contract Sherlock is ISherlock, ERC721, Ownable {
  using SafeERC20 for IERC20;

  uint256 constant ARB_RESTAKE_WAIT_TIME = 2 weeks;
  uint256 constant ARB_RESTAKE_GROWTH_TIME = 2 weeks;
  uint256 constant ARB_RESTAKE_PERIOD = 12 weeks;
  uint256 constant ARB_RESTAKE_MAX_PERCENTAGE = (10**18 / 100) * 20; // 20%

  IERC20 public immutable token;
  IERC20 public immutable sher;

  mapping(uint256 => bool) public override stakingPeriods;

  mapping(uint256 => uint256) internal lockupEnd_;
  mapping(uint256 => uint256) internal sherRewards_;
  mapping(uint256 => uint256) internal stakeShares;
  uint256 internal totalstakeShares;

  IStrategyManager public override yieldStrategy;
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
    IStrategyManager _yieldStrategy,
    ISherDistributionManager _sherDistributionManager,
    address _nonStakersAddress,
    ISherlockProtocolManager _sherlockProtocolManager,
    ISherlockClaimManager _sherlockClaimManager,
    uint256[] memory _initialstakingPeriods
  ) ERC721(_name, _symbol) {
    if (address(_token) == address(0)) revert ZeroArgument();
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (address(_yieldStrategy) == address(0)) revert ZeroArgument();
    if (_nonStakersAddress == address(0)) revert ZeroArgument();
    if (address(_sherlockProtocolManager) == address(0)) revert ZeroArgument();
    if (address(_sherlockClaimManager) == address(0)) revert ZeroArgument();

    token = _token;
    sher = _sher;
    yieldStrategy = _yieldStrategy;
    sherDistributionManager = _sherDistributionManager;
    nonStakersAddress = _nonStakersAddress;
    sherlockProtocolManager = _sherlockProtocolManager;
    sherlockClaimManager = _sherlockClaimManager;

    for (uint256 i; i < _initialstakingPeriods.length; i++) {
      enablePeriod(_initialstakingPeriods[i]);
    }

    emit YieldStrategyUpdated(IStrategyManager(address(0)), _yieldStrategy);
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
  function lockupEnd(uint256 _tokenID) public view override returns (uint256) {
    if (!_exists(_tokenID)) revert NonExistent();

    return lockupEnd_[_tokenID];
  }

  function sherRewards(uint256 _tokenID) public view override returns (uint256) {
    if (!_exists(_tokenID)) revert NonExistent();

    return sherRewards_[_tokenID];
  }

  function tokenBalanceOf(uint256 _tokenID) public view override returns (uint256) {
    return (stakeShares[_tokenID] * totalTokenBalanceStakers()) / totalstakeShares;
  }

  function totalTokenBalanceStakers() public view override returns (uint256) {
    return
      token.balanceOf(address(this)) +
      yieldStrategy.balanceOf() +
      sherlockProtocolManager.claimablePremiums();
  }

  //
  // Gov functions
  //

  function enablePeriod(uint256 _period) public override onlyOwner {
    if (_period == 0) revert ZeroArgument();
    if (stakingPeriods[_period]) revert InvalidArgument();

    stakingPeriods[_period] = true;
    emit StakingPeriodEnabled(_period);
  }

  function disablePeriod(uint256 _period) external override onlyOwner {
    if (!stakingPeriods[_period]) revert InvalidArgument();
    stakingPeriods[_period] = false;

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

  function updateStrategy(IStrategyManager _yieldStrategy) external override onlyOwner {
    if (address(_yieldStrategy) == address(0)) revert ZeroArgument();
    if (yieldStrategy == _yieldStrategy) revert InvalidArgument();

    emit YieldStrategyUpdated(yieldStrategy, _yieldStrategy);
    yieldStrategy = _yieldStrategy;
  }

  function strategyDeposit(uint256 _amount) external override onlyOwner {
    if (_amount == 0) revert ZeroArgument();

    sherlockProtocolManager.claimPremiums();
    token.safeTransfer(address(yieldStrategy), _amount);
    yieldStrategy.deposit();
  }

  function strategyWithdraw(uint256 _amount) external override onlyOwner {
    if (_amount == 0) revert ZeroArgument();

    yieldStrategy.withdraw(_amount);
    token.transfer(address(yieldStrategy), _amount);
  }

  function strategyWithdrawAll() external override onlyOwner {
    yieldStrategy.withdrawAll();
  }

  //
  // Access control functions
  //

  function payout(address _receiver, uint256 _amount) external override {
    if (msg.sender != address(sherlockClaimManager)) revert Unauthorized();

    if (_amount != 0) {
      _transferTokensOut(_receiver, _amount);
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
    lockupEnd_[_id] = block.timestamp + _period;

    if (address(sherDistributionManager) == address(0)) return 0;
    // could be zero on hold() but protocol will be broken as new stakes get infinite shares
    if (_amount == 0) return 0;

    uint256 before = sher.balanceOf(address(this));

    try sherDistributionManager.pullReward(_amount, _period) returns (uint256 amount) {
      _sher = amount;
    } catch (bytes memory reason) {
      emit SherRewardsError(reason);
      return 0;
    }

    uint256 actualAmount = sher.balanceOf(address(this)) - before;
    if (actualAmount != _sher) revert InvalidSherAmount(_sher, actualAmount);
    sherRewards_[_id] = _sher;
  }

  function _verifyUnlockableByOwner(uint256 _id) internal view returns (address _nftOwner) {
    _nftOwner = ownerOf(_id);

    if (_nftOwner != msg.sender) revert Unauthorized();
    if (lockupEnd_[_id] > block.timestamp) revert InvalidConditions();
  }

  function _sendSherRewardsToOwner(uint256 _id, address _nftOwner) internal {
    uint256 sherReward = sherRewards_[_id];
    if (sherReward == 0) return;

    sher.safeTransfer(_nftOwner, sherReward);
    delete sherRewards_[_id];
  }

  function _transferTokensOut(address _receiver, uint256 _amount) internal {
    sherlockProtocolManager.claimPremiums();
    uint256 mainBalance = token.balanceOf(address(this));
    if (_amount > mainBalance) {
      yieldStrategy.withdraw(_amount - mainBalance);
    }
    token.safeTransfer(_receiver, _amount);
  }

  function _redeemSharesCalc(uint256 _stakeShares) internal view returns (uint256) {
    return (_stakeShares * totalTokenBalanceStakers()) / totalstakeShares;
  }

  function _redeemShares(
    uint256 _id,
    uint256 _stakeShares,
    address _receiver
  ) internal returns (uint256 _amount) {
    _amount = _redeemSharesCalc(_stakeShares);
    if (_amount != 0) _transferTokensOut(_receiver, _amount);

    stakeShares[_id] -= _stakeShares;
    totalstakeShares -= _stakeShares;
  }

  function _restake(
    uint256 _id,
    uint256 _period,
    address _nftOwner
  ) internal returns (uint256 _sher) {
    _sendSherRewardsToOwner(_id, _nftOwner);
    _sher = _stake(tokenBalanceOf(_id), _period, _id);

    emit Restaked(_id);
  }

  function mint(
    uint256 _amount,
    uint256 _period,
    address _receiver
  ) external override returns (uint256 _id, uint256 _sher) {
    if (_amount == 0) revert ZeroArgument();
    if (!stakingPeriods[_period]) revert InvalidArgument();
    if (address(_receiver) == address(0)) revert ZeroArgument();
    _id = ++nftCounter;

    token.safeTransferFrom(msg.sender, address(this), _amount);

    uint256 stakeShares_;
    uint256 totalstakeShares_ = totalstakeShares;
    if (totalstakeShares_ != 0)
      stakeShares_ = (_amount * totalstakeShares_) / (totalTokenBalanceStakers() - _amount);
    else stakeShares_ = _amount;

    stakeShares[_id] = stakeShares_;
    totalstakeShares += stakeShares_;

    _sher = _stake(_amount, _period, _id);

    _safeMint(_receiver, _id);
  }

  function burn(uint256 _id) external override returns (uint256 _amount) {
    address nftOwner = _verifyUnlockableByOwner(_id);

    _amount = _redeemShares(_id, stakeShares[_id], nftOwner);
    _sendSherRewardsToOwner(_id, nftOwner);
    _burn(_id);

    delete lockupEnd_[_id];
  }

  function hold(uint256 _id, uint256 _period) external override returns (uint256 _sher) {
    address nftOwner = _verifyUnlockableByOwner(_id);
    if (!stakingPeriods[_period]) revert InvalidArgument();

    _sher = _restake(_id, _period, nftOwner);
  }

  function _calcSharesForArbRestake(uint256 _id) internal view returns (uint256, bool) {
    uint256 initialArbTime = lockupEnd_[_id] + ARB_RESTAKE_WAIT_TIME;

    if (initialArbTime > block.timestamp) return (0, false);

    uint256 maxRewardArbTime = initialArbTime + ARB_RESTAKE_GROWTH_TIME;
    uint256 targetTime = block.timestamp < maxRewardArbTime ? block.timestamp : maxRewardArbTime;

    // scaled by 10**18
    uint256 maxRewardScaled = ARB_RESTAKE_MAX_PERCENTAGE * stakeShares[_id];

    return (
      ((targetTime - initialArbTime) * maxRewardScaled) /
        (maxRewardArbTime - initialArbTime) /
        10**18,
      true
    );
  }

  /// @notice calc arb rewards
  /// @return profit How much profit an arb would make
  /// @return able If the transaction can be executed
  function holdArbCalc(uint256 _id) external view returns (uint256 profit, bool able) {
    (uint256 sharesAmount, bool _able) = _calcSharesForArbRestake(_id);
    profit = _redeemSharesCalc(sharesAmount);
    able = _able;
  }

  function holdArb(uint256 _id) external override returns (uint256 _sher, uint256 _arbReward) {
    address nftOwner = ownerOf(_id);

    (uint256 arbRewardShares, bool able) = _calcSharesForArbRestake(_id);
    if (!able) revert InvalidConditions();

    _arbReward = _redeemShares(_id, arbRewardShares, msg.sender);
    _sher = _restake(_id, ARB_RESTAKE_PERIOD, nftOwner);

    emit ArbRestaked(_id, _arbReward);
  }
}
