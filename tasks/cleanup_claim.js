const { task, types } = require("hardhat/config");

task("cleanUpClaim", "Approve or Refuse a given claim")
  .addParam("protocol", "Protocol identifier", undefined, types.string)
  .addParam("claimId", "Public claim identifier", undefined, types.int)
  .setAction(async ({ claimId, protocol}) => {
    const [owner] = await ethers.getSigners()
  const claimManager = await ethers.getContractAt("SherlockClaimManager", "0xfeedd254ae4b7c44a0472bb836b813ce4625eb84");
  const protocolManager = await ethers.getContractAt("SherlockProtocolManager", "0x3d0b8A0A10835Ab9b0f0BeB54C5400B8aAcaa1D3");
  const sccpAddress = "0x4Fcf6AA323a92EB92a58025E821f393da6C41bD6";

  const agent = await protocolManager.protocolAgent(protocol)

  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [agent],
  });

  const signer = await ethers.getSigner(agent)

  await claimManager.connect(signer).cleanUp(protocol, claimId);

  await hre.network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [agent],
  });
  })

module.exports = {};
