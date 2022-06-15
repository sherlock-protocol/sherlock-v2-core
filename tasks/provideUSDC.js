const { task, types } = require("hardhat/config");
const { parseUnits, id, parseEther } = require('ethers/lib/utils');

task("provideUSDC", "Sends USDC to account")
  .addParam("address", "Address to send USDC to", undefined, types.string)
  .addParam("amount", "USDC amount to send", undefined, types.string)
  .setAction(async ({address, amount}) => {
    const [owner] = await ethers.getSigners()
    const usdc = await ethers.getContractAt("ERC20", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    const usdcWhaleAddress = '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503';

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [usdcWhaleAddress],
    });

    const usdcWhaleSigner = await ethers.getSigner(usdcWhaleAddress)

    const whaleEthBalance = await ethers.provider.getBalance(usdcWhaleAddress)
    if (whaleEthBalance.lt(parseEther("1.0"))) {
      await owner.sendTransaction({
        to: usdcWhaleAddress,
        value: ethers.utils.parseEther("1")
      });
    }

    await usdc.connect(usdcWhaleSigner).transfer(address, parseUnits(amount, 6))

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [usdcWhaleAddress],
    });
  })
