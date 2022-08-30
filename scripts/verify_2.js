const hre = require('hardhat');
const { parseUnits } = require('ethers/lib/utils');
const { constants } = require('ethers');

const WEEK = parseInt(60 * 60 * 24 * 7);

async function main() {
  const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const CORE = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
  const aUSDC = '0xbcca60bb61934080951369a648fb03df4f96263c';
  const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  const TIMELOCK = '0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4';

  const infoStorage = '0xbFa53D098d7063DdCc39a45ea6F8c290FcD7FC70';
  const master = '0x1E8bE946370a99019E323998Acd37A1206bdD507';
  const aave = '0x75C5d2d8D54254476239a5c1e1F23ec48Df8779E';
  const splitter1 = '0x7E0049866879151480d9Ec01391Bbf713F7705b1';
  const comp = '0x5b7a52b6d75Fb3105c3c37fcc6007Eb7ac78F1B8';
  const splitter0 = '0x71B6BC6c70E27DCfD7d0b7AE8EbA6a76D518D88A';
  const euler = '0xC124A8088c39625f125655152A168baA86b49026';

  // verify sherlock
  // await hre.run('verify:verify', {
  //   address: infoStorage,
  //   constructorArguments: [USDC, CORE],
  // });

  // await hre.run('verify:verify', {
  //   address: master,
  //   constructorArguments: [infoStorage],
  // });

  // await hre.run('verify:verify', {
  //   address: aave,
  //   constructorArguments: [master, aUSDC, MULTISIG],
  // });

  // await hre.run('verify:verify', {
  //   address: splitter1,
  //   constructorArguments: [master, constants.AddressZero, aave, parseUnits('500000', 6)],
  // });

  // await hre.run('verify:verify', {
  //   address: comp,
  //   constructorArguments: [splitter1],
  // });

  // await hre.run('verify:verify', {
  //   address: splitter0,
  //   constructorArguments: [
  //     master,
  //     splitter1,
  //     constants.AddressZero,
  //     parseUnits('10000000', 6), // 10m USDC
  //     constants.MaxUint256,
  //     parseUnits('2000000', 6), // 2m USDC]],
  //   ],
  // });

  await hre.run('verify:verify', {
    address: euler,
    constructorArguments: [splitter0],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
