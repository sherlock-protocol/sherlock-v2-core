const { parseUnits, id } = require('ethers/lib/utils');

async function main() {
  const comp = await ethers.getContractAt(
    'CompoundStrategy',
    '0x5b7a52b6d75fb3105c3c37fcc6007eb7ac78f1b8',
  );

  const startblock = 15135844;

  //   await network.provider.send('evm_setAutomine', [false]);
  //   await network.provider.send('evm_setIntervalMining', [13325]);

  for (var i = 0; i < 1000; i += 5) {
    const t = await comp.balanceOf({ blockTag: startblock + i });
    console.log('t' + i.toString() + ',' + t.toString());
    await network.provider.send('evm_mine', []);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
