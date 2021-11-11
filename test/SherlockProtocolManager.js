const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('1000000000000000000', 6);

describe('SherlockProtocolManager ─ Stateless', function () {
  before(async function () {
    await prepare(this, ['SherlockProtocolManagerTest', 'ERC20Mock6d', 'SherlockMock']);

    await deploy(this, [['ERC20Mock6d', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['spm', this.SherlockProtocolManagerTest, [this.ERC20Mock6d.address]]]);
    await deploy(this, [['SherlockMock', this.SherlockMock, []]]);
  });
  describe('protocolAdd()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm
          .connect(this.bob)
          .protocolAdd(this.protocolX, this.alice.address, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero protocol', async function () {
      await expect(
        this.spm.protocolAdd(
          constants.HashZero,
          this.alice.address,
          id('x'),
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero agent', async function () {
      await expect(
        this.spm.protocolAdd(
          this.protocolX,
          constants.AddressZero,
          id('x'),
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero coverage', async function () {
      await expect(
        this.spm.protocolAdd(
          this.protocolX,
          this.alice.address,
          constants.HashZero,
          parseEther('0.1'),
          500,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Nonstaker exceed 100%', async function () {
      await expect(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('x'), parseEther('1.01'), 500),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Zero coverage amount', async function () {
      await expect(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('x'), parseEther('0.1'), 0),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Success', async function () {
      await this.spm.protocolAdd(
        this.protocolX,
        this.carol.address,
        id('t'),
        parseEther('0.1'),
        500,
      );
    });
  });
  describe('protocolUpdate()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm.connect(this.bob).protocolUpdate(this.protocolX, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero coverage', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolX, constants.HashZero, parseEther('0.1'), 500),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Nonstaker exceed 100%', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolX, id('x'), parseEther('1.1'), 500),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Zero coverage amount', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolX, id('x'), parseEther('0.1'), 0),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Protocol not exists', async function () {
      await expect(
        this.spm.protocolUpdate(this.protocolY, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('ProtocolNotExists("' + this.protocolY + '")');
    });
  });
  describe('protocolRemove()', function () {
    it('Invalid sender', async function () {
      await expect(this.spm.connect(this.bob).protocolRemove(this.protocolX)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Zero protocol', async function () {
      await expect(this.spm.protocolRemove(constants.HashZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.protocolRemove(this.protocolY)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('forceRemoveByBalance()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.forceRemoveByBalance(constants.HashZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.forceRemoveByBalance(this.protocolY)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('forceRemoveByRemainingCoverage()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.forceRemoveByRemainingCoverage(constants.HashZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.forceRemoveByRemainingCoverage(this.protocolY)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('claimPremiums()', function () {
    it('Invalid conditions', async function () {
      await expect(this.spm.claimPremiums()).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('setMinBalance()', function () {});
  describe('setMinSecondsOfCoverage()', function () {});
  describe('setProtocolPremium()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm.connect(this.bob).setProtocolPremium(this.protocolX, 1),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero protocol', async function () {
      await expect(this.spm.setProtocolPremium(constants.HashZero, 1)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.setProtocolPremium(this.protocolY, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('setProtocolPremiums()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.spm.connect(this.bob).setProtocolPremiums([this.protocolX], [1]),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Unequal array length', async function () {
      await expect(this.spm.setProtocolPremiums([this.protocolX], [1, 2])).to.be.revertedWith(
        'UnequalArrayLength()',
      );
    });
    it('Zero protocol', async function () {
      await expect(this.spm.setProtocolPremiums([constants.HashZero], [2])).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(
        this.spm.setProtocolPremiums([this.protocolX, this.protocolY], [0, 1]),
      ).to.be.revertedWith('ProtocolNotExists("' + this.protocolY + '")');
    });
  });
  describe('depositProtocolBalance()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.depositProtocolBalance(constants.HashZero, 1)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Zero amount', async function () {
      await expect(this.spm.depositProtocolBalance(this.protocolX, 0)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.depositProtocolBalance(this.protocolY, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
  });
  describe('withdrawProtocolBalance()', function () {
    it('Zero protocol', async function () {
      await expect(this.spm.withdrawProtocolBalance(constants.HashZero, 1)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Zero amount', async function () {
      await expect(this.spm.withdrawProtocolBalance(this.protocolX, 0)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Protocol not exists', async function () {
      await expect(this.spm.withdrawProtocolBalance(this.protocolY, 1)).to.be.revertedWith(
        'ProtocolNotExists("' + this.protocolY + '")',
      );
    });
    it('Protocol wrong agent', async function () {
      await expect(this.spm.withdrawProtocolBalance(this.protocolX, 1)).to.be.revertedWith(
        'Unauthorized()',
      );
    });
    it('Protocol balance', async function () {
      await expect(
        this.spm.connect(this.carol).withdrawProtocolBalance(this.protocolX, 1),
      ).to.be.revertedWith('InsufficientBalance("' + this.protocolX + '")');
    });
  });
  describe('transferProtocolAgent()', function () {
    it('Zero protocol', async function () {
      await expect(
        this.spm.transferProtocolAgent(constants.HashZero, this.bob.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero protocol agent', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolX, constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same protocol agent', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolX, this.alice.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Protocol not exists', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolY, this.bob.address),
      ).to.be.revertedWith('ProtocolNotExists("' + this.protocolY + '")');
    });
    it('Wrong protocol agent', async function () {
      await expect(
        this.spm.transferProtocolAgent(this.protocolX, this.bob.address),
      ).to.be.revertedWith('Unauthorized()');
    });
  });
  describe('nonStakersClaim()', function () {
    it('Zero protocol', async function () {
      await expect(
        this.spm.nonStakersClaim(constants.HashZero, 1, this.bob.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero amount', async function () {
      await expect(
        this.spm.nonStakersClaim(this.protocolX, 0, this.bob.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero receiver', async function () {
      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Unauthorized', async function () {
      this.SherlockMock.setNonStakersAddress(this.bob.address);
      this.spm.setSherlockCoreAddress(this.SherlockMock.address);

      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('Unauthorized()');
    });
    it('Exceed', async function () {
      this.SherlockMock.setNonStakersAddress(this.alice.address);

      await expect(
        this.spm.nonStakersClaim(this.protocolX, 1, this.bob.address),
      ).to.be.revertedWith('InsufficientBalance("' + this.protocolX + '")');
    });
  });
});

describe('SherlockProtocolManager ─ Functional', function () {
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
