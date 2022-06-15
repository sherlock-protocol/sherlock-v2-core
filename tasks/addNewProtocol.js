const { task, types } = require("hardhat/config");
const { parseUnits, id, parseEther } = require('ethers/lib/utils');

task("addNewProtocol", "Add new protocol")
  .addParam("protocol", "Name of the protocol", undefined, types.string)
  .addParam("agent", "Address of the agent", undefined, types.string)
  .setAction(async ({protocol, agent}) => {
    const [owner] = await ethers.getSigners()
    const protocolManager = await ethers.getContractAt("SherlockProtocolManager", "0x3d0b8A0A10835Ab9b0f0BeB54C5400B8aAcaa1D3");
    const usdc = await ethers.getContractAt("ERC20", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    const protocolBytes = ethers.utils.formatBytes32String(protocol);
    const usdcWhaleAddress = '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503';
    const protocolManagerOwner = await protocolManager.owner()

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhaleAddress],
    });

    const usdcWhaleSigner = await ethers.getSigner(usdcWhaleAddress)

    await owner.sendTransaction({
      to: usdcWhaleSigner.address,
      value: ethers.utils.parseEther("10")
    });
  
    await usdc.connect(usdcWhaleSigner).transfer(owner.address, 1000000 * 10 ** 6)
  
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [usdcWhaleAddress],
    });
  
    await owner.sendTransaction({
      to: protocolManagerOwner,
      value: ethers.utils.parseEther("10")
    });
  
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [protocolManagerOwner],
    });
  
    const signer = await ethers.getSigner(protocolManagerOwner)
  
    await protocolManager.connect(signer).protocolAdd(
      protocolBytes,
      agent,
      id('x'),
      parseEther("0.1"),
      parseUnits("1000000", 6)
    );
  
    await usdc.approve(protocolManager.address, 50000 * 10 ** 6);
    await protocolManager.depositToActiveBalance(protocolBytes, 50000 * 10 ** 6);
  
    await protocolManager.connect(signer).setProtocolPremium(protocolBytes, 1000);
  
    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [protocolManagerOwner],
    });
  })
