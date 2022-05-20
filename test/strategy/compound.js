const { expect } = require('chai');
const { parseEther, parseUnits, hexConcat, formatUnits } = require('ethers/lib/utils');

const {
  prepare,
  deploy,
  solution,
  timestamp,
  Uint16Max,
  meta,
  fork,
  unfork,
} = require('../utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('../utilities/snapshot');
const { id, formatBytes32String, keccak256 } = require('ethers/lib/utils');
const { deployMockContract } = require('ethereum-waffle');

const usdcWhaleAddress = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const cUSDC = '0x39aa39c021dfbae8fac545936693ac917d5e7563';
const COMP = '0xc00e94Cb662C3520282E6f5717214004A7f26888';
const COMPTROLLER = '0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B';

const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';

const BLOCK = 13699000;
const TIMESTAMP = 1638052444;
const YEAR = 60 * 60 * 24 * 365;
const YEAR_IN_BLOCKS = 6400 * 365;

describe('Compound', function () {
  const timeTraveler = new TimeTraveler(network.provider);

  before(async function () {
    await timeTraveler.fork(BLOCK);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [usdcWhaleAddress],
    });

    await prepare(this, ['TreeSplitterMockTest', 'CompoundStrategy']);

    this.core = this.carol;
    this.usdc = await ethers.getContractAt('ERC20', USDC);
    this.cUSDC = await ethers.getContractAt('ICToken', cUSDC);
    this.COMP = await ethers.getContractAt('ERC20', COMP);
    this.COMPTROLLER = await ethers.getContractAt('IComptroller', COMPTROLLER);

    await deploy(this, [['splitter', this.TreeSplitterMockTest, []]]);

    await this.splitter.setCore(this.core.address);
    await this.splitter.setWant(this.usdc.address);

    await deploy(this, [['compound', this.CompoundStrategy, [this.splitter.address]]]);

    this.mintUSDC = async (target, amount) => {
      const usdcWhale = await ethers.provider.getSigner(usdcWhaleAddress);
      await this.usdc.connect(usdcWhale).transfer(target, amount);
    };

    this.makeDeposit = async (signer, amount) => {
      await this.mintUSDC(signer.address, amount);
      await this.usdc.connect(signer).approve(this.cUSDC.address, amount);
      await this.cUSDC.connect(signer).mint(amount);
    };

    await timeTraveler.snapshot();
  });
  describe('setupCompleted()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Default', async function () {
      expect(await this.compound.setupCompleted()).to.eq(true);
    });
  });
  describe('deposit()', async function () {
    before(async function () {
      timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.cUSDC.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.compound.balanceOf()).to.eq(0);
    });
    it('Empty deposit', async function () {
      await this.splitter.deposit(this.compound.address);

      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.cUSDC.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.compound.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.compound.address, parseUnits('100', 6));

      await this.splitter.deposit(this.compound.address);

      expect(await this.usdc.balanceOf(this.compound.address)).to.be.eq(0);
      expect(await this.compound.balanceOf()).to.be.closeTo(parseUnits('100', 6), 1);
    });
    it('Year later', async function () {
      await timeTraveler.hardhatMine(YEAR_IN_BLOCKS);

      // Advancing blocks isn't enough to make the exchage rate vary,
      // we also need to 'ping the system'
      await this.makeDeposit(this.alice, parseUnits('1', 6));

      // ~2.7%  APY
      expect(await this.compound.balanceOf()).to.be.closeTo(
        parseUnits('102.7', 6),
        parseUnits('0.1', 6),
      );
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.compound.address, parseUnits('100', 6));

      await this.splitter.deposit(this.compound.address);

      expect(await this.usdc.balanceOf(this.compound.address)).to.be.eq(0);
      expect(await this.compound.balanceOf()).to.be.closeTo(
        parseUnits('202.7', 6),
        parseUnits('0.1', 6),
      );
    });
  });
  describe('withdrawAll()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);

      expect(await this.cUSDC.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.compound.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit + withdraw', async function () {
      // deposit
      await this.mintUSDC(this.compound.address, parseUnits('100', 6));
      await this.splitter.deposit(this.compound.address);

      // withdraw
      this.t0 = await meta(this.compound.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(7);
      expect(this.t0.events[6].event).to.eq('AdminWithdraw');
      expect(this.t0.events[6].args.amount).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('100', 6), 1);

      expect(await this.cUSDC.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.compound.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit + 1y + withdraw', async function () {
      // deposit
      await this.mintUSDC(this.compound.address, parseUnits('100', 6));
      await this.splitter.deposit(this.compound.address);

      await timeTraveler.hardhatMine(YEAR_IN_BLOCKS);
      await this.makeDeposit(this.alice, parseUnits('1', 6));

      this.t0 = await meta(this.compound.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(7);
      expect(this.t0.events[6].event).to.eq('AdminWithdraw');
      expect(this.t0.events[6].args.amount).to.be.closeTo(
        parseUnits('102.7', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(
        parseUnits('202.7', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.cUSDC.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.compound.balanceOf()).to.eq(0);
    });
    it('Withdraw again', async function () {
      this.t0 = await meta(this.compound.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('AdminWithdraw');
      expect(this.t0.events[0].args.amount).to.eq(0);
    });
  });
  describe('withdraw()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);

      expect(await this.cUSDC.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.compound.balanceOf()).to.eq(0);
    });
    it('Invalid arg', async function () {
      await expect(this.splitter.withdraw(this.compound.address, 0)).to.be.revertedWith(
        'ZeroArg()',
      );
    });
    it('100 USDC deposit + 20 USDC withdraw', async function () {
      // deposit
      await this.mintUSDC(this.compound.address, parseUnits('100', 6));
      await this.splitter.deposit(this.compound.address);

      // withdraw
      await this.splitter.withdraw(this.compound.address, parseUnits('20', 6));

      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('20', 6), 1);

      expect(await this.compound.balanceOf()).to.be.closeTo(parseUnits('80', 6), 1);
    });
    it('20 USDC deposit + 1y', async function () {
      // deposit
      await this.mintUSDC(this.compound.address, parseUnits('20', 6));
      await this.splitter.deposit(this.compound.address);

      await timeTraveler.hardhatMine(YEAR_IN_BLOCKS);

      await this.makeDeposit(this.alice, parseUnits('1', 6));
    });
    it('Withdraw 80 USDC', async function () {
      // withdraw
      await this.splitter.withdraw(this.compound.address, parseUnits('80', 6));

      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('100', 6), 1);

      expect(await this.compound.balanceOf()).to.be.closeTo(
        parseUnits('22.7', 6),
        parseUnits('0.1', 6),
      );
    });
    it('Withdraw too much', async function () {
      // withdraw
      await expect(
        this.splitter.withdraw(this.compound.address, parseUnits('80', 6)),
      ).to.be.revertedWith('InvalidState()');
    });
    it('Withdraw max', async function () {
      // withdraw
      await expect(
        this.splitter.withdraw(this.compound.address, constants.MaxUint256),
      ).to.be.revertedWith('InvalidState()');
    });
  });
  describe('claimReward()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      // mint 1m USDC
      await this.mintUSDC(this.compound.address, parseUnits('1000000', 6));
    });
    it('Initial state', async function () {
      expect(await this.COMP.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.COMP.balanceOf(MULTISIG)).to.eq(0);
    });
    it('Claim', async function () {
      await this.splitter.deposit(this.compound.address);
      await timeTraveler.hardhatMine(YEAR_IN_BLOCKS);

      await this.compound.claimReward();

      expect(await this.COMP.balanceOf(this.compound.address)).to.eq(0);
      // = 3800$ = 0.38% APY
      expect(await this.COMP.balanceOf(MULTISIG)).to.be.closeTo(
        parseUnits('38.8', 18),
        parseUnits('0.1', 18),
      );
    });
    it('Claim again', async function () {
      await this.compound.claimReward();

      expect(await this.COMP.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.COMP.balanceOf(MULTISIG)).to.be.closeTo(
        parseUnits('38.8', 18),
        parseUnits('0.1', 18),
      );
    });
  });
});
