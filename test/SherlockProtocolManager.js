const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
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
    it('Zero protocol', async function () {
      await expect(
        this.spm.protocolUpdate(constants.HashZero, id('x'), parseEther('0.1'), 500),
      ).to.be.revertedWith('ProtocolNotExists("' + constants.HashZero + '")');
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
        'ProtocolNotExists("' + constants.HashZero + '")',
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
        'ProtocolNotExists("' + constants.HashZero + '")',
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
        'ProtocolNotExists("' + constants.HashZero + '")',
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
        'ProtocolNotExists("' + constants.HashZero + '")',
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
        'ProtocolNotExists("' + constants.HashZero + '")',
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
        'ProtocolNotExists("' + constants.HashZero + '")',
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
        'ProtocolNotExists("' + constants.HashZero + '")',
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
      ).to.be.revertedWith('ProtocolNotExists("' + constants.HashZero + '")');
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

    await this.ERC20Mock6d.approve(this.spm.address, maxTokens);
    await timeTraveler.snapshot();
  });
  describe('protocolAdd()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(0);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.balances(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premiums(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      // events
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[0].event).to.eq('ProtocolAgentTransfer');
      expect(this.t0.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[0].args.from).to.eq(constants.AddressZero);
      expect(this.t0.events[0].args.to).to.eq(this.alice.address);
      expect(this.t0.events[1].event).to.eq('ProtocolAdded');
      expect(this.t0.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[2].event).to.eq('ProtocolUpdated');
      expect(this.t0.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t0.events[2].args.coverage).to.eq(id('t'));
      expect(this.t0.events[2].args.nonStakers).to.eq(parseEther('0.1'));
      expect(this.t0.events[2].args.coverageAmount).to.eq(500);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t0.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premiums(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
  });
  describe('protocolUpdate()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await this.spm.protocolAdd(
        this.protocolX,
        this.alice.address,
        id('t'),
        parseEther('0.1'),
        500,
      );
      await this.spm.depositProtocolBalance(this.protocolX, maxTokens);
      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));

      await timeTraveler.mine(10);
    });
    it('Initial state', async function () {
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t1.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens.sub(this.premium.mul(10)));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(10),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(10),
      );
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(10));
    });
    it('Do', async function () {
      this.newPremium = parseUnits('10', 6);
      this.newPremiumStakers = parseUnits('8', 6);
      this.newPremiumNonStakers = parseUnits('2', 6);

      this.t2 = await meta(
        this.spm.protocolUpdate(this.protocolX, id('tx'), parseEther('0.2'), 1500),
      );

      // events
      expect(this.t2.events.length).to.eq(1);
      expect(this.t2.events[0].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[0].args.coverage).to.eq(id('tx'));
      expect(this.t2.events[0].args.nonStakers).to.eq(parseEther('0.2'));
      expect(this.t2.events[0].args.coverageAmount).to.eq(1500);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(11)),
      );
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11),
      );
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.2'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(500);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t2.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(this.premiumStakers.mul(11));

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens.sub(this.premium.mul(11)));
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(11),
      );
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(1500);
      expect(coverageAmounts[1]).to.eq(500);

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers.mul(11));
    });
    it('Verify', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(11)),
      );
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t2.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11),
      );
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.2'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(1500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(500);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.newPremiumStakers);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t2.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(this.premiumStakers.mul(11));

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(11)).sub(this.newPremium),
      );
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(
        this.premiumNonStakers.mul(11).add(this.newPremiumNonStakers),
      );
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium).sub(11).sub(1),
      );
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(1500);
      expect(coverageAmounts[1]).to.eq(500);

      expect(await this.spm.claimablePremiums()).to.eq(
        this.premiumStakers.mul(11).add(this.newPremiumStakers),
      );
    });
  });
  describe('protocolRemove() b0,p0', function () {
    // could have balance=0 + premium=0 <-- in case never been active (or made to this state)
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Initial state', async function () {
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t0.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premiums(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
    it('Do', async function () {
      this.t1 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t1.events.length).to.eq(3);
      expect(this.t1.events[0].event).to.eq('ProtocolAgentTransfer');
      expect(this.t1.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[0].args.from).to.eq(this.alice.address);
      expect(this.t1.events[0].args.to).to.eq(constants.AddressZero);
      expect(this.t1.events[1].event).to.eq('ProtocolUpdated');
      expect(this.t1.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[1].args.coverage).to.eq(constants.HashZero);
      expect(this.t1.events[1].args.nonStakers).to.eq(0);
      expect(this.t1.events[1].args.coverageAmount).to.eq(0);
      expect(this.t1.events[2].event).to.eq('ProtocolRemoved');
      expect(this.t1.events[2].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t1.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.balances(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premiums(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(0);
    });
  });
  describe('protocolRemove() b!0,p0', function () {
    // could have balance + premium=0 <-- in case premium was set by 0 by gov first (or never set)
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      await this.spm.depositProtocolBalance(this.protocolX, maxTokens);
    });
    it('Initial state', async function () {
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t0.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t0.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premiums(this.protocolX)).to.eq(0);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Do', async function () {
      this.t1 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t1.events.length).to.eq(5);
      expect(this.t1.events[1].event).to.eq('ProtocolBalanceWithdrawn');
      expect(this.t1.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[1].args.amount).to.eq(maxTokens);
      expect(this.t1.events[2].event).to.eq('ProtocolAgentTransfer');
      expect(this.t1.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[2].args.from).to.eq(this.alice.address);
      expect(this.t1.events[2].args.to).to.eq(constants.AddressZero);
      expect(this.t1.events[3].event).to.eq('ProtocolUpdated');
      expect(this.t1.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[3].args.coverage).to.eq(constants.HashZero);
      expect(this.t1.events[3].args.nonStakers).to.eq(0);
      expect(this.t1.events[3].args.coverageAmount).to.eq(0);
      expect(this.t1.events[4].event).to.eq('ProtocolRemoved');
      expect(this.t1.events[4].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t1.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.balances(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premiums(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(maxTokens);
    });
  });
  describe('protocolRemove() b!0,p!0', function () {
    // could have balance + premium <-- in case active
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
      await this.spm.depositProtocolBalance(this.protocolX, maxTokens);

      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
    });
    it('Initial state', async function () {
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t1.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(maxTokens);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(0);
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(
        maxTokens.div(this.premium),
      );
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      expect(await this.spm.claimablePremiums()).to.eq(0);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Do', async function () {
      this.t2 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t2.events.length).to.eq(6);
      expect(this.t2.events[0].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[0].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[0].args.newPremium).to.eq(0);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].event).to.eq('ProtocolBalanceWithdrawn');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.amount).to.eq(maxTokens.sub(this.premium));
      expect(this.t2.events[3].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[3].args.from).to.eq(this.alice.address);
      expect(this.t2.events[3].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[4].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[4].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[4].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[4].args.nonStakers).to.eq(0);
      expect(this.t2.events[4].args.coverageAmount).to.eq(0);
      expect(this.t2.events[5].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[5].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(
        this.premiumNonStakers,
      );
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t2.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(this.premiumStakers);

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.balances(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.premiumNonStakers);
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premiums(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(this.premiumStakers);

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.premium),
      );
    });
  });
  describe('protocolRemove() b0,p!0', function () {
    // could have premium + balance=0 <-- in case remove incentives have failed
    before(async function () {
      this.premium = parseUnits('10', 6);
      this.premiumStakers = parseUnits('9', 6);
      this.premiumNonStakers = parseUnits('1', 6);

      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );

      this.balance = this.premium.mul(1000000);
      this.time = 30000000000000;
      await this.spm.depositProtocolBalance(this.protocolX, this.balance);

      this.t1 = await meta(this.spm.setProtocolPremium(this.protocolX, this.premium));
      await hre.network.provider.request({
        method: 'evm_increaseTime',
        params: [this.time],
      });
      await timeTraveler.mine(1);
    });
    it('Initial state', async function () {
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(this.balance);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(this.t1.time);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(parseEther('0.1'));
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(500);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(this.premiumStakers);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t1.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(0);

      expect(await this.spm.protocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.spm.balances(this.protocolX)).to.eq(0);
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.balance.div(10));
      expect(await this.spm.secondsOfCoverageLeft(this.protocolX)).to.eq(0);
      expect(await this.spm.premiums(this.protocolX)).to.eq(this.premium);
      const coverageAmounts = await this.spm.coverageAmounts(this.protocolX);
      expect(coverageAmounts[0]).to.eq(500);
      expect(coverageAmounts[1]).to.eq(0);

      // NOTE this is unwanted side effect
      // Hence the reason for the incentivized removal of protocols
      expect(await this.spm.claimablePremiums()).to.eq(
        BigNumber.from(this.time).mul(this.premiumStakers),
      );

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.balance),
      );
    });
    it('Do', async function () {
      this.t2 = await meta(this.spm.protocolRemove(this.protocolX));

      // events
      expect(this.t2.events.length).to.eq(5);
      expect(this.t2.events[0].event).to.eq('AccountingError');
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolX);
      const accountedAmount = BigNumber.from(this.time + 1).mul(this.premium);
      expect(this.t2.events[0].args.amount).to.eq(accountedAmount.sub(this.balance));
      expect(this.t2.events[1].event).to.eq('ProtocolPremiumChanged');
      expect(this.t2.events[1].args.oldPremium).to.eq(this.premium);
      expect(this.t2.events[1].args.newPremium).to.eq(0);
      expect(this.t2.events[1].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].event).to.eq('ProtocolAgentTransfer');
      expect(this.t2.events[2].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[2].args.from).to.eq(this.alice.address);
      expect(this.t2.events[2].args.to).to.eq(constants.AddressZero);
      expect(this.t2.events[3].event).to.eq('ProtocolUpdated');
      expect(this.t2.events[3].args.protocol).to.eq(this.protocolX);
      expect(this.t2.events[3].args.coverage).to.eq(constants.HashZero);
      expect(this.t2.events[3].args.nonStakers).to.eq(0);
      expect(this.t2.events[3].args.coverageAmount).to.eq(0);
      expect(this.t2.events[4].event).to.eq('ProtocolRemoved');
      expect(this.t2.events[4].args.protocol).to.eq(this.protocolX);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
      expect(await this.spm.viewLastAccountedProtocol(this.protocolX)).to.eq(0);
      expect(await this.spm.viewNonStakersClaimableStored(this.protocolX)).to.eq(
        this.balance.div(10),
      );
      expect(await this.spm.viewNonStakersShares(this.protocolX)).to.eq(0);
      expect(await this.spm.viewCurrentCoverage(this.protocolX)).to.eq(0);
      expect(await this.spm.viewPreviousCoverage(this.protocolX)).to.eq(0);

      expect(await this.spm.viewTotalPremiumPerBlock()).to.eq(0);
      expect(await this.spm.viewLastAccounted()).to.eq(this.t2.time);
      expect(await this.spm.viewClaimablePremiumsStored()).to.eq(this.balance.div(10).mul(9));

      await expect(this.spm.protocolAgent(this.protocolX)).to.be.reverted;
      await expect(this.spm.balances(this.protocolX)).to.be.reverted;
      expect(await this.spm.nonStakersClaimable(this.protocolX)).to.eq(this.balance.div(10));
      await expect(this.spm.secondsOfCoverageLeft(this.protocolX)).to.be.reverted;
      await expect(this.spm.premiums(this.protocolX)).to.be.reverted;
      await expect(this.spm.coverageAmounts(this.protocolX)).to.be.reverted;

      expect(await this.spm.claimablePremiums()).to.eq(this.balance.div(10).mul(9));

      expect(await this.ERC20Mock6d.balanceOf(this.alice.address)).to.eq(
        maxTokens.sub(this.balance),
      );
    });
  });
  describe('forceRemoveByBalance()', function () {});
  describe('forceRemoveByRemainingCoverage()', function () {});
  describe('claimPremiums()', function () {});
  describe('setMinBalance()', function () {});
  describe('setMinSecondsOfCoverage()', function () {});
  describe('setProtocolPremium()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.t0 = await meta(
        this.spm.protocolAdd(this.protocolX, this.alice.address, id('t'), parseEther('0.1'), 500),
      );
    });
    it('Initial state', async function () {
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(0);
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

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(maxTokens);
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
      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(maxTokens);
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
    });
    it('Verify, t=2', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(maxTokens);
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

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(2)),
      );
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
    });
    it('Verify, t=4', async function () {
      await timeTraveler.mine(1);

      expect(await this.spm.viewBalancesInternal(this.protocolX)).to.eq(
        maxTokens.sub(this.premium.mul(2)),
      );
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
    });
  });
  describe('setProtocolPremiums()', function () {});
  describe('depositProtocolBalance()', function () {});
  describe('withdrawProtocolBalance()', function () {});
  describe('transferProtocolAgent()', function () {});
  describe('nonStakersClaim()', function () {});
});
