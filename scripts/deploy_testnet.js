const { parseUnits, parseEther, id } = require('ethers/lib/utils');

const WEEK = parseInt((60 * 60 * 24 * 7));
const STAKING_PERIODS = [WEEK * 13, WEEK * 26, WEEK * 52]; // (3, 6 and 12 months) TBD

const MILLION_USDC = parseUnits('1000000', 6);
// If you stake 1 USDC for a year, you'll get 0.1 SHER token
const SHER_PER_USDC_PER_YEAR = parseUnits('0.1', 18); // TBD
const SHER_RATE_CODE = SHER_PER_USDC_PER_YEAR.div(WEEK * 52);
const NFT_NAME = 'Sherlock Position'; // TBD
const NFT_SYMBOL = 'SP'; // TBD
const STAKE_RATE = parseUnits('9', 6);
const BUY_RATE = parseUnits('1', 6);
const SHER_BUY_RECEIVER = '0x0B6a04b8D3d050cbeD9A4621A5D503F27743c942'; // TBD: This is Hardhat account #3


const MULTISIG_MOCK_ADDRESS = "0x666B8EbFbF4D5f0CE56962a25635CfF563F13161";

async function deploySherToken() {
  const SherToken = await ethers.getContractFactory("SherToken");
  const initialSupply = parseUnits("100000000", 18);
  const sherToken = await SherToken.deploy(initialSupply);

  await sherToken.deployed();

  return sherToken.address;
}

async function deployUSDCMock() {
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock6d");
  const initialSupply = parseUnits("1000000000", 6);
  const usdc = await ERC20Mock.deploy("USDC", "USDC", initialSupply);

  await usdc.deployed();

  return usdc.address;
}

async function deploySherlock(sherAddress, usdcAddress) {
  const StrategyMock = await ethers.getContractFactory("StrategyMock");
  const SherDistributionManager = await ethers.getContractFactory("SherDistributionManager");
  const SherlockProtocolManager = await ethers.getContractFactory("SherlockProtocolManager");
  const SherlockClaimManager = await ethers.getContractFactory("SherlockClaimManager");
  const Sherlock = await ethers.getContractFactory("Sherlock");

  const strategyMock = await StrategyMock.deploy(usdcAddress);
  await strategyMock.deployed();

  const sherDistributionManager = await SherDistributionManager.deploy(
    MILLION_USDC.mul(100),
    MILLION_USDC.mul(600),
    SHER_RATE_CODE,
    sherAddress
  );
  await sherDistributionManager.deployed();

  const sherlockProtocolManager = await SherlockProtocolManager.deploy(usdcAddress);
  await sherlockProtocolManager.deployed();

  const sherlockClaimManager = await SherlockClaimManager.deploy(MULTISIG_MOCK_ADDRESS, MULTISIG_MOCK_ADDRESS);
  await sherlockClaimManager.deployed();

  const sherlock = await Sherlock.deploy(
    usdcAddress,
    sherAddress,
    NFT_NAME,
    NFT_SYMBOL,
    strategyMock.address,
    sherDistributionManager.address,
    MULTISIG_MOCK_ADDRESS,
    sherlockProtocolManager.address,
    sherlockClaimManager.address,
    STAKING_PERIODS
  );

  await sherlock.deployed();

  await (await strategyMock.setSherlockCoreAddress(sherlock.address)).wait();
  await (await sherDistributionManager.setSherlockCoreAddress(sherlock.address)).wait();
  await (await sherlockProtocolManager.setSherlockCoreAddress(sherlock.address)).wait();
  await (await sherlockClaimManager.setSherlockCoreAddress(sherlock.address)).wait();

  return {
    sherlock: sherlock.address,
    strategy: strategyMock.address,
    distributionManager: sherDistributionManager.address,
    protocolManager: sherlockProtocolManager.address,
    claimManager: sherlockClaimManager.address
  };
}

async function distributeUSDC(usdcAddress, recipients, amount) {
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock6d");
  const usdc = await ERC20Mock.attach(usdcAddress);

  for (let i = 0; i < recipients.length; i++) {
    const recipient = recipients[i];
    await usdc.transfer(recipient, amount);
  }
}

