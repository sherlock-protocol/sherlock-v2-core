const { parseUnits, id } = require('ethers/lib/utils');

async function main() {
  this.SherToken = await ethers.getContractFactory("SherToken");

  const initialSupply = ethers.utils.parseUnits("100000000", 18);
  const sherToken = await this.SherToken.deploy(initialSupply);
  await sherToken.deployed();
  console.log('0 - Deployed SherToken')

  console.log(`const SherToken = "${sherToken.address}";`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
