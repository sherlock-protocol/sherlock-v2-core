const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);
const maxTokens2 = parseUnits('100000000000', 18);

const weeks1 = 60 * 60 * 24 * 7 * 1;
const weeks2 = 60 * 60 * 24 * 7 * 2;
const weeks12 = 60 * 60 * 24 * 7 * 12;

describe.only('BuySher', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, [
      'StrategyMock',
      'SherlockProtocolManagerMock',
      'SherDistributionMock',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'Sherlock',
      'BuySher',
    ]);

    this.claimManager = this.carol;
    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens2]]]);

    await deploy(this, [['strategy', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['strategy2', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['protmanager2', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [
      ['sherdist', this.SherDistributionMock, [this.token.address, this.sher.address]],
    ]);

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
    await deploy(this, [
      [
        'buySherSimple',
        this.BuySher,
        [
          this.sher.address,
          this.token.address,
          parseUnits('1', 18),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
        ],
      ],
    ]);
    await deploy(this, [
      [
        'buySherComplex',
        this.BuySher,
        [
          this.sher.address,
          this.token.address,
          parseUnits('0.1', 18),
          parseUnits('2', 6),
          this.sherlock.address,
          this.carol.address,
        ],
      ],
    ]);

    await this.token.approve(this.sherlock.address, maxTokens);

    this.amount = parseUnits('100', 6);
    await this.sherlock.initialStake(this.amount, 10, this.bob.address);

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Zero sher', async function () {
      await expect(
        this.BuySher.deploy(
          constants.AddressZero,
          this.token.address,
          parseUnits('1', 18),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero token', async function () {
      await expect(
        this.BuySher.deploy(
          this.sher.address,
          constants.AddressZero,
          parseUnits('1', 18),
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero rate', async function () {
      await expect(
        this.BuySher.deploy(
          this.sher.address,
          this.token.address,
          0,
          parseUnits('1', 6),
          this.sherlock.address,
          this.carol.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero rate', async function () {
      await expect(
        this.BuySher.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 18),
          0,
          this.sherlock.address,
          this.carol.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero sherlock', async function () {
      await expect(
        this.BuySher.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 18),
          parseUnits('1', 6),
          constants.AddressZero,
          this.carol.address,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero receiver', async function () {
      await expect(
        this.BuySher.deploy(
          this.sher.address,
          this.token.address,
          parseUnits('1', 18),
          parseUnits('1', 6),
          this.sherlock.address,
          constants.AddressZero,
        ),
      ).to.be.revertedWith('ZeroArgument()');
    });
  });
  describe('viewBuyLimit() - Simple', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Non existent position', async function () {
      await expect(this.buySherSimple.viewBuyLimit(0)).to.be.revertedWith('NonExistent()');
      await expect(this.buySherSimple.viewBuyLimit(2)).to.be.revertedWith('NonExistent()');
    });
    it('View non sher tokens', async function () {
      expect(await this.buySherSimple.viewBuyLimit(1)).to.eq(0);
    });
    it('View 50 sher tokens', async function () {
      await this.sher.transfer(this.buySherSimple.address, parseEther('50'));

      expect(await this.buySherSimple.viewBuyLimit(1)).to.eq(parseEther('50'));
    });
    it('View 100 sher tokens', async function () {
      await this.sher.transfer(this.buySherSimple.address, parseEther('50'));

      expect(await this.buySherSimple.viewBuyLimit(1)).to.eq(parseEther('100'));
    });
    it('View 150 sher tokens', async function () {
      await this.sher.transfer(this.buySherSimple.address, parseEther('50'));

      expect(await this.buySherSimple.viewBuyLimit(1)).to.eq(parseEther('100'));
    });
  });
  describe('viewBuyLimit() - Complex', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Non existent position', async function () {
      await expect(this.buySherComplex.viewBuyLimit(0)).to.be.revertedWith('NonExistent()');
      await expect(this.buySherComplex.viewBuyLimit(2)).to.be.revertedWith('NonExistent()');
    });
    it('View non sher tokens', async function () {
      expect(await this.buySherComplex.viewBuyLimit(1)).to.eq(0);
    });
    it('View 50 sher tokens', async function () {
      await this.sher.transfer(this.buySherComplex.address, parseEther('5'));

      expect(await this.buySherComplex.viewBuyLimit(1)).to.eq(parseEther('5'));
    });
    it('View 100 sher tokens', async function () {
      await this.sher.transfer(this.buySherComplex.address, parseEther('5'));

      expect(await this.buySherComplex.viewBuyLimit(1)).to.eq(parseEther('10'));
    });
    it('View 150 sher tokens', async function () {
      await this.sher.transfer(this.buySherComplex.address, parseEther('5'));

      expect(await this.buySherComplex.viewBuyLimit(1)).to.eq(parseEther('10'));
    });
  });
  describe('viewCosts() - Simple', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('View 0 SHER token', async function () {
      expect(await this.buySherSimple.viewCosts(parseEther('0'))).to.eq(parseUnits('0', 6));
    });
    it('View 1 SHER token', async function () {
      expect(await this.buySherSimple.viewCosts(parseEther('1'))).to.eq(parseUnits('1', 6));
    });
    it('View 0.1 SHER token', async function () {
      expect(await this.buySherSimple.viewCosts(parseEther('0.1'))).to.eq(parseUnits('0.1', 6));
    });
    it('View 100 SHER token', async function () {
      expect(await this.buySherSimple.viewCosts(parseEther('100'))).to.eq(parseUnits('100', 6));
    });
  });
  describe('viewCosts() - Complex', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('View 0 SHER token', async function () {
      expect(await this.buySherComplex.viewCosts(parseEther('0'))).to.eq(parseUnits('0', 6));
    });
    it('View 1 SHER token', async function () {
      expect(await this.buySherComplex.viewCosts(parseEther('1'))).to.eq(parseUnits('2', 6));
    });
    it('View 0.1 SHER token', async function () {
      expect(await this.buySherComplex.viewCosts(parseEther('0.1'))).to.eq(parseUnits('0.2', 6));
    });
    it('View 100 SHER token', async function () {
      expect(await this.buySherComplex.viewCosts(parseEther('100'))).to.eq(parseUnits('200', 6));
    });
  });
  describe('buy() - Simple', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sher.transfer(this.buySherSimple.address, parseEther('1000'));
      await this.token.transfer(this.bob.address, maxTokens.div(2));
      await this.token.connect(this.bob).approve(this.buySherSimple.address, maxTokens);
    });
    it('Zero position', async function () {
      await expect(this.buySherSimple.buy(0, parseEther('1'))).to.be.revertedWith('ZeroArgument()');
      await expect(this.buySherSimple.buy(1, 0)).to.be.revertedWith('ZeroArgument()');
    });
    it('Non existent positon', async function () {
      await expect(this.buySherSimple.buy(2, parseEther('1'))).to.be.revertedWith(
        'ERC721: owner query for nonexistent token',
      );
    });
    it('Non owner of position', async function () {
      await expect(
        this.buySherSimple.connect(this.alice).buy(1, parseEther('1')),
      ).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid amount', async function () {
      await expect(
        this.buySherSimple.connect(this.bob).buy(1, parseEther('101')),
      ).to.be.revertedWith('InvalidAmount()');
    });
    it('Initial state', async function () {
      // carol == receiver of USDC

      expect(await this.token.balanceOf(this.bob.address)).to.eq(maxTokens.div(2));
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.buySherSimple.address)).to.eq(0);

      expect(await this.sher.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.buySherSimple.address)).to.eq(parseEther('1000'));
    });
    it('Full amount', async function () {
      this.usdcAmount = parseUnits('100', 6);
      this.sherAmount = parseEther('100');

      this.t0 = await meta(this.buySherSimple.connect(this.bob).buy(1, this.sherAmount));
      expect(this.t0.events.length).to.eq(4);
      expect(this.t0.events[3].event).to.eq('Purchase');
      expect(this.t0.events[3].args.buyer).to.eq(this.bob.address);
      expect(this.t0.events[3].args.paid).to.eq(this.usdcAmount);
      expect(this.t0.events[3].args.received).to.eq(this.sherAmount);

      expect(await this.token.balanceOf(this.bob.address)).to.eq(
        maxTokens.div(2).sub(this.usdcAmount),
      );
      expect(await this.token.balanceOf(this.carol.address)).to.eq(this.usdcAmount);
      expect(await this.token.balanceOf(this.buySherSimple.address)).to.eq(0);

      expect(await this.sher.balanceOf(this.bob.address)).to.eq(this.sherAmount);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.buySherSimple.address)).to.eq(
        parseEther('1000').sub(this.sherAmount),
      );
    });
    it('Buy again', async function () {
      await expect(this.buySherSimple.connect(this.bob).buy(1, parseEther('1'))).to.be.revertedWith(
        'AlreadyUsed()',
      );
    });
  });
  describe('buy() - Complex', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sher.transfer(this.buySherComplex.address, parseEther('1000'));
      await this.token.transfer(this.bob.address, maxTokens.div(2));
      await this.token.connect(this.bob).approve(this.buySherComplex.address, maxTokens);
    });
    it('Initial state', async function () {
      // carol == receiver of USDC

      expect(await this.token.balanceOf(this.bob.address)).to.eq(maxTokens.div(2));
      expect(await this.token.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.token.balanceOf(this.buySherComplex.address)).to.eq(0);

      expect(await this.sher.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.buySherComplex.address)).to.eq(parseEther('1000'));
    });
    it('Buy 80%', async function () {
      this.usdcAmount = parseUnits('16', 6);
      this.sherAmount = parseEther('8');

      this.t0 = await meta(this.buySherComplex.connect(this.bob).buy(1, this.sherAmount));
      expect(this.t0.events.length).to.eq(4);
      expect(this.t0.events[3].event).to.eq('Purchase');
      expect(this.t0.events[3].args.buyer).to.eq(this.bob.address);
      expect(this.t0.events[3].args.paid).to.eq(this.usdcAmount);
      expect(this.t0.events[3].args.received).to.eq(this.sherAmount);

      expect(await this.token.balanceOf(this.bob.address)).to.eq(
        maxTokens.div(2).sub(this.usdcAmount),
      );
      expect(await this.token.balanceOf(this.carol.address)).to.eq(this.usdcAmount);
      expect(await this.token.balanceOf(this.buySherComplex.address)).to.eq(0);

      expect(await this.sher.balanceOf(this.bob.address)).to.eq(this.sherAmount);
      expect(await this.sher.balanceOf(this.carol.address)).to.eq(0);
      expect(await this.sher.balanceOf(this.buySherComplex.address)).to.eq(
        parseEther('1000').sub(this.sherAmount),
      );
    });
    it('Buy again', async function () {
      await expect(
        this.buySherComplex.connect(this.bob).buy(1, parseEther('1')),
      ).to.be.revertedWith('AlreadyUsed()');
    });
  });
});
