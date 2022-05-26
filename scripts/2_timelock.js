const { parseUnits, id, keccak256 } = require('ethers/lib/utils');
const { constants } = require('ethers');

const TIMELOCK_ADMIN_ROLE = '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5';
const PROPOSER_ROLE = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
const EXECUTOR_ROLE = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';

async function main() {
  //
  // CONFIG
  //

  [signer] = await ethers.getSigners();

  let MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  let EOA_ONE = '0xE400820f3D60d77a3EC8018d44366ed0d334f93C';
  let EOA_TWO = '0x4cf5F3EcD6303F6a04480F75ac394D4bB3816F83';
  const DELAY = 1; // 1 second FOR INITIAL TWO WEEKS

  if (network.name == 'goerli') {
    MULTISIG = '0x34EDB6fD102578De64CaEbe82f540fB3E47a05EA';
    EOA_ONE = '0xE400820f3D60d77a3EC8018d44366ed0d334f93C';
    EOA_TWO = '0x4cf5F3EcD6303F6a04480F75ac394D4bB3816F83';
  }

  const Sherlock = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
  const AaveV2Strategy = '0xF02d3A6288D998B412ce749cfF244c8ef799f582';
  const SherDistributionManager = '0x5775F32787656E77dd99f20F4E478DdC85fdB31b';
  const SherlockProtocolManager = '0x3d0b8A0A10835Ab9b0f0BeB54C5400B8aAcaa1D3';
  const SherlockClaimManager = '0xFeEDD254ae4B7c44A0472Bb836b813Ce4625Eb84';

  //
  // END CONFIG
  //
  const sherlock = await ethers.getContractAt('Sherlock', Sherlock);
  const aaveV2Strategy = await ethers.getContractAt('AaveV2Strategy', AaveV2Strategy);
  const sherDistributionManager = await ethers.getContractAt(
    'SherDistributionManager',
    SherDistributionManager,
  );
  const sherlockProtocolManager = await ethers.getContractAt(
    'SherlockProtocolManager',
    SherlockProtocolManager,
  );
  const sherlockClaimManager = await ethers.getContractAt(
    'SherlockClaimManager',
    SherlockClaimManager,
  );

  const timelock = await (
    await ethers.getContractFactory('TimelockController')
  ).deploy(DELAY, [MULTISIG], [MULTISIG, EOA_ONE, EOA_TWO]);
  await timelock.deployed();

  console.log('1 - Deployed timelockController @', timelock.address);
  await timelock.revokeRole(TIMELOCK_ADMIN_ROLE, signer.address);

  await (await sherlock.transferOwnership(timelock.address)).wait();
  console.log('2 - Transferred sherlock ownership');

  await (await aaveV2Strategy.transferOwnership(timelock.address)).wait();
  console.log('3 - Transferred aaveV2Strategy ownership');

  await (await sherDistributionManager.transferOwnership(timelock.address)).wait();
  console.log('4 - Transferred sherDistributionManager ownership');

  await (await sherlockProtocolManager.transferOwnership(timelock.address)).wait();
  console.log('5 - Transferred sherlockProtocolManager ownership');

  await (await sherlockClaimManager.transferOwnership(timelock.address)).wait();
  console.log('6 - Transferred sherlockClaimManager ownership');

  console.log(
    'Does signer have TIMELOCK_ADMIN_ROLE?',
    await timelock.hasRole(TIMELOCK_ADMIN_ROLE, signer.address),
  );
  console.log(
    'Does signer have PROPOSER_ROLE?',
    await timelock.hasRole(PROPOSER_ROLE, signer.address),
  );
  console.log(
    'Does signer have EXECUTOR_ROLE?',
    await timelock.hasRole(EXECUTOR_ROLE, signer.address),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
