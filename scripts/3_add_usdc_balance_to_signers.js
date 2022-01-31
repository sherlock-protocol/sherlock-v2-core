const { parseUnits, id, parseEther } = require('ethers/lib/utils');

async function main() {
  const signers = await ethers.getSigners();

  this.USDC = await ethers.getContractFactory('ERC20');

  console.log('0 - Attaching to USDC contract');

  const usdc = await this.USDC.attach('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

  console.log('1 - Impersonate account with USDC balance');
  const address = '0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3';
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  const impersonatedAccount = await ethers.getSigner(address);
  console.log(
    'Impersonated account USDC balance:',
    (await usdc.balanceOf(impersonatedAccount.address)).toString(),
  );

  console.log('2 - Adding balance to signers');
  for (const signer of signers) {
    console.log('Signer: ', signer.address);
    const oldBalance = await usdc.balanceOf(signer.address);
    console.log('Old balance: ', oldBalance.toString());

    console.log('Transfering...');
    await usdc.connect(impersonatedAccount).transfer(signer.address, 10000000 * 10 ** 6);

    const newBalance = await usdc.balanceOf(signer.address);
    console.log('New balance: ', newBalance.toString());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
