const { parseUnits, id, keccak256 } = require('ethers/lib/utils');
const { constants } = require('ethers');

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const CORE = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
const aUSDC = '0xbcca60bb61934080951369a648fb03df4f96263c';
const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
const Maven11 = '0x7C57bF654Bc16B0C9080F4F75FF62876f50B8259';
const TIMELOCK = '0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4';

const Splitter0 = '0x3b5560b01b6A413Ec8A9AFE2C5eABB073790D77D';
const Splitter1 = '0x7E0049866879151480d9Ec01391Bbf713F7705b1';
const EulerStrategy = '0xC124A8088c39625f125655152A168baA86b49026';
const MapleStrategy = '0xee4b70AE96fFC70563f70964ebDD8635033Bc6b4';
const MasterStrategy = '0x1E8bE946370a99019E323998Acd37A1206bdD507';

// if (network.name != 'mainnet') {
//   throw Error('Invalid network');
// }

// ![Initial tree strategy](https://i.imgur.com/R4SdF14.png)

async function main() {
  this.splitterMax = await ethers.getContractFactory('AlphaBetaEqualDepositMaxSplitter');
  this.splitterEqual = await ethers.getContractFactory('AlphaBetaEqualDepositSplitter');
  const euler = await ethers.getContractAt('EulerStrategy', EulerStrategy);
  const maple = await ethers.getContractAt('MapleStrategy', MapleStrategy);
  const splitter1 = await ethers.getContractAt('AlphaBetaEqualDepositSplitter', Splitter1);
  const splitter0 = await ethers.getContractAt('AlphaBetaEqualDepositSplitter', Splitter0);

  // Strategies used
  this.truefi = await ethers.getContractFactory('TrueFiStrategy');

  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [TIMELOCK],
  });
  await network.provider.request({
    method: 'hardhat_setBalance',
    params: [TIMELOCK, '0x100000000000000000000000000'],
  });
  this.timelock = await ethers.provider.getSigner(TIMELOCK);

  // Deploy Splitter 0
  /*
 (live structure)
    m
    |
    1
   / \
aave  comp

  (non-live structure)
    m
    | (0 --> m conn)
    0
   /  \ (0 --> 1 conn)
       1
      /  \
     aave comp
   */

  const splitter0new = await this.splitterMax.deploy(
    MasterStrategy,
    splitter1.address,
    MapleStrategy,
    parseUnits('10000000', 6), // 10m USDC
    constants.MaxUint256,
    parseUnits('10000000', 6), // 10m USDC (5m maple + 5m truefi)
  );
  await splitter0new.deployed();
  await splitter0.connect(this.timelock).replace(splitter0new.address);
  console.log('Splitter 0 (new)', splitter0new.address);

  const splitter2 = await this.splitterEqual.deploy(
    splitter0new.address,
    constants.AddressZero,
    MapleStrategy,
    parseUnits('100000', 6), // 100k USDC
  );
  await splitter2.deployed();
  console.log('Splitter 2', splitter2.address);

  // Deploy Maple & Truefi
  const truefi = await this.truefi.deploy(splitter2.address);
  await truefi.deployed();
  console.log('Truefi', truefi.address);

  await splitter2.setInitialChildOne(truefi.address);

  /*
    Transfering ownerships
  */

  await (await splitter0new.transferOwnership(TIMELOCK)).wait();
  console.log('0 - Transferred splitter0 (new) ownership');

  await (await splitter2.transferOwnership(TIMELOCK)).wait();
  console.log('1 - Transferred splitter2 ownership');

  await (await truefi.transferOwnership(TIMELOCK)).wait();
  console.log('2 - Transferred truefi ownership');

  console.log('--------------------------------------------');
  console.log('------------TRANSFER = DONE-----------------');
  console.log('--------------------------------------------');

  // !!!!!!!!!!!!!!!!!!!!!!
  // !!! ADMIN FUNCTION !!!
  // !!!!!!!!!!!!!!!!!!!!!!
  await maple.connect(this.timelock).replaceAsChild(splitter2.address);

  /*
    View
  */
  const master = await ethers.getContractAt(
    'ISplitter',
    '0x1E8bE946370a99019E323998Acd37A1206bdD507',
  );
  const aave = await ethers.getContractAt(
    'ISplitter',
    '0x75C5d2d8D54254476239a5c1e1F23ec48Df8779E',
  );
  const comp = await ethers.getContractAt(
    'ISplitter',
    '0x5b7a52b6d75Fb3105c3c37fcc6007Eb7ac78F1B8',
  );

  console.log('master > childOne - ', await master.childOne());

  console.log('splitter0 > childOne - ', await splitter0new.childOne());
  console.log('splitter0 > childTwo - ', await splitter0new.childTwo());
  console.log('splitter0 > parent - ', await splitter0new.parent());

  console.log('splitter1 > childOne - ', await splitter1.childOne());
  console.log('splitter1 > childTwo - ', await splitter1.childTwo());
  console.log('splitter1 > parent - ', await splitter1.parent());

  console.log('splitter2 > childOne - ', await splitter2.childOne());
  console.log('splitter2 > childTwo - ', await splitter2.childTwo());
  console.log('splitter2 > parent - ', await splitter2.parent());

  console.log('comp > parent - ', await comp.parent());
  console.log('aave > parent - ', await aave.parent());
  console.log('maple > parent - ', await maple.parent());
  console.log('truefi > parent - ', await truefi.parent());

  const core = await ethers.getContractAt('Sherlock', '0x0865a889183039689034dA55c1Fd12aF5083eabF');

  await core.connect(this.timelock).yieldStrategyWithdraw(parseUnits('15000000', 6)); // 10m
  await core.connect(this.timelock).yieldStrategyDeposit(parseUnits('15000000', 6)); // 10m + 60k

  const mapleBalance = await maple.balanceOf();
  console.log('maple', mapleBalance.toString());

  const tfBalance = await truefi.balanceOf();
  console.log('truefi', tfBalance.toString());

  const aaveB = await aave.balanceOf();
  console.log('aaveB', aaveB.toString());

  const compB = await comp.balanceOf();
  console.log('compB', compB.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
