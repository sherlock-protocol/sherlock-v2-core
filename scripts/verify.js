const hre = require('hardhat');
const { parseUnits } = require('ethers/lib/utils');

const WEEK = parseInt(60 * 60 * 24 * 7);

async function main() {
  let MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  let EOA_ONE = '0xE400820f3D60d77a3EC8018d44366ed0d334f93C';
  let EOA_TWO = '0x4cf5F3EcD6303F6a04480F75ac394D4bB3816F83';

  if (network.name == 'goerli') {
    MULTISIG = '0x34EDB6fD102578De64CaEbe82f540fB3E47a05EA';
    EOA_ONE = '0xE400820f3D60d77a3EC8018d44366ed0d334f93C';
    EOA_TWO = '0x4cf5F3EcD6303F6a04480F75ac394D4bB3816F83';
  }

  let USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  let aUSDC = '0xbcca60bb61934080951369a648fb03df4f96263c';
  let SHER = '0x63E9aD95D09ae88614e0b0F462A3A96994c9b6CF';

  if (network.name == 'goerli') {
    SHER = '0x63E9aD95D09ae88614e0b0F462A3A96994c9b6CF';
    USDC = '0xfe193C63e15A54ac500f3038fce00193Ff141139';
  } else if (network.name != 'mainnet') {
    throw Error('Invalid network');
  }

  const UMAHO = '0x8fCC879036Fc8e45395AdE7D4eF739200037695c';
  const SPCC = '0x4Fcf6AA323a92EB92a58025E821f393da6C41bD6';
  const NON_STAKER = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';
  const NFT_NAME = 'Sherlock Staking Position NFT-V1';
  const NFT_SYMBOL = 'SHER-POS';
  const END_RAISE = '1647100800';

  const STAKE_RATE = parseUnits('9', 6);
  const BUY_RATE = parseUnits('1', 6);
  const STAKING_PERIODS = [WEEK * 26, WEEK * 52];

  const TimelockController = '0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4';
  const Sherlock = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
  const AaveV2Strategy = '0xF02d3A6288D998B412ce749cfF244c8ef799f582';
  const SherDistributionManager = '0x5775F32787656E77dd99f20F4E478DdC85fdB31b';
  const SherlockProtocolManager = '0x3d0b8A0A10835Ab9b0f0BeB54C5400B8aAcaa1D3';
  const SherlockClaimManager = '0xFeEDD254ae4B7c44A0472Bb836b813Ce4625Eb84';
  const SherClaim = '0x7289C61C75dCdB8Fe4DF0b937c08c9c40902BDd3';
  const SherBuy = '0xf8583f22C2f6f8cd27f62879A0fB4319bce262a6';

  // verify sherlock
  await hre.run('verify:verify', {
    address: Sherlock,
    constructorArguments: [
      USDC,
      SHER,
      NFT_NAME,
      NFT_SYMBOL,
      AaveV2Strategy,
      SherDistributionManager,
      NON_STAKER,
      SherlockProtocolManager,
      SherlockClaimManager,
      STAKING_PERIODS,
    ],
  });

  await hre.run('verify:verify', {
    address: TimelockController,
    constructorArguments: [1, [MULTISIG], [MULTISIG, EOA_ONE, EOA_TWO]],
  });

  await hre.run('verify:verify', {
    address: AaveV2Strategy,
    constructorArguments: [aUSDC, NON_STAKER],
  });

  await hre.run('verify:verify', {
    address: SherDistributionManager,
    constructorArguments: [],
  });

  await hre.run('verify:verify', {
    address: SherlockProtocolManager,
    constructorArguments: [USDC],
  });

  await hre.run('verify:verify', {
    address: SherlockClaimManager,
    constructorArguments: [UMAHO, SPCC],
  });

  await hre.run('verify:verify', {
    address: SherClaim,
    constructorArguments: [SHER, END_RAISE],
  });

  await hre.run('verify:verify', {
    address: SherBuy,
    constructorArguments: [SHER, USDC, STAKE_RATE, BUY_RATE, Sherlock, NON_STAKER, SherClaim],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
