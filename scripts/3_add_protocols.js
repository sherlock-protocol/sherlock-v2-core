const { parseUnits, id, parseEther } = require('ethers/lib/utils');

async function main() {
  const [owner] = await ethers.getSigners();

  this.SherlockProtocolManager = await ethers.getContractFactory('SherlockProtocolManager');

  console.log('0 - Attaching to protocol manager');

  const sherlockProtocolManager = await this.SherlockProtocolManager.attach(
    '0xee4b70AE96fFC70563f70964ebDD8635033Bc6b4',
  );

  console.log('1 - Enabling protocols with agent', owner.address);
  for (const protocol of ['SQUEETH', 'EULER', 'PRIMITIVE', 'NIFTY_OPTIONS']) {
    const protocolBytes = ethers.utils.formatBytes32String(protocol);

    await sherlockProtocolManager.protocolAdd(
      protocolBytes,
      owner.address,
      id('x'),
      parseEther('0.1'),
      500,
    );
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
