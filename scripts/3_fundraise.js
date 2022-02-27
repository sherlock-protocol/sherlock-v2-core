const { BigNumber } = require('ethers');
const { parseUnits } = require('ethers/lib/utils');

async function main() {
  //
  // CONFIG
  //
  let MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  let USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  let SHER = ''; // TBD
  let SHERLOCK = ''; // TBD

  if (network.name == 'goerli') {
    SHER = '0x37924D802b923B081eA28BdF12D16B03B5Bf6815';
    USDC = '0xfe193C63e15A54ac500f3038fce00193Ff141139';
    SHERLOCK = ''; // TBD
  }

  const END_RAISE = '1647100800';

  const STAKE_RATE = parseUnits('9', 6);
  const BUY_RATE = parseUnits('1', 6);
  //
  // END CONFIG
  //

  this.SherClaim = await ethers.getContractFactory('SherClaim');
  this.SherBuy = await ethers.getContractFactory('SherBuy');

  const sherClaim = await this.SherClaim.deploy(SHER, END_RAISE);
  await sherClaim.deployed();
  console.log('0 - Deployed SherClaim');

  const sherBuy = await this.SherBuy.deploy(
    SHER,
    USDC,
    STAKE_RATE,
    BUY_RATE,
    SHERLOCK,
    MULTISIG,
    sherClaim.address,
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
