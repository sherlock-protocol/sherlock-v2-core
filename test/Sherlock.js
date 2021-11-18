const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);

describe('Sherlock ─ Stateless', function () {
  before(async function () {
    await prepare(this, [
      'StrategyMock',
      'SherlockProtocolManagerMock',
      'SherDistributionMock',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'Sherlock',
    ]);

    this.claimManager = this.carol;
    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens]]]);

    await deploy(this, [['strategy', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['strategy2', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['protmanager2', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['sherdist', this.SherDistributionMock, [this.token.address]]]);
    await deploy(this, [['sherdist2', this.SherDistributionMock, [this.token.address]]]);

    await deploy(this, [
      [
        'sherlock',
        this.Sherlock,
        [
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ],
      ],
    ]);
  });
  describe('constructor', function () {
    it('Zero token', async function () {
      await expect(
        this.Sherlock.deploy(
          constants.AddressZero,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero sher', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          constants.AddressZero,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero strategy', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          constants.AddressZero,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero nostaker', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          constants.AddressZero,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero protocol manager', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          constants.AddressZero,
          this.claimManager.address,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero claim manager', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          constants.AddressZero,
          [10, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero periods', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [0, 20],
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same periods', async function () {
      await expect(
        this.Sherlock.deploy(
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [20, 20],
        ),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('enablePeriod()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).enablePeriod(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Zero period', async function () {
      await expect(this.sherlock.enablePeriod(0)).to.be.revertedWith('ZeroArgument()');
    });
    it('Invalid period', async function () {
      await expect(this.sherlock.enablePeriod(10)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('disablePeriod()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).disablePeriod(10)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Invalid period', async function () {
      await expect(this.sherlock.disablePeriod(1)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateSherDistributionManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateSherDistributionManager(this.sherdist2.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero manager', async function () {
      await expect(
        this.sherlock.updateSherDistributionManager(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same manager', async function () {
      await expect(
        this.sherlock.updateSherDistributionManager(this.sherdist.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('removeSherDistributionManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).removeSherDistributionManager(),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Succes', async function () {
      await this.sherlock.removeSherDistributionManager();
    });
    it('Do again', async function () {
      await expect(this.sherlock.removeSherDistributionManager()).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
  });
  describe('updateNonStakersAddress()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateNonStakersAddress(this.carol.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(this.sherlock.updateNonStakersAddress(constants.AddressZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Same argument', async function () {
      await expect(
        this.sherlock.updateNonStakersAddress(this.nonStaker.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateSherlockProtocolManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateSherlockProtocolManager(this.protmanager2.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(
        this.sherlock.updateSherlockProtocolManager(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same argument', async function () {
      await expect(
        this.sherlock.updateSherlockProtocolManager(this.protmanager.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateSherlockClaimManager()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateSherlockClaimManager(this.bob.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(
        this.sherlock.updateSherlockClaimManager(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Same argument', async function () {
      await expect(
        this.sherlock.updateSherlockClaimManager(this.claimManager.address),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('updateStrategy()', function () {
    it('Invalid sender', async function () {
      await expect(
        this.sherlock.connect(this.bob).updateStrategy(this.strategy2.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(this.sherlock.updateStrategy(constants.AddressZero)).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Same argument', async function () {
      await expect(this.sherlock.updateStrategy(this.strategy.address)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
  });
  describe('strategyDeposit()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).strategyDeposit(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Invalid amount', async function () {
      await expect(this.sherlock.strategyDeposit(0)).to.be.revertedWith('ZeroArgument()');
    });
  });
  describe('strategyWithdraw()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).strategyWithdraw(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Invalid amount', async function () {
      await expect(this.sherlock.strategyWithdraw(0)).to.be.revertedWith('ZeroArgument()');
    });
  });
  describe('strategyWithdrawAll()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.connect(this.bob).strategyWithdrawAll()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('payout()', function () {
    it('Invalid sender', async function () {
      await expect(this.sherlock.payout(this.alice.address, 1)).to.be.revertedWith(
        'Unauthorized()',
      );
    });
  });
});

describe('Sherlock ─ Functional', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, [
      'StrategyMock',
      'SherlockProtocolManagerMock',
      'SherDistributionMock',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'Sherlock',
    ]);

    this.claimManager = this.carol;
    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens]]]);

    await deploy(this, [['strategy', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['strategy2', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['protmanager2', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['sherdist', this.SherDistributionMock, [this.token.address]]]);
    await deploy(this, [['sherdist2', this.SherDistributionMock, [this.token.address]]]);

    await deploy(this, [
      [
        'sherlock',
        this.Sherlock,
        [
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ],
      ],
    ]);

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Deploy', async function () {
      this.d = await this.Sherlock.deploy(
        this.token.address,
        this.sher.address,
        'SHER POSITION',
        'SPS',
        this.strategy.address,
        this.sherdist.address,
        this.nonStaker.address,
        this.protmanager.address,
        this.claimManager.address,
        [10, 20],
      );
      this.d = await meta(this.d.deployTransaction);
      expect(this.d.events.length).to.eq(8);
    });
    it('Ownership', async function () {
      expect(this.d.events[0].event).to.eq('OwnershipTransferred');
    });
    it('setPeriod', async function () {
      expect(this.d.events[1].event).to.eq('StakingPeriodEnabled');
      expect(this.d.events[1].args.period).to.eq(10);
    });
    it('setPeriod', async function () {
      expect(this.d.events[2].event).to.eq('StakingPeriodEnabled');
      expect(this.d.events[2].args.period).to.eq(20);
    });
    it('YieldStrategyUpdated', async function () {
      expect(this.d.events[3].event).to.eq('YieldStrategyUpdated');
      expect(this.d.events[3].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[3].args.current).to.eq(this.strategy.address);
    });
    it('SherDistributionManagerUpdated', async function () {
      expect(this.d.events[4].event).to.eq('SherDistributionManagerUpdated');
      expect(this.d.events[4].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[4].args.current).to.eq(this.sherdist.address);
    });
    it('NonStakerAddressUpdated', async function () {
      expect(this.d.events[5].event).to.eq('NonStakerAddressUpdated');
      expect(this.d.events[5].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[5].args.current).to.eq(this.nonStaker.address);
    });
    it('ProtocolManagerUpdated', async function () {
      expect(this.d.events[6].event).to.eq('ProtocolManagerUpdated');
      expect(this.d.events[6].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[6].args.current).to.eq(this.protmanager.address);
    });
    it('ClaimManagerUpdated', async function () {
      expect(this.d.events[7].event).to.eq('ClaimManagerUpdated');
      expect(this.d.events[7].args.previous).to.eq(constants.AddressZero);
      expect(this.d.events[7].args.current).to.eq(this.claimManager.address);
    });
  });
  describe('enablePeriod()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.periods(100)).to.eq(false);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.enablePeriod(100));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('StakingPeriodEnabled');
      expect(this.t0.events[0].args.period).to.eq(100);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.periods(100)).to.eq(true);
    });
  });
  describe('disablePeriod()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.periods(10)).to.eq(true);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.disablePeriod(10));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('StakingPeriodDisabled');
      expect(this.t0.events[0].args.period).to.eq(10);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.periods(10)).to.eq(false);
    });
  });
  describe('updateSherDistributionManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(this.sherdist.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateSherDistributionManager(this.sherdist2.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('SherDistributionManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.sherdist.address);
      expect(this.t0.events[0].args.current).to.eq(this.sherdist2.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(this.sherdist2.address);
    });
  });
  describe('removeSherDistributionManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(this.sherdist.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.removeSherDistributionManager());

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('SherDistributionManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.sherdist.address);
      expect(this.t0.events[0].args.current).to.eq(constants.AddressZero);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherDistributionManager()).to.eq(constants.AddressZero);
    });
  });
  describe('updateNonStakersAddress()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.nonStakersAddress()).to.eq(this.nonStaker.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateNonStakersAddress(this.alice.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('NonStakerAddressUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.nonStaker.address);
      expect(this.t0.events[0].args.current).to.eq(this.alice.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.nonStakersAddress()).to.eq(this.alice.address);
    });
  });
  describe('updateSherlockProtocolManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherlockProtocolManager()).to.eq(this.protmanager.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateSherlockProtocolManager(this.protmanager2.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ProtocolManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.protmanager.address);
      expect(this.t0.events[0].args.current).to.eq(this.protmanager2.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherlockProtocolManager()).to.eq(this.protmanager2.address);
    });
  });
  describe('updateSherlockClaimManager()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.sherlockClaimManager()).to.eq(this.claimManager.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateSherlockClaimManager(this.alice.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ClaimManagerUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.claimManager.address);
      expect(this.t0.events[0].args.current).to.eq(this.alice.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.sherlockClaimManager()).to.eq(this.alice.address);
    });
  });
  describe('updateStrategy()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sherlock.strategy()).to.eq(this.strategy.address);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.updateStrategy(this.strategy2.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('YieldStrategyUpdated');
      expect(this.t0.events[0].args.previous).to.eq(this.strategy.address);
      expect(this.t0.events[0].args.current).to.eq(this.strategy2.address);
    });
    it('Verify state', async function () {
      expect(await this.sherlock.strategy()).to.eq(this.strategy2.address);
    });
  });
  describe('strategyDeposit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.sherlock.address, this.amount);
      await this.token.transfer(this.protmanager.address, this.amount.mul(2));
      await this.protmanager.setAmount(this.amount.mul(2));
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.protmanager.address)).to.eq(this.amount.mul(2));
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.protmanager.claimCalled()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.strategyDeposit(this.amount));
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount.mul(2));
      expect(await this.token.balanceOf(this.protmanager.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.protmanager.claimCalled()).to.eq(1);
    });
  });
  describe('strategyWithdraw()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.strategy.address, this.amount);
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.strategyWithdraw(this.amount.div(2)));
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount.div(2));
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount.div(2));

      expect(await this.strategy.withdrawCalled()).to.eq(1);
    });
    it('Do and verify state', async function () {
      this.t1 = await meta(this.sherlock.strategyWithdraw(this.amount.div(2)));

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(0);

      expect(await this.strategy.withdrawCalled()).to.eq(2);
    });
  });
  describe('strategyWithdrawAll()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.strategy.address, this.amount);
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);

      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
    });
    it('Do', async function () {
      this.t0 = await meta(this.sherlock.strategyWithdrawAll());
    });
    it('Verify state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(0);

      expect(await this.strategy.withdrawAllCalled()).to.eq(1);
    });
  });
  describe('payout()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.amount = parseUnits('100', 6);
      await this.token.transfer(this.sherlock.address, this.amount);
      await this.token.transfer(this.strategy.address, this.amount);
    });
    it('Initial state', async function () {
      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(0);

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do zero', async function () {
      this.t0 = await meta(this.sherlock.connect(this.claimManager).payout(this.bob.address, 0));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ClaimPayout');
      expect(this.t0.events[0].args.receiver).to.eq(this.bob.address);
      expect(this.t0.events[0].args.amount).to.eq(0);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(0);

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do small', async function () {
      this.t1 = await meta(
        this.sherlock.connect(this.claimManager).payout(this.bob.address, this.amount.div(10)),
      );

      expect(this.t1.events.length).to.eq(3);
      expect(this.t1.events[2].event).to.eq('ClaimPayout');
      expect(this.t1.events[2].args.receiver).to.eq(this.bob.address);
      expect(this.t1.events[2].args.amount).to.eq(this.amount.div(10));

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(
        this.amount.sub(this.amount.div(10)),
      );
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(this.amount);
      expect(await this.token.balanceOf(this.bob.address)).to.eq(this.amount.div(10));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
    });
    it('Do big', async function () {
      this.t1 = await meta(
        this.sherlock.connect(this.claimManager).payout(this.bob.address, this.amount),
      );

      expect(this.t1.events.length).to.eq(4);
      expect(this.t1.events[3].event).to.eq('ClaimPayout');
      expect(this.t1.events[3].args.receiver).to.eq(this.bob.address);
      expect(this.t1.events[3].args.amount).to.eq(this.amount);

      expect(await this.token.balanceOf(this.sherlock.address)).to.eq(0);
      expect(await this.token.balanceOf(this.strategy.address)).to.eq(
        this.amount.sub(this.amount.div(10)),
      );
      expect(await this.token.balanceOf(this.bob.address)).to.eq(
        this.amount.add(this.amount.div(10)),
      );

      expect(await this.strategy.withdrawCalled()).to.eq(1);
    });
  });
  describe('mint()', function () {});
  describe('burn()', function () {});
  describe('hold()', function () {});
  describe('holdArb()', function () {});
});
