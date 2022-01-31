const { BigNumber } = require('ethers');
const { parseUnits } = require('ethers/lib/utils');

async function main() {
  //
  // CONFIG
  //
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const SHER = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161'; // TBD
  const SHERLOCK = '0x08E7dB7d9131a38d01dbBc490615Ea2661bBbce4';
  const RECEIVER = '0x0B6a04b8D3d050cbeD9A4621A5D503F27743c942'; // TBD: This is Hardhat account #3
  const STAKE_RATE = parseUnits('9', 6);
  const BUY_RATE = parseUnits('1', 6);
  //
  // END CONFIG
  //

  this.SherClaim = await ethers.getContractFactory("SherClaim");
  this.SherBuy = await ethers.getContractFactory("SherBuy");

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

  console.log(`const SherClaim = "${sherClaim.address}";`);
  console.log(`const SherBuy = "${sherBuy.address}";`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
