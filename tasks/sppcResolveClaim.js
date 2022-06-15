const { task, types } = require("hardhat/config");

task("spccResolveClaim", "Approve or Refuse a given claim")
  .addParam("claimId", "Public id of the claim", undefined, types.int)
  .addParam("approved", "Spcc approves or refuses (true|false)", undefined, types.boolean)
  .setAction(async ({ claimId, approved}) => {
    const [owner] = await ethers.getSigners()
    const claimManager = await ethers.getContractAt("SherlockClaimManager", "0xfeedd254ae4b7c44a0472bb836b813ce4625eb84");
    const sccpAddress = "0x4Fcf6AA323a92EB92a58025E821f393da6C41bD6";
  
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [sccpAddress],
    });
  
    const spccSigner = await ethers.getSigner(sccpAddress)
  
    if (await spccSigner.getBalance() < ethers.utils.parseEther("10")) {
      await owner.sendTransaction({
        to: spccSigner.address,
        value: ethers.utils.parseEther("10")
      });
    }
  
    if (approved) {
      await claimManager.connect(spccSigner).spccApprove(claimId);
    } else {
      await claimManager.connect(spccSigner).spccRefuse(claimId);
    }
  
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [sccpAddress],
    });
  })

module.exports = {};
