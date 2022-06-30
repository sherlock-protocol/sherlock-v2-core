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

// ![Initial tree strategy](https://i.imgur.com/U7Pcrzv.png)

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
  this.truefi = await ethers.getContractFactory('TrueFiStrategy');
  this.maple = await ethers.getContractFactory('MapleStrategy');

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
    3
   / \
comp aave

   */
  const splitter3 = await this.splitterEqual.deploy(
    master.address,
    aave.address,
    constants.AddressZero,
    parseUnits('500000', 6), // 500k USDC
  );
  await splitter3.deployed();

  const comp = await this.compound.deploy(splitter3.address);
  await comp.deployed();

  await splitter3.setInitialChildTwo(comp.address);
  await aave.replaceAsChild(splitter3.address);

  console.log('!!(3) - Deployed splitter3 @', splitter3.address);
  console.log('3 - Deployed comp @', comp.address);

  // Deploy EULER
  /*

    m
    |
    0
   /  \
  eul   3
       / \
    comp aave

   */
  const splitter0 = await this.splitterMax.deploy(
    master.address,
    splitter3.address,
    constants.AddressZero,
    parseUnits('10000000', 6), // 10m USDC
    constants.MaxUint256,
    parseUnits('10000000', 6), // 10m USDC
  );
  await splitter0.deployed();

  const euler = await this.euler.deploy(splitter0.address);
  await euler.deployed();

  await splitter0.setInitialChildTwo(euler.address);
  await splitter3.replaceAsChild(splitter0.address);

  console.log('!!(0) - Deployed splitter0 @', splitter0.address);
  console.log('4 - Deployed euler @', euler.address);

  // Deploy TRUEFI
  /*

     m
     |
     0
    /  \
   1     3
  / \    / \
 tf el  cmp aave

   */
  const splitter1 = await this.splitterMax.deploy(
    splitter0.address,
    euler.address,
    constants.AddressZero,
    parseUnits('5000000', 6), // 5m USDC
    parseUnits('2000000', 6), // 2m USDC
    constants.MaxUint256,
  );
  await splitter1.deployed();

  const truefi = await this.truefi.deploy(splitter1.address);
  await truefi.deployed();

  await splitter1.setInitialChildTwo(truefi.address);
  await euler.replaceAsChild(splitter1.address);

  console.log('!!(1) - Deployed splitter1 @', splitter1.address);
  console.log('5 - Deployed truefi @', truefi.address);

  // Deploy MAPLE
  /*

       m
       |
       0
      /  \
     1     3
    / \    / \
   2  el  cmp aave
  / \
mpl truefi

   */
  const splitter2 = await this.splitterEqual.deploy(
    splitter1.address,
    truefi.address,
    constants.AddressZero,
    parseUnits('200000', 6), // 200k USDC
  );
  await splitter2.deployed();

  const maple = await this.maple.deploy(splitter2.address, Maven11);
  await maple.deployed();

  await splitter2.setInitialChildTwo(maple.address);
  await truefi.replaceAsChild(splitter2.address);

  console.log('!!(2) - Deployed splitter2 @', splitter2.address);
  console.log('6 - Deployed maple @', maple.address);

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

  await (await splitter3.transferOwnership(TIMELOCK)).wait();
  console.log('2 - Transferred splitter3 ownership');

  await (await comp.transferOwnership(TIMELOCK)).wait();
  console.log('3 - Transferred comp ownership');

  await (await splitter0.transferOwnership(TIMELOCK)).wait();
  console.log('4 - Transferred splitter0 ownership');

  await (await euler.transferOwnership(TIMELOCK)).wait();
  console.log('5 - Transferred euler ownership');

  await (await splitter1.transferOwnership(TIMELOCK)).wait();
  console.log('6 - Transferred splitter1 ownership');

  await (await truefi.transferOwnership(TIMELOCK)).wait();
  console.log('7 - Transferred truefi ownership');

  await (await splitter2.transferOwnership(TIMELOCK)).wait();
  console.log('8 - Transferred splitter2 ownership');

  await (await maple.transferOwnership(TIMELOCK)).wait();
  console.log('9 - Transferred maple ownership');

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

  console.log('splitter2 > childOne - ', await splitter2.childOne());
  console.log('splitter2 > childTwo - ', await splitter2.childTwo());
  console.log('splitter2 > parent - ', await splitter2.parent());

  console.log('splitter3 > childOne - ', await splitter3.childOne());
  console.log('splitter3 > childTwo - ', await splitter3.childTwo());
  console.log('splitter3 > parent - ', await splitter3.parent());

  console.log('aave > parent - ', await aave.parent());
  console.log('comp > parent - ', await comp.parent());
  console.log('euler > parent - ', await euler.parent());
  console.log('truefi > parent - ', await truefi.parent());
  console.log('maple > parent - ', await maple.parent());

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
