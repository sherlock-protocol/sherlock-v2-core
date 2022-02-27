const { parseEther } = require('ethers/lib/utils');

async function main() {
  [this.gov] = await ethers.getSigners();
  this.gov.address = await this.gov.getAddress();

  console.log(this.gov.address);

  // 50 ETH
  await network.provider.send('hardhat_setBalance', [this.gov.address, '0x2b5e3af16b1880000']);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
