const { expect } = require('chai');
const { parseEther, parseUnits, hexConcat } = require('ethers/lib/utils');

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

const usdcWhaleAddress = '0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const eUSDC = '0xEb91861f8A4e1C12333F42DCE8fB0Ecdc28dA716';

const BLOCK = 14699000;
const TIMESTAMP = 1651503884;
const YEAR = 60 * 60 * 24 * 365;

describe('Euler', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await timeTraveler.fork(BLOCK);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [usdcWhaleAddress],
    });

    await prepare(this, ['TreeSplitterMockTest', 'EulerStrategy']);

    this.core = this.carol;
    this.usdc = await ethers.getContractAt('ERC20', USDC);
    this.eUSDC = await ethers.getContractAt('ERC20', eUSDC);

    await deploy(this, [['splitter', this.TreeSplitterMockTest, []]]);

    await this.splitter.setCore(this.core.address);
    await this.splitter.setWant(this.usdc.address);

    await deploy(this, [['euler', this.EulerStrategy, [this.splitter.address]]]);

    this.mintUSDC = async (target, amount) => {
      const usdcWhale = await ethers.provider.getSigner(usdcWhaleAddress);
      await this.usdc.connect(usdcWhale).transfer(target, amount);
    };

    await timeTraveler.snapshot();
  });
  describe('setupCompleted()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Default', async function () {
      expect(await this.euler.setupCompleted()).to.eq(true);
    });
  });
  describe('deposit()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.eUSDC.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.euler.balanceOf()).to.eq(0);
    });
    it('Empty deposit', async function () {
      await this.splitter.deposit(this.euler.address);

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.eUSDC.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.euler.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.euler.address, parseUnits('100', 6));

      await this.splitter.deposit(this.euler.address);

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.eUSDC.balanceOf(this.euler.address)).to.be.closeTo(
        parseEther('98.75'),
        parseEther('0.1'),
      );
      expect(await this.euler.balanceOf()).to.be.closeTo(parseUnits('100', 6), 1);
    });
    it('Year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.eUSDC.balanceOf(this.euler.address)).to.be.closeTo(
        parseEther('98.75'),
        parseEther('0.1'),
      );
      // ~8.5% yield
      expect(await this.euler.balanceOf()).to.be.closeTo(
        parseUnits('108.5', 6),
        parseUnits('0.1', 6),
      );
    });
    it('200 USDC deposit', async function () {
      await this.mintUSDC(this.euler.address, parseUnits('200', 6));

      await this.splitter.deposit(this.euler.address);

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      // less eUSDC relative to initial deposit because USDC rate grows?
      expect(await this.eUSDC.balanceOf(this.euler.address)).to.be.closeTo(
        parseEther('280.75'),
        parseEther('0.1'),
      );
      expect(await this.euler.balanceOf()).to.be.closeTo(
        parseUnits('308.5', 6),
        parseUnits('0.1', 6),
      );
    });
  });
  describe('withdrawAll()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);

      expect(await this.eUSDC.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.euler.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit + withdraw', async function () {
      // deposit
      await this.mintUSDC(this.euler.address, parseUnits('100', 6));
      await this.splitter.deposit(this.euler.address);

      // withdraw
      this.t0 = await meta(this.euler.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(7);
      expect(this.t0.events[6].event).to.eq('AdminWithdraw');
      expect(this.t0.events[6].args.amount).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('100', 6), 1);

      expect(await this.eUSDC.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.euler.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit + 1y', async function () {
      // deposit
      await this.mintUSDC(this.euler.address, parseUnits('100', 6));
      await this.splitter.deposit(this.euler.address);

      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);
    });
    it('Withdraw', async function () {
      // withdraw
      this.t0 = await meta(this.euler.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(7);
      expect(this.t0.events[6].event).to.eq('AdminWithdraw');
      expect(this.t0.events[6].args.amount).to.be.closeTo(
        parseUnits('108.5', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(
        parseUnits('208.5', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.eUSDC.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.euler.balanceOf()).to.eq(0);
    });
    it('Withdraw again', async function () {
      // withdraw
      this.t0 = await meta(this.euler.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('AdminWithdraw');
      expect(this.t0.events[0].args.amount).to.eq(0);

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(
        parseUnits('208.5', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.eUSDC.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.euler.balanceOf()).to.eq(0);
    });
  });
  describe('withdraw()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);

      expect(await this.eUSDC.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.euler.balanceOf()).to.eq(0);
    });
    it('Invalid arg', async function () {
      await expect(
        this.splitter.withdraw(this.euler.address, constants.MaxUint256),
      ).to.be.revertedWith('InvalidArg()');
    });
    it('100 USDC deposit + 20 USDC withdraw', async function () {
      // deposit
      await this.mintUSDC(this.euler.address, parseUnits('100', 6));
      await this.splitter.deposit(this.euler.address);

      // withdraw
      await this.splitter.withdraw(this.euler.address, parseUnits('20', 6));

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('20', 6), 1);

      expect(await this.euler.balanceOf()).to.be.closeTo(parseUnits('80', 6), 1);
    });
    it('20 USDC deposit + 1y', async function () {
      // deposit
      await this.mintUSDC(this.euler.address, parseUnits('20', 6));
      await this.splitter.deposit(this.euler.address);

      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);
    });
    it('Withdraw 80 USDC', async function () {
      // withdraw
      await this.splitter.withdraw(this.euler.address, parseUnits('80', 6));

      expect(await this.usdc.balanceOf(this.euler.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('100', 6), 1);

      expect(await this.euler.balanceOf()).to.be.closeTo(
        parseUnits('28.5', 6),
        parseUnits('0.1', 6),
      );
    });
    it('Withdraw too much', async function () {
      // withdraw
      await expect(
        this.splitter.withdraw(this.euler.address, parseUnits('80', 6)),
      ).to.be.revertedWith('e/insufficient-balance');
    });
    it('Withdraw max', async function () {
      // withdraw
      await expect(
        this.splitter.withdraw(this.euler.address, constants.MaxUint256),
      ).to.be.revertedWith('InvalidArg()');
    });
  });
});
