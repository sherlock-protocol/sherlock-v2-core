// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/ISherlockProtocolManager.sol';

/// @title Sherlock core interface for protocols
/// @author Evert Kors
// This is the contract that manages covered protocols

contract SherlockProtocolManager is ISherlockProtocolManager, Manager {
  using SafeERC20 for IERC20;

  // Represents the token that protocols pay with (currently USDC)
  IERC20 immutable token;

  // This is the ceiling value that can be set for the threshold (based on USDC balance) at which a protocol can get removed
  uint256 constant MIN_BALANCE_SANITY_CEILING = 20_000 * 10**6; // 20k usdc

  // This is the ceiling value that can be set for the threshold (based on seconds of coverage left) at which a protocol can get removed
  uint256 constant MIN_SECS_OF_COVERAGE_SANITY_CEILING = 7 days;

  // A removed protocol is still able to make a claim for this amount of time after its removal
  uint256 constant PROTOCOL_CLAIM_DEADLINE = 7 days;

  // This is the amount that cannot be withdrawn (measured in seconds of payment) if a protocol wants to remove active balance
  uint256 constant MIN_SECONDS_LEFT = 3 days;

  // Convenient for percentage calculations
  uint256 constant HUNDRED_PERCENT = 10**18;

  // This is an address that is controlled by a covered protocol (maybe its a multisig used by that protocol, etc.)
  mapping(bytes32 => address) protocolAgent_;

  // The percentage of premiums that is NOT sent to stakers (set aside for security experts, reinsurance partners, etc.)
  mapping(bytes32 => uint256) nonStakersPercentage;

  // The premium per second paid by each protocol is stored in this mapping
  mapping(bytes32 => uint256) premiums_;

  // Each protocol should keep an active balance (in USDC) which is drawn against to pay stakers, nonstakers, etc.
  // This "active balance" is really just an accounting concept, doesn't mean tokens have been transferred or not
  mapping(bytes32 => uint256) activeBalances;

  // The timestamp at which Sherlock last ran this internal accounting (on the active balance) for each protocol 
  mapping(bytes32 => uint256) lastAccountedEachProtocol;

  // The amount that can be claimed by nonstakers for each protocol
  // We need this value so we can track how much payment is coming from each protocol 
  mapping(bytes32 => uint256) nonStakersClaimableByProtocol;

  // The last time where the global accounting was run (to calc allPremiumsPerSecToStakers below)
  uint256 lastAccountedGlobal;

  // This is the total amount of premiums paid (per second) by all the covered protocols (added up)
  uint256 allPremiumsPerSecToStakers;

  // This is the amount that was claimable by stakers the last time the accounting was run
  // The claimable amount presumably changes every second so this value is marked "last" because it is usually out-of-date
  uint256 lastClaimablePremiumsForStakers;

  // The minimum active balance (measured in USDC) a protocol must keep before arbitragers can remove the protocol from coverage
  // This is one of two criteria a protocol must meet in order to avoid removal (the other is minSecondsOfCoverage below)
  uint256 public override minActiveBalance;
  
  // The minimum active "seconds of coverage left" a protocol must have before arbitragers can remove the protocol from coverage
  // This value is calculated from a protocol's active balance divided by the premium per second the protocol is paying
  uint256 public override minSecondsOfCoverage;

  // Removed protocols can still make a claim up until this timestamp (will be 10 days or something)
  mapping(bytes32 => uint256) removedProtocolClaimDeadline;

  // Mapping to store the protocolAgents for removed protocols (useful for claims made by a removed protocol)
  mapping(bytes32 => address) removedProtocolAgent;

  // Current amount of coverage (i.e. 20M USDC) for a protocol
  mapping(bytes32 => uint256) currentCoverage;

  // Previous amount of coverage for a protocol
  // Previous is also tracked in case a protocol lowers their coverage amount but still needs to make a claim on the old, higher amount
  mapping(bytes32 => uint256) previousCoverage;

  // Setting the token to USDC
  constructor(IERC20 _token) {
    token = _token;
  }

  // Modifier used to ensure a protocol exists (has been instantiated and not removed)
  modifier protocolExists(bytes32 _protocol) {
    _verifyProtocolExists(_protocol);
    _;
  }

  /// @notice View current protocolAgent of `_protocol`
  /// @param _protocol Protocol identifier
  /// @return Address able to submit claims
  function protocolAgent(bytes32 _protocol) external view override returns (address) {
    address agent = protocolAgent_[_protocol];
    if (agent != address(0)) return agent;

    // If a protocol has been removed but is still within the claim deadline, the protocolAgent is returned
    // Note: Old protocol agent will never be address(0)
    if (block.timestamp <= removedProtocolClaimDeadline[_protocol]) {
      return removedProtocolAgent[_protocol];
    }

    // If a protocol was never instantiated or was removed and the claim deadline has passed, this error is returned
    revert ProtocolNotExists(_protocol);
  }

  // Checks if the protocol exists, then returns the current premium per second being charged
  /// @notice View current premium of protocol
  /// @param _protocol Protocol identifier
  /// @return Amount of premium `_protocol` pays per second
  function premium(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return premiums_[_protocol];
  }

  // Checks to see if a protocol has a protocolAgent assigned to it (we use this to check if a protocol exists)
  // If a protocol has been removed, it will throw an error here no matter what (even if still within claim window)
  function _verifyProtocolExists(bytes32 _protocol) internal view returns (address _protocolAgent) {
    _protocolAgent = protocolAgent_[_protocol];
    if (_protocolAgent == address(0)) revert ProtocolNotExists(_protocol);
  }

  //
  // View methods
  //

  // Calcs the debt accrued by the protocol since it last had an accounting update
  // This is the amount that needs to be removed from a protocol's active balance
  function _calcIncrementalProtocolDebt(bytes32 _protocol) internal view returns (uint256) {
    return (block.timestamp - lastAccountedEachProtocol[_protocol]) * premiums_[_protocol];
  }

  /// @notice View the amount nonstakers can claim from this protocol
  /// @param _protocol Protocol identifier
  /// @return Amount of tokens claimable by nonstakers
  /// @dev this reads from a storage variable + (now-lastsettled) * premiums
  // Question: Can nonstakers still claim rewards after protocol is removed? Seems like no?
  function nonStakersClaimable(bytes32 _protocol) external view override returns (uint256) {
    // Calcs the debt of a protocol since the last accounting update
    uint256 debt = _calcIncrementalProtocolDebt(_protocol);
    // Gets the active balance of the protocol
    uint256 balance = activeBalances[_protocol];
    // The debt should never be higher than the balance (only happens if the arbitrages fail)
    if (debt > balance) debt = balance;

    // Adds the incremental claimable amount owed to nonstakers to the total claimable amount
    return
      nonStakersClaimableByProtocol[_protocol] + (nonStakersPercentage[_protocol] * debt) / HUNDRED_PERCENT;
  }

  /// @notice View current amount of all premiums that are owed to stakers
  /// @return Premiums claimable
  /// @dev Will increase every block
  /// @dev base + (now - last_settled) * ps
  function claimablePremiums() public view override returns (uint256) {
    // Takes last balance and adds (number of seconds since last accounting update * total premiums per second)
    return lastClaimablePremiumsForStakers + (block.timestamp - lastAccountedGlobal) * allPremiumsPerSecToStakers;
  }

  /// @notice View seconds of coverage left for `_protocol` before it runs out of active balance
  /// @param _protocol Protocol identifier
  /// @return Seconds of coverage left
  function secondsOfCoverageLeft(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return _secondsOfCoverageLeft(_protocol);
  }

  // Helper function to return seconds of coverage left for a protocol
  // Gets the current active balance of the protocol and divides by the premium per second for the protocol
  function _secondsOfCoverageLeft(bytes32 _protocol) internal view returns (uint256) {
    uint256 premium = premiums_[_protocol];
    if (premium == 0) return 0;
    return _activeBalance(_protocol) / premiums_[_protocol];
  }

  /// @notice View current active balance of covered protocol
  /// @param _protocol Protocol identifier
  /// @return Active balance
  /// @dev Accrued debt is subtracted from the stored active balance
  function activeBalance(bytes32 _protocol)
    external
    view
    override
    protocolExists(_protocol)
    returns (uint256)
  {
    return _activeBalance(_protocol);
  }

  // Helper function to calc the active balance of a protocol at current time
  function _activeBalance(bytes32 _protocol) internal view returns (uint256) {
    uint256 debt = _calcIncrementalProtocolDebt(_protocol);
    uint256 balance = activeBalances[_protocol];
    // The debt should never be higher than the balance (only happens if the arbitrages fail)
    if (debt > balance) return 0;
    return balance - debt;
  }

  //
  // State methods
  //

  /// @notice Helps set the premium per second for an individual protocol
  /// @param _protocol Protocol identifier
  /// @param _premium New premium per second
  /// @return oldPremiumPerSecond and nonStakerPercentage are returned for gas savings in the calling function
  function _setSingleProtocolPremium(bytes32 _protocol, uint256 _premium)
    internal
    returns (uint256 oldPremiumPerSecond, uint256 nonStakerPercentage)
  {
    // _settleProtocolDebt() subtracts debt from the protocol's active balance and updates the % due to nonstakers
    // Also updates the last accounted timestamp for this protocol
    // nonStakerPercentage is carried over from _settleProtocolDebt() for gas savings
    // nonStakerPercentage represents the percentage that goes to nonstakers for this protocol
    nonStakerPercentage = _settleProtocolDebt(_protocol);
    // Stores the old premium before it gets updated
    oldPremiumPerSecond = premiums_[_protocol];


    if (oldPremiumPerSecond != _premium) {
      // Sets the protocol's premium per second to the new value
      premiums_[_protocol] = _premium;
      emit ProtocolPremiumChanged(_protocol, oldPremiumPerSecond, _premium);
    }
    // Doesn't allow a protocol's premium to be changed if they are able to be removed by arbs
    // Mostly doesn't allow for an update here so that it doesn't accidentally drain the protocol's active balance before arbs can remove it
    // Question: Shouldn't this be minSecondsOfCoverage not MIN_SECONDS_LEFT?
    // Question: Why don't we also check if it is < minActiveBalance?
    if (_premium != 0 && _secondsOfCoverageLeft(_protocol) < MIN_SECONDS_LEFT) {
      revert InsufficientBalance(_protocol);
    }
  }

  /// @notice Sets a single protocol's premium per second and also updates the global total of premiums per second
  /// @param _protocol Protocol identifier
  /// @param _premium New premium per second
  function _setSingleAndGlobalProtocolPremium(bytes32 _protocol, uint256 _premium) internal {
    // Sets the individual protocol's premium and returns oldPremiumPerSecond and nonStakerPercentage for gas savings
    (uint256 oldPremiumPerSecond, uint256 nonStakerPercentage) = _setSingleProtocolPremium(_protocol, _premium);
    // Settling the total amount of premiums owed to stakers before a new premium per second gets set
    _settleTotalDebt();
    // This calculates the new global premium per second that gets paid to stakers
    // We input the same nonStakerPercentage twice because we simply aren't updating that value in this function
    allPremiumsPerSecToStakers = _calcGlobalPremiumPerSecForStakers(
      oldPremiumPerSecond,
      _premium,
      nonStakerPercentage,
      nonStakerPercentage,
      allPremiumsPerSecToStakers
    );
  }

  // Internal function to set a new protocolAgent for a specific protocol
  function _setProtocolAgent(
    bytes32 _protocol,
    address _oldAgent,
    address _protocolAgent
  ) internal {
    protocolAgent_[_protocol] = _protocolAgent;
    emit ProtocolAgentTransfer(_protocol, _oldAgent, _protocolAgent);
  }

  // Subtracts the accrued debt from a protocol's active balance
  // Credits the amount that can be claimed by nonstakers for this protocol
  // Takes the protocol ID as a param and returns the nonStakerPercentage for gas savings
  // Most of this function is dealing with an edge case related to a protocol not being removed by arbs
  function _settleProtocolDebt(bytes32 _protocol) internal returns (uint256 _nonStakerPercentage) {
    // This calcs the accrued debt of the protocol since it was last updated
    uint256 debt = _calcIncrementalProtocolDebt(_protocol);
    // This pulls the percentage that is sent to nonstakers
    _nonStakerPercentage = nonStakersPercentage[_protocol];
    // This is a beginning of an 
    if (debt != 0) {
      // Pulls the stored active balance of the protocol
      uint256 balance = activeBalances[_protocol];
      // This is the start of handling an edge case where arbitragers don't remove this protocol before debt becomes greater than active balance
      // Economically spearking, this point should never be reached as arbs will get rewarded for removing the protocol before this point
      // The arb would use forceRemoveByActiveBalance and forceRemoveBySecondsOfCoverage
      // However, if arbs don't come in, the premium for this protocol should be set to 0 asap otherwise accounting for stakers/nonstakers gets messed up
      if (debt > balance) {
        // This error amount represents the magnitude of the mistake
        uint256 error = debt - balance;
        // Gets the latest value of claimable premiums for stakers
        _settleTotalDebt();
        // @note to production, set premium first to zero before solving accounting issue.
        // otherwise the accounting error keeps increasing
        uint256 lastClaimablePremiumsForStakers_ = lastClaimablePremiumsForStakers;

        // Figures out the amount due to stakers by subtracting the nonstaker percentage from 100%
        uint256 claimablePremiumError = ((HUNDRED_PERCENT - _nonStakerPercentage) * error) /
          HUNDRED_PERCENT;

        // This insufficient tokens var is simply how we know (emitted as an event) how many tokens the protocol is short
        uint256 insufficientTokens;

        // The idea here is that claimablePremiumsStored has gotten too big accidentally
        // We need to decrease the balance of claimablePremiumsStored by the amount that was added in error
        // Question: How could claimablePremiumError ever be bigger than claimablePremiumsStored?
        // Question: How does it make sense to subtract lastClaimablePremiumsForStakers_ from claimablePremiumError?
        if (claimablePremiumError > lastClaimablePremiumsForStakers_) {
          insufficientTokens = claimablePremiumError - lastClaimablePremiumsForStakers_;
          lastClaimablePremiumsForStakers = 0;
        } else {
          // If the error is not bigger than the claimable premiums, then we just decrease claimable premiums
          // By the amount that was added in error (error) and insufficientTokens = 0
          lastClaimablePremiumsForStakers = lastClaimablePremiumsForStakers_ - claimablePremiumError;
        }

        // If two events are thrown, the values need to be summed up for the actual state.
        // Question: What does the line above mean?
        emit AccountingError(_protocol, claimablePremiumError, insufficientTokens);
        // We set the debt equal to the balance, and in the next line we effectively set the protocol's active balance to 0 in this case
        debt = balance;
      }
      // Subtracts the accrued debt (since last update) from the protocol's active balance and updates active balance
      activeBalances[_protocol] = balance - debt;
      // Adds the requisite amount of the debt to the balance claimable by nonstakers for this protocol
      nonStakersClaimableByProtocol[_protocol] += (_nonStakerPercentage * debt) / HUNDRED_PERCENT;
    }
    // Updates the last accounted timestamp for this protocol
    lastAccountedEachProtocol[_protocol] = block.timestamp;
  }

  // Multiplies the total premium per second * number of seconds since the last global accounting update
  // And adds it to the total claimable amount for stakers
  function _settleTotalDebt() internal {
    lastClaimablePremiumsForStakers += (block.timestamp - lastAccountedGlobal) * allPremiumsPerSecToStakers;
    lastAccountedGlobal = block.timestamp;
  }

  // Calculates the global premium per second for stakers
  // Takes a specific protocol's old and new values for premium per second and nonstaker percentage and the old global premium per second to stakers
  // Subtracts out the old values of a protocol's premium per second and nonstaker percentage and adds the new ones 
  function _calcGlobalPremiumPerSecForStakers(
    uint256 _premiumOld,
    uint256 _premiumNew,
    uint256 _nonStakerPercentageOld,
    uint256 _nonStakerPercentageNew,
    uint256 _inMemAllPremiumsPerSecToStakers
  ) internal pure returns (uint256) {
    return
      _inMemAllPremiumsPerSecToStakers +
      ((HUNDRED_PERCENT - _nonStakerPercentageNew) * _premiumNew) /
      HUNDRED_PERCENT -
      ((HUNDRED_PERCENT - _nonStakerPercentageOld) * _premiumOld) /
      HUNDRED_PERCENT;
  }

  // Helper function to remove and clean up a protocol from Sherlock
  // Takes the protocol ID and the protocol agent to which funds should be sent and from which post-removal claims can be made
  function _forceRemoveProtocol(bytes32 _protocol, address _agent) internal {
    // Sets the individual protocol's premium to zero and updates the global premium variable for a zero premium at this protocol
    _setSingleAndGlobalProtocolPremium(_protocol, 0);

    // Grabs the protocol's active balance
    uint256 balance = activeBalances[_protocol];

    // If there's still some active balance, delete the entry and send the remaining balance to the protocol agent
    if (balance != 0) {
      delete activeBalances[_protocol];
      token.safeTransfer(_agent, balance);

      emit ProtocolBalanceWithdrawn(_protocol, balance);
    }

    // Sets the protocol agent to zero address (as part of clean up)
    _setProtocolAgent(_protocol, _agent, address(0));
    
    // Cleans up other mappings for this protocol
    delete nonStakersPercentage[_protocol];
    delete lastAccountedEachProtocol[_protocol];

    // Sets a deadline in the future until which this protocol agent can still make claims for this removed protocol
    removedProtocolClaimDeadline[_protocol] = block.timestamp + PROTOCOL_CLAIM_DEADLINE;

    // This mapping allows Sherlock to verify the protocol agent making a claim after the protocol has been removed
    // Remember, only the protocol agent can make claims on behalf of the protocol, so this must be checked
    removedProtocolAgent[_protocol] = _agent;

    emit ProtocolUpdated(_protocol, bytes32(0), uint256(0), uint256(0));
    emit ProtocolRemoved(_protocol);
  }


  /// @notice Sets the minimum active balance before an arb can remove a protocol
  /// @param _minActiveBalance Minimum balance needed (in USDC)
  /// @dev Only gov
  function setMinActiveBalance(uint256 _minActiveBalance) external override onlyOwner {
    // Can't set a value that is too high to be reasonable
    require(_minActiveBalance < MIN_BALANCE_SANITY_CEILING, 'INSANE');

    emit MinBalance(minActiveBalance, _minActiveBalance);
    minActiveBalance = _minActiveBalance;
  }

  /// @notice Sets the minimum active balance (as measured in seconds of coverage left) before an arb can remove a protocol
  /// @param _minSeconds Minimum seconds of coverage needed
  /// @dev Only gov
  function setMinSecondsOfCoverage(uint256 _minSeconds) external override onlyOwner {
    // Can't set a value that is too high to be reasonable
    require(_minSeconds < MIN_SECS_OF_COVERAGE_SANITY_CEILING, 'INSANE');

    emit MinSecondsOfCoverage(minSecondsOfCoverage, _minSeconds);
    minSecondsOfCoverage = _minSeconds;
  }

  // This function allows the nonstakers role to claim tokens owed to them by a specific protocol
  /// @notice Choose an `_amount` of tokens that nonstakers (`_receiver` address) will receive from `_protocol`
  /// @param _protocol Protocol identifier
  /// @param _amount Amount of tokens
  /// @param _receiver Address to receive tokens
  /// @dev Only callable by nonstakers role
  function nonStakersClaim(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver
  ) external override {
    if (_protocol == bytes32(0)) revert ZeroArgument();
    if (_amount == uint256(0)) revert ZeroArgument();
    if (_receiver == address(0)) revert ZeroArgument();
    // Only the nonstakers role (multisig or contract) can pull the funds
    if (msg.sender != sherlockCore.nonStakersAddress()) revert Unauthorized();

    // Call can't be executed on protocol that is removed
    if (protocolAgent_[_protocol] != address(0)) {
      // Updates the amount that nonstakers can claim from this protocol 
      _settleProtocolDebt(_protocol);
    }

    // Sets balance to the amount that is claimable by nonstakers for this specific protocol
    uint256 balance = nonStakersClaimableByProtocol[_protocol];
    // If the amount requested is more than what's owed to nonstakers, revert
    if (_amount > balance) revert InsufficientBalance(_protocol);

    // Sets the claimable amount to whatever is left over after this amount is pulled
    nonStakersClaimableByProtocol[_protocol] = balance - _amount;
    // Transfers the amount requested to the nonstaker address
    token.safeTransfer(_receiver, _amount);
  }

  // Transfers funds owed to stakers from this contract to the Sherlock core contract (where we handle paying out stakers)
  /// @notice Transfer current claimable premiums (for stakers) to core Sherlock address
  /// @dev Callable by everyone
  /// @dev Will be called by burn() in Sherlock core contract
  /// @dev Funds will be transferred to Sherlock core contract
  function claimPremiumsForStakers() external override {
    // Gets address of core Sherlock contract
    address sherlock = address(sherlockCore);
    // Revert if core Sherlock contract not initialized yet
    if (sherlock == address(0)) revert InvalidConditions();

    // Question: What is difference between this function and _settleTotalDebt()?
    // Retrieves current amount of all premiums that are owed to stakers
    uint256 amount = claimablePremiums();
    // Global value of premiums owed to stakers is set to zero since we are transferring the entire amount out
    lastClaimablePremiumsForStakers = 0;
    lastAccountedGlobal = block.timestamp;

    // Transfers all the premiums owed to stakers to the Sherlock core contract
    if (amount != 0) {
      token.safeTransfer(sherlock, amount);
    }
  }

  /// @inheritdoc ISherlockProtocolManager
  function coverageAmounts(bytes32 _protocol)
    external
    view
    override
    returns (uint256 current, uint256 previous)
  {
    if (
      protocolAgent_[_protocol] != address(0) ||
      block.timestamp <= removedProtocolClaimDeadline[_protocol]
    ) {
      return (currentCoverage[_protocol], previousCoverage[_protocol]);
    }

    revert ProtocolNotExists(_protocol);
  }

  /// @inheritdoc ISherlockProtocolManager
  function protocolAdd(
    bytes32 _protocol,
    address _protocolAgent,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) external override onlyOwner {
    if (_protocol == bytes32(0)) revert ZeroArgument();
    if (_protocolAgent == address(0)) revert ZeroArgument();
    if (protocolAgent_[_protocol] != address(0)) revert InvalidConditions();

    _setProtocolAgent(_protocol, address(0), _protocolAgent);

    // Delete mappings that are potentially non default values
    // From previous time protocol was added/removed
    delete removedProtocolClaimDeadline[_protocol];
    delete removedProtocolAgent[_protocol];
    delete currentCoverage[_protocol];
    delete previousCoverage[_protocol];

    emit ProtocolAdded(_protocol);
    protocolUpdate(_protocol, _coverage, _nonStakers, _coverageAmount);
  }

  /// @inheritdoc ISherlockProtocolManager
  function protocolUpdate(
    bytes32 _protocol,
    bytes32 _coverage,
    uint256 _nonStakers,
    uint256 _coverageAmount
  ) public override onlyOwner {
    if (_coverage == bytes32(0)) revert ZeroArgument();
    if (_nonStakers > HUNDRED_PERCENT) revert InvalidArgument();
    if (_coverageAmount == uint256(0)) revert ZeroArgument();
    _verifyProtocolExists(_protocol);

    _settleProtocolDebt(_protocol);
    _settleTotalDebt();

    uint256 premium = premiums_[_protocol];
    allPremiumsPerSecToStakers = _calcGlobalPremiumPerSecForStakers(
      premium,
      premium,
      nonStakersPercentage[_protocol],
      _nonStakers,
      allPremiumsPerSecToStakers
    );
    nonStakersPercentage[_protocol] = _nonStakers;

    previousCoverage[_protocol] = currentCoverage[_protocol];
    currentCoverage[_protocol] = _coverageAmount;

    emit ProtocolUpdated(_protocol, _coverage, _nonStakers, _coverageAmount);
  }

  /// @inheritdoc ISherlockProtocolManager
  function protocolRemove(bytes32 _protocol) external override onlyOwner {
    address agent = _verifyProtocolExists(_protocol);

    _forceRemoveProtocol(_protocol, agent);
  }

  /// @inheritdoc ISherlockProtocolManager
  function forceRemoveByActiveBalance(bytes32 _protocol) external override {
    address agent = _verifyProtocolExists(_protocol);

    _settleProtocolDebt(_protocol);
    uint256 remainingBalance = activeBalances[_protocol];

    if (remainingBalance >= minActiveBalance) revert InvalidConditions();
    if (remainingBalance != 0) {
      activeBalances[_protocol] = 0;
      token.safeTransfer(msg.sender, remainingBalance);
    }

    _forceRemoveProtocol(_protocol, agent);
    emit ProtocolRemovedByArb(_protocol, msg.sender, remainingBalance);
  }

  /// @inheritdoc ISherlockProtocolManager
  function forceRemoveBySecondsOfCoverage(bytes32 _protocol) external override {
    address agent = _verifyProtocolExists(_protocol);

    uint256 percentageScaled = (_secondsOfCoverageLeft(_protocol) * HUNDRED_PERCENT) /
      minSecondsOfCoverage;

    // the first epoch you'll get the minimal reward
    if (percentageScaled >= HUNDRED_PERCENT) revert InvalidConditions();

    _settleProtocolDebt(_protocol);
    uint256 remainingBalance = activeBalances[_protocol];

    uint256 arbAmount = (remainingBalance * percentageScaled) / HUNDRED_PERCENT;
    if (arbAmount != 0) {
      activeBalances[_protocol] -= arbAmount;
    }

    _forceRemoveProtocol(_protocol, agent);

    // done after removing protocol to mitigate reentrency pattern
    // (in case token allows callback)
    if (arbAmount != 0) {
      token.safeTransfer(msg.sender, arbAmount);
    }
    emit ProtocolRemovedByArb(_protocol, msg.sender, arbAmount);
  }

  /// @inheritdoc ISherlockProtocolManager
  function setProtocolPremium(bytes32 _protocol, uint256 _premium) external override onlyOwner {
    _verifyProtocolExists(_protocol);

    _setSingleAndGlobalProtocolPremium(_protocol, _premium);
  }

  /// @inheritdoc ISherlockProtocolManager
  function setProtocolPremiums(bytes32[] calldata _protocol, uint256[] calldata _premium)
    external
    override
    onlyOwner
  {
    if (_protocol.length != _premium.length) revert UnequalArrayLength();
    if (_protocol.length == 0) revert InvalidArgument();

    _settleTotalDebt();

    uint256 allPremiumsPerSecToStakers_ = allPremiumsPerSecToStakers;
    for (uint256 i; i < _protocol.length; i++) {
      _verifyProtocolExists(_protocol[i]);

      (uint256 oldPremiumPerSecond, uint256 nonStakerPercentage) = _setSingleProtocolPremium(
        _protocol[i],
        _premium[i]
      );

      allPremiumsPerSecToStakers_ = _calcGlobalPremiumPerSecForStakers(
        oldPremiumPerSecond,
        _premium[i],
        nonStakerPercentage,
        nonStakerPercentage,
        allPremiumsPerSecToStakers_
      );
    }

    allPremiumsPerSecToStakers = allPremiumsPerSecToStakers_;
  }

  /// @inheritdoc ISherlockProtocolManager
  function depositToActiveBalance(bytes32 _protocol, uint256 _amount) external override {
    if (_amount == uint256(0)) revert ZeroArgument();
    _verifyProtocolExists(_protocol);

    token.safeTransferFrom(msg.sender, address(this), _amount);
    activeBalances[_protocol] += _amount;

    emit ProtocolBalanceDeposited(_protocol, _amount);
  }

  /// @inheritdoc ISherlockProtocolManager
  function withdrawActiveBalance(bytes32 _protocol, uint256 _amount) external override {
    if (_amount == uint256(0)) revert ZeroArgument();
    if (msg.sender != _verifyProtocolExists(_protocol)) revert Unauthorized();

    // settle debt first just to make absolutely sure no extra tokens can be withdrawn
    _settleProtocolDebt(_protocol);

    uint256 currentBalance = activeBalances[_protocol];
    if (_amount > currentBalance) revert InsufficientBalance(_protocol);

    activeBalances[_protocol] = currentBalance - _amount;
    if (_secondsOfCoverageLeft(_protocol) < MIN_SECONDS_LEFT) revert InsufficientBalance(_protocol);

    token.safeTransfer(msg.sender, _amount);
    emit ProtocolBalanceWithdrawn(_protocol, _amount);
  }

  /// @inheritdoc ISherlockProtocolManager
  function transferProtocolAgent(bytes32 _protocol, address _protocolAgent) external override {
    if (_protocolAgent == address(0)) revert ZeroArgument();
    if (msg.sender == _protocolAgent) revert InvalidArgument();
    if (msg.sender != _verifyProtocolExists(_protocol)) revert Unauthorized();

    _setProtocolAgent(_protocol, msg.sender, _protocolAgent);
  }

  function isActive() public view returns (bool) {
    return address(sherlockCore.sherlockProtocolManager()) == address(this);
  }

  function sweep(address _receiver, IERC20[] memory _extraTokens) external onlyOwner {
    require(!isActive());
    _sweep(_receiver, _extraTokens);
  }
}
