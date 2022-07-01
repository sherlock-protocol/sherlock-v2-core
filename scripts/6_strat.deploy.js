const { parseUnits, id, keccak256 } = require('ethers/lib/utils');
const { constants } = require('ethers');

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const CORE = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
const aUSDC = '0xbcca60bb61934080951369a648fb03df4f96263c';
const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
const Maven11 = '0x7C57bF654Bc16B0C9080F4F75FF62876f50B8259';
const TIMELOCK = '0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4';

if (network.name != 'mainnet') {
  throw Error('Invalid network');
}

// ![Initial tree strategy](https://i.imgur.com/R4SdF14.png)

async function main() {
  this.InfoStorage = await ethers.getContractFactory('InfoStorage');
  this.MasterStrategy = await ethers.getContractFactory('MasterStrategy');
  // Splitters used
  this.splitterMax = await ethers.getContractFactory('AlphaBetaEqualDepositMaxSplitter');
  this.splitterEqual = await ethers.getContractFactory('AlphaBetaEqualDepositSplitter');

  // Strategies used
  this.aave = await ethers.getContractFactory('AaveStrategy');
  this.compound = await ethers.getContractFactory('CompoundStrategy');
  this.euler = await ethers.getContractFactory('EulerStrategy');

  // Deploy store
  const infoStorage = await this.InfoStorage.deploy(USDC, CORE);
  await infoStorage.deployed();
  console.log('0 - Deployed infoStorage @', infoStorage.address);

  // Deploy master
  const master = await this.MasterStrategy.deploy(infoStorage.address);
  await master.deployed();
  console.log('1 - Deployed master @', master.address);

  // Deploy AAVE
  /*

    m
    |
   aave

   */
  const aave = await this.aave.deploy(master.address, aUSDC, MULTISIG);
  await aave.deployed();

  await (await master.setInitialChildOne(aave.address)).wait();

  console.log('2 - Deployed aave @', aave.address);

  // Deploy COMPOUND
  /*

    m
    |
    1
   / \
aave comp

   */
  const splitter1 = await this.splitterEqual.deploy(
    master.address,
    constants.AddressZero,
    aave.address,
    parseUnits('500000', 6), // 500k USDC
  );
  await splitter1.deployed();

  const comp = await this.compound.deploy(splitter1.address);
  await comp.deployed();

  await splitter1.setInitialChildOne(comp.address);
  await aave.replaceAsChild(splitter1.address);

  console.log('!!(3) - Deployed splitter1 @', splitter1.address);
  console.log('3 - Deployed comp @', comp.address);

  // Deploy EULER
  /*

    m
    |
    0
   /  \
  eul   1
       / \
    comp aave

   */
  const splitter0 = await this.splitterMax.deploy(
    master.address,
    splitter1.address,
    constants.AddressZero,
    parseUnits('10000000', 6), // 10m USDC
    constants.MaxUint256,
    parseUnits('2000000', 6), // 2m USDC
  );
  await splitter0.deployed();

  const euler = await this.euler.deploy(splitter0.address);
  await euler.deployed();

  await splitter0.setInitialChildTwo(euler.address);
  await splitter1.replaceAsChild(splitter0.address);

  console.log('!!(0) - Deployed splitter0 @', splitter0.address);
  console.log('4 - Deployed euler @', euler.address);

  console.log('--------------------------------------------');
  console.log('-------------DEPLOY = DONE------------------');
  console.log('--------------------------------------------');

  /*
    Transfering ownerships
  */

  await (await master.transferOwnership(TIMELOCK)).wait();
  console.log('0 - Transferred master ownership');

  await (await aave.transferOwnership(TIMELOCK)).wait();
  console.log('1 - Transferred aave ownership');

  await (await comp.transferOwnership(TIMELOCK)).wait();
  console.log('3 - Transferred comp ownership');

  await (await splitter0.transferOwnership(TIMELOCK)).wait();
  console.log('4 - Transferred splitter0 ownership');

  await (await euler.transferOwnership(TIMELOCK)).wait();
  console.log('5 - Transferred euler ownership');

  await (await splitter1.transferOwnership(TIMELOCK)).wait();
  console.log('6 - Transferred splitter1 ownership');

  console.log('--------------------------------------------');
  console.log('------------TRANSFER = DONE-----------------');
  console.log('--------------------------------------------');

  /*
    View
  */
  console.log('master > childOne - ', await master.childOne());

  console.log('splitter0 > childOne - ', await splitter0.childOne());
  console.log('splitter0 > childTwo - ', await splitter0.childTwo());
  console.log('splitter0 > parent - ', await splitter0.parent());

  console.log('splitter1 > childOne - ', await splitter1.childOne());
  console.log('splitter1 > childTwo - ', await splitter1.childTwo());
  console.log('splitter1 > parent - ', await splitter1.parent());

  console.log('aave > parent - ', await aave.parent());
  console.log('comp > parent - ', await comp.parent());
  console.log('euler > parent - ', await euler.parent());

  /*
   Finally
  */
  // call updateYieldStrategy on core
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