async function addProtocols(protocolManagerAddress, usdcAddress, protocols) {
  const SherlockProtocolManager = await ethers.getContractFactory("SherlockProtocolManager");
  const ERC20Mock = await ethers.getContractFactory("ERC20Mock6d");

  const sherlockProtocolManager = SherlockProtocolManager.attach(protocolManagerAddress);
  const usdc = await ERC20Mock.attach(usdcAddress);

  const [owner] = await ethers.getSigners();

  for (const protocol of protocols) {
    const protocolBytes = ethers.utils.formatBytes32String(protocol);

    // Add protocol
    await sherlockProtocolManager.protocolAdd(
      protocolBytes,
      owner.address,
      id('x'),
      parseEther('0.1'),
      500,
    );

    // Deposit some USDC balance
    await usdc.approve(sherlockProtocolManager.address, 50000 * 10 ** 6);
    await sherlockProtocolManager.depositToActiveBalance(protocolBytes, 50000 * 10 ** 6);

    // Set premium
    await sherlockProtocolManager.setProtocolPremium(protocolBytes, 1000);
  }
}

async function deployFundraise(sherAddress, usdcAddress, sherlockAddress, sherDistributionManagerAddress, endDate) {
  const SherClaim = await ethers.getContractFactory("SherClaim");
  const SherBuy = await ethers.getContractFactory("SherBuy");
  const SherToken = await ethers.getContractFactory("SherToken");
  const SherDistributionManager = await ethers.getContractFactory("SherDistributionManager");

  const sherClaim = await SherClaim.deploy(sherAddress, endDate);
  await sherClaim.deployed();

  const sherBuy = await SherBuy.deploy(
    sherAddress,
    usdcAddress,
    STAKE_RATE,
    BUY_RATE,
    sherlockAddress,
    SHER_BUY_RECEIVER,
    sherClaim.address
  );
  await sherBuy.deployed();

  // Transfer SHER to SherBUy
  const sher = SherToken.attach(sherAddress);
  const tx = await sher.transfer(sherBuy.address, ethers.utils.parseUnits("10000000", 18));
  await tx.wait();

  // Transfer SHER to SherDistributionManager
  const sherDistributionManager = SherDistributionManager.attach(sherDistributionManagerAddress);
  const tx2 = await sher.transfer(sherDistributionManager.address, ethers.utils.parseUnits("90000000", 18));
  await tx2.wait();

  return {
    sherClaim: sherClaim.address,
    sherBuy: sherBuy.address
  };
}


async function main() {
  const sherTokenAddress = await deploySherToken();
  console.log(`SHER_TOKEN = ${sherTokenAddress}`);

  const usdcAddress = await deployUSDCMock();
  console.log(`USDC_TOKEN = ${usdcAddress}`);

  const { sherlock, strategy, distributionManager, protocolManager, claimManager} = await deploySherlock(sherTokenAddress, usdcAddress);
  console.log(`SHERLOCK = ${sherlock}`);
  console.log(`STRATEGY = ${strategy}`);
  console.log(`SHER_DISTRIBUTION_MANAGER = ${distributionManager}`);
  console.log(`SHERLOCK_PROTOCOL_MANAGER = ${protocolManager}`);
  console.log(`SHERLOCK_CLAIM_MANAGER = ${claimManager}`);

  const testAccounts = [
    "0x0B6a04b8D3d050cbeD9A4621A5D503F27743c942",
    "0x100F04C9B98AB9D22772Aacc469bEA466d54cc4A",
    "0x8580AB42b5Db3eD846Cd6c4bB69112fc32F4F370",
    "0xAE81Cb7A286afc5193D149abb93393A43932fd9F",
    "0xECf69165A98c51D43803726df261414b8f2b9511"
  ];

  await distributeUSDC(usdcAddress, testAccounts, parseUnits("100000000", 6));
  console.log("Distributed USDC");

  const protocols = ["SQUEETH", "EULER", "PRIMITIVE", "NIFTY_OPTIONS"];

  await addProtocols(protocolManager, usdcAddress, protocols);

  console.log("Added protocols");

  const _10DaysFromNow = Math.round(Date.now() / 1000) + (60 * 60 * 24 * 10);
  const {sherClaim, sherBuy} = await deployFundraise(sherTokenAddress, usdcAddress, sherlock, distributionManager, _10DaysFromNow);
  console.log(`SHER_CLAIM = ${sherClaim}`);
  console.log(`SHER_BUY = ${sherBuy}`);
  
  console.log("Accounts with USDC(mock) balance:");
  testAccounts.map(account => console.log(account));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
