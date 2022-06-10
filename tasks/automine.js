task('automine', 'Enable/disable automining')
  .addOptionalParam('seconds', 'Number of seconds between each block. Set 0 to automine.')
  .setAction(async ({ seconds }) => {
    const blockTime = parseFloat(seconds);

    if (!blockTime) {
      console.log('Enabling automining...');
      await network.provider.send('evm_setAutomine', [true]);
      await network.provider.send('evm_setIntervalMining', [0]);
      console.log('Done.');
    } else {
      console.log(`Mining blocks every ${blockTime} seconds...`);
      await network.provider.send('evm_setAutomine', [false]);
      await network.provider.send('evm_setIntervalMining', [blockTime * 1000]);
      console.log('Done.');
    }
  });

module.exports = {};