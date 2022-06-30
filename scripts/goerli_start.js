const { parseUnits, id, parseEther } = require('ethers/lib/utils');

const SHER_MINTER = '0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4'; // timelock controller
const SHER = '0x63E9aD95D09ae88614e0b0F462A3A96994c9b6CF';
const SHER_BUY = '0xf8583f22C2f6f8cd27f62879A0fB4319bce262a6';

async function main() {
  // get access to mint function
  const sher = await ethers.getContractAt('MockAave', SHER);

  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [SHER_MINTER],
  });
  await network.provider.request({
    method: 'hardhat_setBalance',
    params: [SHER_MINTER, '0x100000000000000000000000000'],
  });

  this.minter = await ethers.provider.getSigner(SHER_MINTER);

  await sher.connect(this.minter).mint(SHER_BUY, parseEther('10000000'));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
