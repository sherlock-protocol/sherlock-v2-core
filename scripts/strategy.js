const { BigNumber } = require('ethers');
const { ethers } = require('hardhat');

// ========= ADDRESSES =========
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const Sherlock = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
const aUSDC = '0xBcca60bB61934080951369a648Fb03DF4F96263C';

async function transferOwnership(sherlock, newOwner) {
  console.log('TRANSFERRING OWNERSHIP (START)'.padStart(64, '='));
  console.log('Current owner of Sherlock:', await sherlock.owner());

  // Transfer ownership by changing the storage
  console.log('Read storage value:', await ethers.provider.getStorageAt(sherlock.address, 6));
  await ethers.provider.send('hardhat_setStorageAt', [
    sherlock.address,
    '0x6',
    ethers.utils.hexlify(ethers.utils.zeroPad(newOwner, 32)),
  ]);
  await ethers.provider.send('evm_mine', []);
  console.log('New storage value', await ethers.provider.getStorageAt(sherlock.address, 6));

  console.log('Owner of Sherlock after change:', await sherlock.owner());
  console.log('TRANSFERRING OWNERSHIP (END)'.padStart(64, '='));
}

/**
 * Withdraw existing USDC from Aave strategy
 */
async function withdrawUsdcFromOldStrategy(sherlock, usdc, owner) {
  console.log('WITHDRAW FUNDS FROM OLD STRATEGY (START)'.padStart(64, '='));
  const oldStrategy = await ethers.getContractAt('AaveV2Strategy', await sherlock.yieldStrategy());
  console.log(
    'Sherlock USDC balance:',
    ethers.utils.formatUnits(await usdc.balanceOf(Sherlock), 6),
  );
  console.log(
    'Sherlock Strategy USDC balance:',
    ethers.utils.formatUnits(await oldStrategy.balanceOf(), 6),
  );

  await sherlock.connect(owner).yieldStrategyWithdrawAll();
  console.log(
    'Sherlock Strategy USDC balance after withdraw:',
    ethers.utils.formatUnits(await oldStrategy.balanceOf(), 6),
  );
  console.log(
    'Sherlock USDC balance after withdraw:',
    ethers.utils.formatUnits(await usdc.balanceOf(Sherlock), 6),
  );
  console.log('WITHDRAW FUNDS FROM OLD STRATEGY (END)'.padStart(64, '='));
}

/**
 * Deploy new strategy
 */
async function deployStrategy(owner) {
  /**
   *                                                                --> CompoundStrategy
                                                                   /
   *                                                              / 
   * INFO STORAGE -> MASTER STRATEGY -> ABEqualDepositSplitter --
   *                                                              \                               --> MapleStrategy
   *                                                               \                             /
   *                                                                --> ABEqualDepositSplitter --
   *                                                                                             \
   *                                                                                              --> TrueFiStrategy
   */
  console.log('DEPLOYING STRATEGY (START)'.padStart(64, '='));

  const InfoStorage = await ethers.getContractFactory('InfoStorage');
  const MasterStrategy = await ethers.getContractFactory('MasterStrategy');
  const AlphaBetaEqualDepositSplitter = await ethers.getContractFactory(
    'AlphaBetaEqualDepositSplitter',
  );
  const CompoundStrategy = await ethers.getContractFactory('CompoundStrategy');
  const MapleStrategy = await ethers.getContractFactory('MapleStrategy');
  const TrueFiStrategy = await ethers.getContractFactory('TrueFiStrategy');

  // Deploy info storage
  const infoStorage = await InfoStorage.deploy(USDC, Sherlock);
  await infoStorage.deployed();
  console.log('Info Storage deployed at:', infoStorage.address);

  // Deploy master strategy
  const masterStrategy = await MasterStrategy.deploy(infoStorage.address);
  await masterStrategy.deployed();
  console.log('MasterStrategy deployed at:', masterStrategy.address);

  // Deploy root splitter
  const rootSplitter = await AlphaBetaEqualDepositSplitter.deploy(
    masterStrategy.address,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    1,
  );
  await rootSplitter.deployed();
  console.log('Root splitter deployed at:', rootSplitter.address);

  // Deploy Compound strategy
  const compoundStrategy = await CompoundStrategy.deploy(rootSplitter.address);
  await compoundStrategy.deployed();
  await rootSplitter.setInitialChildOne(compoundStrategy.address);
  console.log('Compound strategy deployed at:', compoundStrategy.address);

  // Deploy second splitter
  const secondSplitter = await AlphaBetaEqualDepositSplitter.deploy(
    rootSplitter.address,
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    1,
  );
  await secondSplitter.deployed();
  console.log('Second splitter deployed at:', rootSplitter.address);

  // Deploy Maple strategy
  const mapleStrategy = await MapleStrategy.deploy(
    secondSplitter.address,
    '0x7C57bF654Bc16B0C9080F4F75FF62876f50B8259',
  );
  await mapleStrategy.deployed();
  await secondSplitter.setInitialChildOne(mapleStrategy.address);
  console.log('Maple strategy deployed at:', mapleStrategy.address);

  // Deploy TrueFi strategy
  const truefiStrategy = await TrueFiStrategy.deploy(secondSplitter.address);
  await truefiStrategy.deployed();
  await secondSplitter.setInitialChildTwo(truefiStrategy.address);
  console.log('TrueFi strategy deployed at:', truefiStrategy.address);

  await rootSplitter.setInitialChildTwo(secondSplitter.address);
  await masterStrategy.setInitialChildOne(rootSplitter.address);

  console.log('DEPLOYING STRATEGY (END)'.padStart(64, '='));

  return {
    infoStorage,
    masterStrategy,
    rootSplitter,
    compoundStrategy,
    mapleStrategy,
    truefiStrategy,
  };
}

