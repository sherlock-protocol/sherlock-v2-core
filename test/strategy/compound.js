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
      params: [usdcWhaleAddress]
    });

    await prepare(this, ['TreeSplitterMockTest', 'CompoundStrategy']);

    this.core = this.carol;
    this.usdc = await ethers.getContractAt('ERC20', USDC);
    this.cUSDC = await ethers.getContractAt('ICToken', cUSDC);

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

    it('100 USDC deposit', async function() {
      await this.mintUSDC(this.compound.address, parseUnits('100', 6));

      await this.splitter.deposit(this.compound.address);

      expect(await this.usdc.balanceOf(this.compound.address)).to.be.eq(0);
      expect(await this.compound.balanceOf()).to.be.closeTo(parseUnits('100', 6), 1);
    });

    it('Year later', async function () {
      await timeTraveler.hardhatMine(YEAR_IN_BLOCKS);

      // Advancing blocks isn't enough to make the exchage rate vary,
      // we also need to make some deposits/borrows.
      await this.makeDeposit(this.alice, parseUnits('1000000000', 6));
      await this.makeDeposit(this.bob, parseUnits('5000000', 6));

      // ~2.7%  APY
      expect(await this.compound.balanceOf()).to.be.closeTo(parseUnits('102.7', 6), parseUnits('0.1', 6));
    })
  });

  describe('withdrawAll()', async function() {
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
      await this.splitter.withdrawAll(this.compound.address);

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
      await this.makeDeposit(this.alice, parseUnits('1000000000', 6));
      await this.makeDeposit(this.bob, parseUnits('5000000', 6));

      await this.splitter.withdrawAll(this.compound.address);

      expect(await this.usdc.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(
        parseUnits('202.7', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.cUSDC.balanceOf(this.compound.address)).to.eq(0);
      expect(await this.compound.balanceOf()).to.eq(0);
    });
  });
});
