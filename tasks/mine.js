task('mine', 'Mine one block').setAction(async ({ blocks }) => {
  console.log('Mining one block');
  await hre.network.provider.send('hardhat_mine');
  console.log('Done.');
});

module.exports = {};
