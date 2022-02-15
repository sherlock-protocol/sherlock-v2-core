task('advance-time', 'Simulate the passing of of time')
  .addOptionalParam('days', 'Number of days to add')
  .addOptionalParam('blocks', 'Number of blocks to mine')
  .setAction(async ({ days, blocks }) => {
    if (!days && !blocks) {
      throw Error('One of --days or --blocks params is required.');
    }

    if (days) {
      const numberOfDays = parseInt(days);
      console.log(`Advancing time with ${numberOfDays} days.`);
      const seconds = numberOfDays * 24 * 60 * 60;
      await ethers.provider.send('evm_increaseTime', [seconds]);
      await ethers.provider.send('evm_mine');
      console.log('Done.');
    }
  });

module.exports = {};