/**
 * Update Sherlock strategy to the new strategy
 */
async function updateStrategy(sherlock, owner, newStrategy) {
  console.log('UPDATING THE STRATEGY (START)'.padStart(64, '='));

  console.log('Current Sherlock strategy:', await sherlock.yieldStrategy());

  await sherlock.updateYieldStrategy(newStrategy.address);

  console.log('Sherlock strategy after update:', await sherlock.yieldStrategy());

  console.log('UPDATING THE STRATEGY (END)'.padStart(64, '='));
}

/**
 * Deposit Sherlock USDC to the new strategy
 */
async function depositToStrategy(sherlock) {
  console.log('DEPOSITING INTO THE NEW STRATEGY (START)'.padStart(64, '='));

  const strategy = await ethers.getContractAt('MasterStrategy', await sherlock.yieldStrategy());

  console.log(
    'Sherlock Master Strategy USDC balance before deposit:',
    ethers.utils.formatUnits(await strategy.balanceOf(), 6),
  );

  const usdc = await ethers.getContractAt('ERC20', USDC);
  const usdcAmount = await usdc.balanceOf(sherlock.address);
  await sherlock.yieldStrategyDeposit(usdcAmount);

  console.log(
    'Sherlock Master Strategy USDC balance after deposit:',
    ethers.utils.formatUnits(await strategy.balanceOf(), 6),
  );

  console.log('DEPOSITING INTO THE NEW STRATEGY (END)'.padStart(64, '='));
}

async function main() {
  // ========= EXISTING CONTRACTS ===========
  const usdc = await ethers.getContractAt('ERC20', USDC);
  const sherlock = await ethers.getContractAt('Sherlock', Sherlock);

  // ========= SHERLOCK OWNER ==============
  const [alice] = await ethers.getSigners();

  // Impersonate all accounts
  [USDC, Sherlock].forEach(async (item) => {
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [item],
    });
  });

  // Transfer Sherlock ownership to alice
  await transferOwnership(sherlock, alice.address);

  // Withdraw funds from old strategy
  await withdrawUsdcFromOldStrategy(sherlock, usdc, alice);

  // Deploy new strategy
  const {
    infoStorage,
    masterStrategy,
    rootSplitter,
    compoundStrategy,
    mapleStrategy,
    truefiStrategy,
  } = await deployStrategy(alice);

  // Update Sherlock strategy to masterStrategy
  await updateStrategy(sherlock, alice, masterStrategy);

  // Deposit money into the new strategy
  await depositToStrategy(sherlock);

  // Check strategy balances
  console.log(
    'Compound strategy balance:',
    ethers.utils.formatUnits(await compoundStrategy.balanceOf(), 6),
  );
  console.log(
    'Maple strategy balance:',
    ethers.utils.formatUnits(await mapleStrategy.balanceOf(), 6),
  );
  console.log(
    'TrueFi strategy balance:',
    ethers.utils.formatUnits(await truefiStrategy.balanceOf(), 6),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
