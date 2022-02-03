const { parseUnits, id, parseEther } = require('ethers/lib/utils');

async function main() {
  const [owner] = await ethers.getSigners();

  this.SherlockProtocolManager = await ethers.getContractFactory('SherlockProtocolManager');
  this.USDC = await ethers.getContractFactory('ERC20');

  console.log('0 - Attaching to protocol manager');

  const sherlockProtocolManager = await this.SherlockProtocolManager.attach(
    '0xE3C37e951F1404b162DFA71A13F0c99c9798Db82',
  );

  console.log('1 - Attaching to USDC contract');

  const usdc = await this.USDC.attach('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');

  console.log('2 - Enabling protocols with agent', owner.address);
  for (const protocol of ['SQUEETH', 'EULER', 'PRIMITIVE', 'NIFTY_OPTIONS']) {
    const protocolBytes = ethers.utils.formatBytes32String(protocol);

    // Add protocol
    await sherlockProtocolManager.protocolAdd(
      protocolBytes,
      owner.address,
      id('x'),
      parseEther('0.1'),
      500,
    );

    // Deposit some USDC balance
    await usdc.approve(sherlockProtocolManager.address, 50000 * 10 ** 6);
    await sherlockProtocolManager.depositToActiveBalance(protocolBytes, 50000 * 10 ** 6);

    console.log(
      'Protocol active balance:',
      await sherlockProtocolManager.activeBalance(protocolBytes),
    );

    // Set premium
    await sherlockProtocolManager.setProtocolPremium(protocolBytes, 1000);
    console.log('Added protocol: ', protocol, protocolBytes);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
