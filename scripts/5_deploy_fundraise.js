const { BigNumber } = require('ethers');
const { parseUnits } = require('ethers/lib/utils');

async function main() {
  //
  // CONFIG
  //
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const SHER = '0x36EFEd637dd1D3D5d9FB89b185a76E6ACF33493B'; // TBD
  const SHERLOCK = '0x22Af418Ba0e7EECC188f0D9Aee64E88953394a08';
  const SHER_DISTRIBUTION_MANAGER = '0xee4b70AE96fFC70563f70964ebDD8635033Bc6b4';
  const RECEIVER = '0x0B6a04b8D3d050cbeD9A4621A5D503F27743c942'; // TBD: This is Hardhat account #3
  const STAKE_RATE = parseUnits('9', 6);
  const BUY_RATE = parseUnits('1', 6);
  //
  // END CONFIG
  //

  this.SherClaim = await ethers.getContractFactory("SherClaim");
  this.SherBuy = await ethers.getContractFactory("SherBuy");
  this.SherToken = await ethers.getContractFactory("SherToken");
  this.SherDistributionManager = await ethers.getContractFactory("SherDistributionManager");

  const _10DaysFromNow = Math.round(Date.now() / 1000) + (60 * 60 * 24 * 10);
  const sherClaim = await this.SherClaim.deploy(SHER, _10DaysFromNow);
  await sherClaim.deployed();
  console.log('0 - Deployed SherClaim');

  const sherBuy = await this.SherBuy.deploy(
    SHER,
    USDC,
    STAKE_RATE,
    BUY_RATE,
    SHERLOCK,
    RECEIVER,
    sherClaim.address
  );
  await sherBuy.deployed();
  console.log('1 - Deployed SherBuy');

  const sher = this.SherToken.attach(SHER);
  const tx = await sher.transfer(sherBuy.address, ethers.utils.parseUnits("10000000", 18));
  await tx.wait();
  console.log('2 - Sent SHER tokens to SherBuy');

  const sherDistributionManager = this.SherDistributionManager.attach(SHER_DISTRIBUTION_MANAGER);
  const tx2 = await sher.transfer(sherDistributionManager.address, ethers.utils.parseUnits("90000000", 18));
  await tx2.wait();
  console.log('3 - Sent SHER tokens to SherDistributionManager')

  console.log(`const SherClaim = "${sherClaim.address}";`);
  console.log(`const SherBuy = "${sherBuy.address}";`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
