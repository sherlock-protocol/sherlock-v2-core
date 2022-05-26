const { parseUnits, id, parseEther } = require('ethers/lib/utils');
  const { ethers } = require('hardhat');

async function main() {
  const [owner] = await ethers.getSigners()
  const protocolManager = await ethers.getContractAt("SherlockProtocolManager", "0x3d0b8A0A10835Ab9b0f0BeB54C5400B8aAcaa1D3");
  const usdc = await ethers.getContractAt("ERC20", "0xfe193C63e15A54ac500f3038fce00193Ff141139");
  const protocol = "FRAN";
  const protocolBytes = ethers.utils.formatBytes32String(protocol);
  const agent = "0xDA3ec2E372c4DcbDB07c3157Bae438BcC11de25D";
  const usdcWhaleAddress = '0x34edb6fd102578de64caebe82f540fb3e47a05ea';

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [usdcWhaleAddress],
  });

  const usdcWhaleSigner = await ethers.getSigner(usdcWhaleAddress)

  await usdc.connect(usdcWhaleSigner).transfer(owner.address, 1000000 * 10 ** 6)

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [usdcWhaleAddress],
  });

  await owner.sendTransaction({
    to: "0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4",
    value: ethers.utils.parseEther("10")
  });

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4"],
  });

  const signer = await ethers.getSigner("0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4")

  await protocolManager.connect(signer).protocolAdd(
    protocolBytes,
    agent,
    id('x'),
    parseEther("0.1"),
    500
  );

  await usdc.approve(protocolManager.address, 50000 * 10 ** 6);
  await protocolManager.depositToActiveBalance(protocolBytes, 50000 * 10 ** 6);

  await protocolManager.connect(signer).setProtocolPremium(protocolBytes, 1000);

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: ["0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4"],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
