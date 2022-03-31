const { parseUnits, id, parseEther } = require('ethers/lib/utils');

const WEEK = parseInt(60 * 60 * 24 * 7);

async function main() {
  //
  // CONFIG
  //
  //   [signer] = await ethers.getSigners();
  //   if (signer.address != '0x1C11bE636415973520DdDf1b03822b4e2930D94A') {
  //     throw Error('DEPLOYER ' + signer.address);
  //   }

  const MAX = 12718762718;
  const FLAT = parseUnits('20000000', 6);
  const DROP = parseUnits('35000000', 6);
  const SHER = '0x46D2A90153cd8F09464CA3a5605B6BBeC9C2fF01';

  this.SherDistributionManager = await ethers.getContractFactory('SherDistributionManager');

  const sherDistributionManager = await this.SherDistributionManager.deploy(FLAT, DROP, MAX, SHER);
  await sherDistributionManager.deployed();
  console.log('2 - Deployed sherDistributionManager @', sherDistributionManager.address);

  // set core address
  // transer ownership

  const x = await sherDistributionManager.calcReward(
    parseUnits('0', 6),
    parseUnits('3000000000000000000', 6),
    WEEK * 26,
  );
  console.log(x.toString());

  await hre.run('verify:verify', {
    address: '0xE91693D47E88A0f17a827F2d4B1e7e9716326740', //sherDistributionManager.address,
    constructorArguments: [FLAT, DROP, MAX, SHER],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
