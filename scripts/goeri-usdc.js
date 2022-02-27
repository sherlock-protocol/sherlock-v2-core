const { parseUnits, id } = require('ethers/lib/utils');

async function main() {
  this.Usdc = await ethers.getContractFactory('ERC20Mock6d');
  USDC = await this.Usdc.deploy('USD Coin', 'USDC', parseUnits('100000000000', 6));
  await USDC.deployed();
  console.log('S - Deployed usdc @', USDC.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
