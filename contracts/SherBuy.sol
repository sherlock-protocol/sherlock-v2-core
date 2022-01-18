// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/ISherClaim.sol';
import './interfaces/ISherlock.sol';

/// @title Sherlock core interface for stakers
/// @author Evert Kors
/// @dev Send SHER tokens to the contract rounded by 0.01 SHER, otherwise functionality can break.
contract SherBuy {
  using SafeERC20 for IERC20;

  error InvalidSender();
  error InvalidAmount();
  error ZeroArgument();
  error InvalidState();
  error SoldOut();

  event Purchase(address indexed buyer, uint256 amount, uint256 staked, uint256 paid);

  uint256 public constant PERIOD = 26 weeks;
  // Allows purchases in steps of 0.01 SHER
  uint256 internal constant SHER_STEPS = 10**16;
  // Allows stakeRate and buyRate with steps of 0.01 USDC
  uint256 internal constant RATE_STEPS = 10**4;
  // SHER has 18 decimals
  uint256 internal constant SHER_DECIMALS = 10**18;

  // SHER token address (18 decimals)
  IERC20 public immutable sher;
  // USDC token address (6 decimals)
  IERC20 public immutable usdc;

  // 10**6 means for every 1 SHER token you want to buy, you will stake 1 USDC (10**7 means 1 SHER for 10 USDC)
  uint256 public immutable stakeRate;
  // 10**6 means for every 1 SHER token you want to buy, you will pay 1 USDC (10**7 means 1 SHER for 10 USDC)
  uint256 public immutable buyRate;
  // The `Sherlock.sol` contract that is a ERC721
  ISherlock public immutable sherlockPosition;
  // Address receiving the USDC payments
  address public immutable receiver;
  // Contract to claim SHER at
  ISherClaim public immutable sherClaim;

  constructor(
    IERC20 _sher,
    IERC20 _usdc,
    uint256 _stakeRate,
    uint256 _buyRate,
    ISherlock _sherlockPosition,
    address _receiver,
    ISherClaim _sherClaim
  ) {
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (address(_usdc) == address(0)) revert ZeroArgument();
    if (_stakeRate == 0) revert ZeroArgument();
    if (_stakeRate % RATE_STEPS != 0) revert InvalidState();
    if (_buyRate == 0) revert ZeroArgument();
    if (_buyRate % RATE_STEPS != 0) revert InvalidState();
    if (address(_sherlockPosition) == address(0)) revert ZeroArgument();
    if (_receiver == address(0)) revert ZeroArgument();
    if (address(_sherClaim) == address(0)) revert ZeroArgument();

    // Verify is PERIOD is active
    // Theoretically this period can be disabled during the lifetime of this contract, which will cause issues
    if (_sherlockPosition.stakingPeriods(PERIOD) == false) revert InvalidState();

    sher = _sher;
    usdc = _usdc;
    stakeRate = _stakeRate;
    buyRate = _buyRate;
    sherlockPosition = _sherlockPosition;
    receiver = _receiver;
    sherClaim = _sherClaim;

    // Do max approve in constructor as this contract will not hold any USDC
    usdc.approve(address(sherlockPosition), type(uint256).max);
  }

  function active() public view returns (bool) {
    return block.timestamp < sherClaim.claimableAt();
  }

  function viewCapitalRequirements(uint256 _sherAmountWant)
    public
    view
    returns (
      uint256 sherAmount,
      uint256 stake,
      uint256 price
    )
  {
    if (active() == false) revert InvalidState();
    if (_sherAmountWant == 0) revert ZeroArgument();

    uint256 available = sher.balanceOf(address(this));
    if (available == 0) revert SoldOut();

    // sherAmount is not able to be zero as both 'available' and '_sherAmountWant' will be bigger than 0
    sherAmount = available < _sherAmountWant ? available : _sherAmountWant;
    // Only allows SHER amounts with certain precision steps
    // To ensure there is no rounding error at loss for the contract in stake / price calculation
    // Theoretically, if `available` is used, the function can fail if '% SHER_STEPS != 0' will be true
    // This can be caused by a griefer sending a small amount of SHER to the contract
    // Realistically, no SHER tokens will be on the market when this function is active
    // So it can only be caused if the admin sends too small amounts (comment at top of file with @dev)
    if (sherAmount % SHER_STEPS != 0) revert InvalidAmount();

    stake = (sherAmount * stakeRate) / SHER_DECIMALS;
    price = (sherAmount * buyRate) / SHER_DECIMALS;
  }

  function execute(uint256 _sherAmountWant) external {
    (uint256 sherAmount, uint256 stake, uint256 price) = viewCapitalRequirements(_sherAmountWant);

    // transfer usdc from user to this, for staking (max is approved in constructor)
    usdc.safeTransferFrom(msg.sender, address(this), stake);
    // transfer usdc from user to receiver, for payment of the SHER
    usdc.safeTransferFrom(msg.sender, receiver, price);

    // stake usdc and send receipt to user
    sherlockPosition.initialStake(stake, PERIOD, msg.sender);
    // approve in function as this contract will hold SHER tokens
    sher.approve(address(sherClaim), sherAmount);
    sherClaim.add(msg.sender, sherAmount);

    // Emit event about the purchase of the sender
    emit Purchase(msg.sender, sherAmount, stake, price);
  }

  // For remaining SHER and potential locked up USDC
  function sweepTokens(IERC20[] memory _tokens) external {
    if (msg.sender != receiver) revert InvalidSender();
    if (active()) revert InvalidState();

    // Loops through the extra tokens (ERC20) provided and sends all of them to the sender address
    for (uint256 i; i < _tokens.length; i++) {
      IERC20 token = _tokens[i];
      token.safeTransfer(msg.sender, token.balanceOf(address(this)));
    }
  }
}
