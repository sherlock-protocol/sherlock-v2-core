const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('1000000000000000000', 6);

describe('SherlockProtocolManager', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await prepare(this, ['SherlockProtocolManagerTest', 'ERC20Mock6d']);

    await deploy(this, [['ERC20Mock6d', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['spm', this.SherlockProtocolManagerTest, [this.ERC20Mock6d.address]]]);

    await timeTraveler.snapshot();
  });
  describe('setProtocolPremium()', function () {
    before(async function () {
      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      await this.ERC20Mock6d.approve(this.spm.address, maxTokens);
    });
    it('Initial state', async function () {
      expect(await this.spm.balances(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.premiums(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t0.time);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewNonStakersPerBlock(this.protocolX)).to.eq(0);
    });
    it('Insufficient balance', async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await expect(this.spm.setProtocolPremium(this.protocolX, this.premium)).to.be.revertedWith(
        'InsufficientBalance("' + this.protocolX + '")',
      );
      await this.spm.depositProtocolBalance(this.protocolX, maxTokens);
    });
    it('Set same value (0)', async function () {
      this.tfail = await meta(this.spm.setProtocolPremium(this.protocolX, 0));

      expect(this.tfail.events.length).to.eq(0);

      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.tfail.time);
      expect(await this.spm.premiums(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.tfail.time);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewNonStakersPerBlock(this.protocolX)).to.eq(0);
    });
    it('Do, t=1', async function () {
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));

      // events
      expect(this.t1.events.length).to.eq(1);
      expect(this.t1.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t1.events[0].args.oldPremium).to.eq(0);
      expect(this.t1.events[0].args.newPremium).to.eq(this.premium);
      expect(this.t1.events[0].args.protocol).to.eq(this.protocolX);

      // storage
      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium),
      );

      expect(await this.spm.claimablePremiums()).to.eq(0);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t1.time);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.premiumStakers);
      expect(await this.spm.viewNonStakersPerBlock(this.protocolX)).to.eq(this.premiumNonStakers);
    });
    it('Verify, t=2', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens.sub(this.premium));
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.premiumNonStakers);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.premium);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(1),
      );

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t1.time);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.premiumStakers);
      expect(await this.spm.viewNonStakersPerBlock(this.protocolX)).to.eq(this.premiumNonStakers);
    });
    it('Do again, t=3', async function () {
      this.newPremium = this.premium.mul(10);
      this.newPremiumStakers = this.premiumStakers.mul(10);
      this.newPremiumNonStakers = this.premiumNonStakers.mul(10);
      this.t3 = await meta(this.spm.setProtocolPremium(this.protocolX, this.newPremium));

      // events
      expect(this.t3.events.length).to.eq(1);
      expect(this.t3.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t3.events[0].args.oldPremium).to.eq(this.premium);
      expect(this.t3.events[0].args.newPremium).to.eq(this.newPremium);
      expect(this.t3.events[0].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens.sub(this.premium.mul(2)));
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t3.time);
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.newPremium);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.newPremium).sub(1),
      );

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(2));
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(this.premiumStakers.mul(2));
      expect(await this.spm.viewLastAccounted()).to.eq(this.t3.time);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewNonStakersPerBlock(this.protocolX)).to.eq(
        this.newPremiumNonStakers,
      );
    });
    it('Verify, t=4', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.balances(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(2)).sub(this.newPremium),
      );
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(2).add(this.newPremiumNonStakers),
      );
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t3.time);
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.newPremium);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.newPremium).sub(2),
      );

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(2).add(this.newPremiumStakers),
      );
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(this.premiumStakers.mul(2));
      expect(await this.spm.viewLastAccounted()).to.eq(this.t3.time);
      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewNonStakersPerBlock(this.protocolX)).to.eq(
        this.newPremiumNonStakers,
      );
    });
  });
});
