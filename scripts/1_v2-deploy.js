const { parseUnits, id } = require('ethers/lib/utils');

const WEEK = parseInt(60 * 60 * 24 * 7);

async function main() {
  //
  // CONFIG
  //

  const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';

  let USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  let aUSDC = '0xbcca60bb61934080951369a648fb03df4f96263c';
  let SHER = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD

  if (network.name == 'goerli') {
    SHER = '0x37924D802b923B081eA28BdF12D16B03B5Bf6815';

    this.Usdc = await ethers.getContractFactory('ERC20Mock6d');
    USDC = await this.ERC20Mock6d.deploy('USD Coin', 'USDC', parseUnits('100000000000', 6));
    await USDC.deployed();
    console.log('S - Deployed usdc @', USDC.address);
  } else if (network.name != 'mainnet') {
    throw Error('Invalid network');
  }

  const UMAHO = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const SPCC = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const NON_STAKER = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  const NFT_NAME = 'Sherlock Staking Position NFT-V1';
  const NFT_SYMBOL = 'SHER-POS';

  const STAKING_PERIODS = [WEEK * 26, WEEK * 52];

  //
  // END CONFIG
  //

  this.Sherlock = await ethers.getContractFactory('Sherlock');
  this.AaveV2Strategy = await ethers.getContractFactory('AaveV2Strategy');
  if (network.name == 'goerli') {
    this.AaveV2Strategy = await ethers.getContractFactory('StrategyMockGoerli');
  }

  this.SherDistributionManager = await ethers.getContractFactory('SherDistributionManagerEmpty');
  this.SherlockProtocolManager = await ethers.getContractFactory('SherlockProtocolManager');
  this.SherlockClaimManager = await ethers.getContractFactory('SherlockClaimManager');

  console.log('0 - Start');

  const aaveV2Strategy = await this.AaveV2Strategy.deploy(aUSDC, MULTISIG);
  await aaveV2Strategy.deployed();
  console.log('1 - Deployed aaveV2Strategy @', aaveV2Strategy.address);

  const sherDistributionManager = await this.SherDistributionManager.deploy();
  await sherDistributionManager.deployed();
  console.log('2 - Deployed sherDistributionManager @', sherDistributionManager.address);

  const sherlockProtocolManager = await this.SherlockProtocolManager.deploy(USDC);
  await sherlockProtocolManager.deployed();
  console.log('3 - Deployed sherlockProtocolManager @', sherlockProtocolManager.address);

  const sherlockClaimManager = await this.SherlockClaimManager.deploy(UMAHO, SPCC);
  await sherlockClaimManager.deployed();
  console.log('4 - Deployed sherlockClaimManager @', sherlockClaimManager.address);

  const sherlock = await this.Sherlock.deploy(
    USDC,
    SHER,
    NFT_NAME,
    NFT_SYMBOL,
    aaveV2Strategy.address,
    sherDistributionManager.address,
    NON_STAKER,
    sherlockProtocolManager.address,
    sherlockClaimManager.address,
    STAKING_PERIODS,
  );
  await sherlock.deployed();
  console.log('5 - Deployed sherlock @', sherlock.address);

  await (await aaveV2Strategy.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('6 - Set aaveV2Strategy core');
  await (await sherDistributionManager.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('7 - Set sherDistributionManager core');
  await (await sherlockProtocolManager.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('8 - Set sherlockProtocolManager core');
  await (await sherlockClaimManager.setSherlockCoreAddress(sherlock.address)).wait();
  console.log('9 - Set sherlockClaimManager core');

  console.log("const Sherlock = '" + sherlock.address + "';");
  console.log("const AaveV2Strategy = '" + aaveV2Strategy.address + "';");
  console.log("const SherDistributionManager = '" + sherDistributionManager.address + "';");
  console.log("const SherlockProtocolManager = '" + sherlockProtocolManager.address + "';");
  console.log("const SherlockClaimManager = '" + sherlockClaimManager.address + "';");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
