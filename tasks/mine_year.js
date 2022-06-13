task('mine-year', 'Mine a year worth of blocks')
  .setAction(async () => {
      await hre.network.provider.send("hardhat_mine", ["0x2503F6", "0xd"]);
  });

module.exports = {};