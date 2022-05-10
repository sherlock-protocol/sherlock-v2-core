const { parseUnits, id, keccak256 } = require('ethers/lib/utils');
const { constants } = require('ethers');

const TIMELOCK_ADMIN_ROLE = '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5';
const PROPOSER_ROLE = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
const EXECUTOR_ROLE = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';

const WEEK = parseInt(60 * 60 * 24 * 7);

async function main() {
  //
  // CONFIG
  //

  [signer] = await ethers.getSigners();

  let MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  let EOA_ONE = '0xE400820f3D60d77a3EC8018d44366ed0d334f93C';
  let EOA_TWO = '0x4cf5F3EcD6303F6a04480F75ac394D4bB3816F83';

  if (network.name == 'goerli') {
    MULTISIG = '0x34EDB6fD102578De64CaEbe82f540fB3E47a05EA';
    EOA_ONE = '0xE400820f3D60d77a3EC8018d44366ed0d334f93C';
    EOA_TWO = '0x4cf5F3EcD6303F6a04480F75ac394D4bB3816F83';
  }

  const TimelockController = '0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4';
  const Sherlock = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
  const AaveV2Strategy = '0xF02d3A6288D998B412ce749cfF244c8ef799f582';
  const SherDistributionManager = '0x5775F32787656E77dd99f20F4E478DdC85fdB31b';
  const SherlockProtocolManager = '0x3d0b8A0A10835Ab9b0f0BeB54C5400B8aAcaa1D3';
  const SherlockClaimManager = '0xFeEDD254ae4B7c44A0472Bb836b813Ce4625Eb84';
  const SherClaim = '0x7289C61C75dCdB8Fe4DF0b937c08c9c40902BDd3';
  const SherBuy = '0xf8583f22C2f6f8cd27f62879A0fB4319bce262a6';

  //
  // END CONFIG
  //
  const sherlock = await ethers.getContractAt('Sherlock', Sherlock);
  const aaveV2Strategy = await ethers.getContractAt('AaveV2Strategy', AaveV2Strategy);
  const sherDistributionManager = await ethers.getContractAt(
    'SherDistributionManager',
    SherDistributionManager,
  );
  const sherlockProtocolManager = await ethers.getContractAt(
    'SherlockProtocolManager',
    SherlockProtocolManager,
  );
  const sherlockClaimManager = await ethers.getContractAt(
    'SherlockClaimManager',
    SherlockClaimManager,
  );
  const sherBuy = await ethers.getContractAt('SherBuy', SherBuy);
  const sherClaim = await ethers.getContractAt('SherClaim', SherClaim);
  const timelockController = await ethers.getContractAt('TimelockController', TimelockController);

  console.log('OWNER');
  console.log('sherlock', await sherlock.owner());
  console.log('aaveV2Strategy', await aaveV2Strategy.owner());
  console.log('sherDistributionManager', await sherDistributionManager.owner());
  console.log('sherlockProtocolManager', await sherlockProtocolManager.owner());
  console.log('sherlockClaimManager', await sherlockClaimManager.owner());

  console.log('-------------------------------------------------');

  console.log('SHERLOCK');
  console.log('MIN_STAKE', (await sherlock.MIN_STAKE()).toString());
  console.log('ARB_RESTAKE_WAIT_TIME', (await sherlock.ARB_RESTAKE_WAIT_TIME()).toString());
  console.log('ARB_RESTAKE_GROWTH_TIME', (await sherlock.ARB_RESTAKE_GROWTH_TIME()).toString());
  console.log('ARB_RESTAKE_PERIOD', (await sherlock.ARB_RESTAKE_PERIOD()).toString());
  console.log(
    'ARB_RESTAKE_MAX_PERCENTAGE',
    (await sherlock.ARB_RESTAKE_MAX_PERCENTAGE()).toString(),
  );
  console.log('token', await sherlock.token());
  console.log('sher', await sherlock.sher());
  console.log('stakingPeriods [13w]', await sherlock.stakingPeriods(WEEK * 13));
  console.log('stakingPeriods [26w]', await sherlock.stakingPeriods(WEEK * 26));
  console.log('stakingPeriods [52w]', await sherlock.stakingPeriods(WEEK * 52));
  console.log('yieldStrategy', await sherlock.yieldStrategy());
  console.log('sherDistributionManager', await sherlock.sherDistributionManager());
  console.log('sherlockProtocolManager', await sherlock.sherlockProtocolManager());
  console.log('sherlockClaimManager', await sherlock.sherlockClaimManager());
  console.log('nonStakersAddress', await sherlock.nonStakersAddress());
  console.log('name', await sherlock.name());
  console.log('symbol', await sherlock.symbol());
  console.log('paused', await sherlock.paused());

  console.log('-------------------------------------------------');

  console.log('TimelockController');
  console.log('getMinDelay', await timelockController.getMinDelay());
  console.log('MULTISIG, admin?', await timelockController.hasRole(TIMELOCK_ADMIN_ROLE, MULTISIG));
  console.log('EOA_ONE, admin?', await timelockController.hasRole(TIMELOCK_ADMIN_ROLE, EOA_ONE));
  console.log('EOA_TWO, admin?', await timelockController.hasRole(TIMELOCK_ADMIN_ROLE, EOA_TWO));
  console.log('MULTISIG, proposer?', await timelockController.hasRole(PROPOSER_ROLE, MULTISIG));
  console.log('EOA_ONE, proposer?', await timelockController.hasRole(PROPOSER_ROLE, EOA_ONE));
  console.log('EOA_TWO, proposer?', await timelockController.hasRole(PROPOSER_ROLE, EOA_TWO));
  console.log('MULTISIG, executor?', await timelockController.hasRole(EXECUTOR_ROLE, MULTISIG));
  console.log('EOA_ONE, executor?', await timelockController.hasRole(EXECUTOR_ROLE, EOA_ONE));
  console.log('EOA_TWO, executor?', await timelockController.hasRole(EXECUTOR_ROLE, EOA_TWO));

  console.log('-------------------------------------------------');

  if (network.name == 'mainnet') {
    console.log('AaveV2Strategy');
    console.log('LP_ADDRESS_PROVIDER', await sherlock.LP_ADDRESS_PROVIDER());
    console.log('aaveIncentivesController', await sherlock.aaveIncentivesController());
    console.log('want', await sherlock.want());
    console.log('aWant', await sherlock.aWant());
    console.log('aaveLmReceiver', await sherlock.aaveLmReceiver());
    console.log('getLp', await sherlock.getLp());
    console.log('isActive', await sherlock.isActive());
    console.log('paused', await sherlock.paused());
    // CHECK FOR `SherlockCoreSet` event
  }
  console.log('-------------------------------------------------');

  console.log('SherDistributionManager');
  console.log('isActive', await sherDistributionManager.isActive());
  console.log('paused', await sherDistributionManager.paused());
  // CHECK FOR `SherlockCoreSet` event

  console.log('-------------------------------------------------');

  console.log('SherlockProtocolManager');
  console.log('token', await sherlockProtocolManager.token());
  console.log(
    'MIN_BALANCE_SANITY_CEILING',
    (await sherlockProtocolManager.MIN_BALANCE_SANITY_CEILING()).toString(),
  );
  console.log(
    'PROTOCOL_CLAIM_DEADLINE',
    (await sherlockProtocolManager.PROTOCOL_CLAIM_DEADLINE()).toString(),
  );
  console.log('MIN_SECONDS_LEFT', (await sherlockProtocolManager.MIN_SECONDS_LEFT()).toString());
  console.log(
    'MIN_SECONDS_OF_COVERAGE',
    (await sherlockProtocolManager.MIN_SECONDS_OF_COVERAGE()).toString(),
  );
  console.log('minActiveBalance', (await sherlockProtocolManager.minActiveBalance()).toString());
  console.log('isActive', await sherlockProtocolManager.isActive());
  console.log('paused', await sherlockProtocolManager.paused());
  // CHECK FOR `SherlockCoreSet` event

  console.log('-------------------------------------------------');

  console.log('SherlockClaimManager');
  console.log('ESCALATE_TIME', (await sherlockClaimManager.ESCALATE_TIME()).toString());
  console.log('UMAHO_TIME', (await sherlockClaimManager.UMAHO_TIME()).toString());
  console.log('SPCC_TIME', (await sherlockClaimManager.SPCC_TIME()).toString());
  console.log('UMA_IDENTIFIER', await sherlockClaimManager.UMA_IDENTIFIER());
  console.log('MAX_CALLBACKS', await sherlockClaimManager.MAX_CALLBACKS());
  console.log('UMA', await sherlockClaimManager.UMA());
  console.log('TOKEN', await sherlockClaimManager.TOKEN());
  console.log('umaHaltOperator', await sherlockClaimManager.umaHaltOperator());
  console.log(
    'sherlockProtocolClaimsCommittee',
    await sherlockClaimManager.sherlockProtocolClaimsCommittee(),
  );
  console.log('paused', await sherlockClaimManager.paused());
  // CHECK FOR `SherlockCoreSet` event

  console.log('-------------------------------------------------');
  console.log('SherBuy');
  console.log('PERIOD', (await sherBuy.PERIOD()).toString());
  console.log('sher', await sherBuy.sher());
  console.log('usdc', await sherBuy.usdc());
  console.log('stakeRate', (await sherBuy.stakeRate()).toString());
  console.log('buyRate', (await sherBuy.buyRate()).toString());
  console.log('sherlockPosition', await sherBuy.sherlockPosition());
  console.log('receiver', await sherBuy.receiver());
  console.log('sherClaim', await sherBuy.sherClaim());
  console.log('active', await sherBuy.active());

  console.log('-------------------------------------------------');
  console.log('SherClaim');
  console.log('newEntryDeadline', (await sherClaim.newEntryDeadline()).toString());
  console.log('sher', await sherClaim.sher());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
