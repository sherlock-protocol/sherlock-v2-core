const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);

describe.only('Sherlock ─ Stateless', function () {
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
  describe('constructor', function () {});
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
    this.claimManager = this.carol;
    this.nonStakerAddress = this.bob;

    await prepare(this, ['SherlockProtocolManagerTest', 'ERC20Mock6d', 'SherlockMock']);

    await deploy(this, [['ERC20Mock6d', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['spm', this.SherlockProtocolManagerTest, [this.ERC20Mock6d.address]]]);
    await deploy(this, [['SherlockMock', this.SherlockMock, []]]);
  });
  describe('constructor', function () {});
  describe('enablePeriod()', function () {});
  describe('disablePeriod()', function () {});
  describe('updateSherDistributionManager()', function () {});
  describe('removeSherDistributionManager()', function () {});
  describe('updateNonStakersAddress()', function () {});
  describe('updateSherlockProtocolManager()', function () {});
  describe('updateSherlockClaimManager()', function () {});
  describe('updateStrategy()', function () {});
  describe('strategyDeposit()', function () {});
  describe('strategyWithdraw()', function () {});
  describe('strategyWithdrawAll()', function () {});
  describe('payout()', function () {});
  describe('burn()', function () {});
  describe('hold()', function () {});
  describe('holdArb()', function () {});
});
