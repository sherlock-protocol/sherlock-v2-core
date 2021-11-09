const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, Uint32Max } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

describe('SherlockProtocolManager', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await prepare(this, ['SherlockProtocolManagerTest', 'ERC20Mock6d']);

    await deploy(this, [
      ['ERC20Mock6d', this.ERC20Mock6d, ['USDC Token', 'USDC', parseUnits('1000', 6)]],
    ]);
    await deploy(this, [['spm', this.SherlockProtocolManagerTest, [this.ERC20Mock6d.address]]]);

    await timeTraveler.snapshot();
  });
  describe('setProtocolPremium()', function () {
    before(async function () {
      await this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'));
    });
    it('Initial state', async function () {
      expect(await this.spm.balances(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.premiums(this.protocolX)).to.eq(0);

      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(0);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
    });
    it('Do', async function () {
      const premium = parseUnits('10', 6);
      const premiumStakers = parseUnits('9', 6);
      const premiumNonStakers = parseUnits('1', 6);
      const t = await timestamp(this.spm.setProtocolPremium(this.protocolX, premium));

      expect(await this.spm.balances(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(t);
      expect(await this.spm.premiums(this.protocolX)).to.eq(premium);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(t);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(premiumStakers);
      expect(await this.spm.viewNonStakersPerBlock(this.protocolX)).to.eq(premiumNonStakers);
    });
  });
});
