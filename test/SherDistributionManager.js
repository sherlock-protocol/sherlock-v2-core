const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber, Uint16Max, Uint32Max } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('SherDistributionManager, 6 dec', function () {
  before(async function () {
    await prepare(this, ['SherDistributionManager']);

    await deploy(this, [
      [
        'SherDistributionManager',
        this.SherDistributionManager,
        [parseUnits('100', 6), parseUnits('600', 6), parseUnits('5', 6), constants.AddressZero],
      ],
    ]);
  });
  describe('calc()', function () {
    before(async function () {});
    it('Initial state', async function () {
      expect(
        await this.SherDistributionManager.calcReward(parseUnits('0', 6), parseUnits('50', 6), 1),
      ).to.eq(parseUnits('250', 18));

      expect(
        await this.SherDistributionManager.calcReward(parseUnits('0', 6), parseUnits('50', 6), 2),
      ).to.eq(parseUnits('500', 18));

      expect(
        await this.SherDistributionManager.calcReward(parseUnits('0', 6), parseUnits('100', 6), 1),
      ).to.eq(parseUnits('500', 18));

      expect(
        await this.SherDistributionManager.calcReward(parseUnits('0', 6), parseUnits('200', 6), 1),
      ).to.eq(parseUnits('950', 18));

      expect(
        await this.SherDistributionManager.calcReward(
          parseUnits('100', 6),
          parseUnits('100', 6),
          1,
        ),
      ).to.eq(parseUnits('450', 18));

      expect(
        await this.SherDistributionManager.calcReward(
          parseUnits('0', 6),
          parseUnits('10000', 6),
          1,
        ),
      ).to.eq(parseUnits('1700', 18));
    });
  });
});
