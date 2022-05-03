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

const usdcWhaleAddress = '0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const cUSDC = '0x39aa39c021dfbae8fac545936693ac917d5e7563';

const BLOCK = 14699000;
const TIMESTAMP = 1651503884;
const YEAR = 60 * 60 * 24 * 365;

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
    this.cUSDC = await ethers.getContractAt('ERC20', cUSDC);

    await deploy(this, [['splitter', this.TreeSplitterMockTest, []]]);

    await this.splitter.setCore(this.core.address);
    await this.splitter.setWant(this.usdc.address);

    await deploy(this, [['compound', this.CompoundStrategy, [this.splitter.address]]]);

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
  });
});
