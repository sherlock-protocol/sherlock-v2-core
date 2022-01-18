// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import './interfaces/IBuySher.sol';
import './interfaces/IBuySherClaim.sol';

/// @title Sherlock core interface for stakers
/// @author Evert Kors
// This is the contract that manages the buying of SHER tokens
// Tokens can be bought at a fixed price
// Tokens can only be bought if the sender owns a sherlock staking position
// For every staking positon the sender has, tokens can be bought once
// The max amount that can be bought is based on the USDC value of the position, using a fixed rate.
// On every buy USDC will be sent to the received (multisig)
// SHER tokens will be transferred to this contract after deployment
contract BuySher is IBuySher {
  using SafeERC20 for IERC20;

  uint256 internal constant FUNDING_PERIOD_SANITY_BOTTOM = 7 days;
  uint256 internal constant FUNDING_PERIOD_SANITY_CEILING = 8 days;
  uint256 internal constant USDC_DECIMALS = 10**6;
  uint256 internal constant SHER_DECIMALS = 10**18;

  // SHER token address (18 decimals)
  IERC20 public immutable override sher;
  // USDC token address (6 decimals)
  IERC20 public immutable override usdc;
  // 10**18 means 1 USDC of the position is able to buy 1 SHER token
  uint256 public immutable override rate;
  // 10**6 means 1 USDC transferred will buy 1 SHER token
  uint256 public immutable override price;
  // The `Sherlock.sol` contract that is a ERC721
  ISherlock public immutable override sherlockPosition;
  // Track if NFT IDs have been used to make a purchase
  mapping(uint256 => bool) public sherlockPositionUsed;
  // Address receiving the USDC payments
  address public immutable receiver;
  // Final deadline when sale ends
  uint256 public immutable override deadline;
  // Contract to claim SHER at
  IBuySherClaim public immutable claimAt;

  /// @notice Construct BuySher contract
  /// @param _sher ERC20 contract for SHER token
  /// @param _usdc ERC20 contract for USDC token
  /// @param _rate Rate at which position USDC converts to the amount of SHER able to buy
  /// @param _price Price at which SHER can be bought at
  /// @param _sherlockPosition ERC721 contract of Sherlock positions
  /// @param _receiver Address that receives USDC from purchases
  constructor(
    IERC20 _sher,
    IERC20 _usdc,
    uint256 _rate,
    uint256 _price,
    ISherlock _sherlockPosition,
    address _receiver,
    IBuySherClaim _claimAt,
    uint256 _deadline
  ) {
    if (address(_sher) == address(0)) revert ZeroArgument();
    if (address(_usdc) == address(0)) revert ZeroArgument();
    if (_rate == 0) revert ZeroArgument();
    if (_price == 0) revert ZeroArgument();
    if (address(_sherlockPosition) == address(0)) revert ZeroArgument();
    if (_receiver == address(0)) revert ZeroArgument();
    if (_deadline < block.timestamp + FUNDING_PERIOD_SANITY_BOTTOM) revert InvalidState();
    if (_deadline > block.timestamp + FUNDING_PERIOD_SANITY_CEILING) revert InvalidState();

    sher = _sher;
    usdc = _usdc;
    rate = _rate;
    price = _price;
    sherlockPosition = _sherlockPosition;
    receiver = _receiver;
    deadline = _deadline;
    claimAt = _claimAt;
  }

  /// @notice View how much SHER you can buy using a staking position
  /// @param _sherlockPositionID ID of the staking position
  /// @return Max amount of SHER tokens that can be bought
  function viewBuyLimit(uint256 _sherlockPositionID) public view returns (uint256) {
    // In case the staking position has already been used to buy SHER it will revert
    if (sherlockPositionUsed[_sherlockPositionID]) revert AlreadyUsed();

    // It is known that the underlying usdc amount will be higher as the strategy yield and premiums come in
    // This will increase the buying power over time
    uint256 usdcBalance = sherlockPosition.tokenBalanceOf(_sherlockPositionID);
    // How much SHER can be bought using the stored rate
    uint256 maxSherAmount = (usdcBalance * rate) / USDC_DECIMALS;
    // How much SHER is actually in the contract
    uint256 contractSherBalance = sher.balanceOf(address(this));

    // Return `contractSherBalance` if `maxSherAmount` exceeds it
    // Else return `maxSherAmount`
    return (contractSherBalance < maxSherAmount) ? contractSherBalance : maxSherAmount;
  }

  /// @notice View how much USDC it will cost to buy `_amountOfSher` SHER
  /// @param _amountOfSher The amount of SHER tokens to buy
  /// @return Amount of USDC it will cost
  function viewCosts(uint256 _amountOfSher) public view returns (uint256) {
    return (_amountOfSher * price) / SHER_DECIMALS;
  }

  function recoverRemainingSher() external {
    if (msg.sender != receiver) revert InvalidSender();
    if (block.timestamp < deadline) revert InvalidState();

    uint256 amount = sher.balanceOf(address(this));
    if (amount == 0) revert InvalidAmount();

    sher.safeTransfer(msg.sender, amount);
  }

  /// @notice Buy `_amountOfSher` SHER tokens using positions with ID: `_sherlockPositionID`
  /// @param _sherlockPositionID The ID of the Sherlock position
  /// @param _amountOfSher The amount of SHER to buy
  /// @dev Will transfer USDC amount to receiver
  function buy(
    uint256 _sherlockPositionID,
    uint256 _amountOfSher,
    address _sherReceiver
  ) external override {
    if (_sherlockPositionID == 0) revert ZeroArgument();
    if (_amountOfSher == 0) revert ZeroArgument();
    if (block.timestamp > deadline) revert InvalidState();
    // Verify if the sender is actually the owner of the referenced positiond ID
    if (msg.sender != sherlockPosition.ownerOf(_sherlockPositionID)) revert InvalidSender();

    // viewBuyLimit will revert is sherlockPositionUsed = true
    if (_amountOfSher > viewBuyLimit(_sherlockPositionID)) revert InvalidAmount();
    // Register the positions as being used to buy SHER tokens
    sherlockPositionUsed[_sherlockPositionID] = true;

    // The costs of buying `_amountOfSher`
    uint256 costs = viewCosts(_amountOfSher);
    // USDC will be sent to receiver, which is a multisig
    usdc.safeTransferFrom(msg.sender, receiver, costs);
    // SHER will be locked until it can be unlocked
    sher.approve(address(claimAt), _amountOfSher);
    claimAt.add(_sherReceiver, _amountOfSher);

    // Emit event about the purchase of the sender
    emit Purchase(msg.sender, _sherReceiver, costs, _amountOfSher);
  }
}
