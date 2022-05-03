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
const cUSDC = '0x39AA39c021dfbaE8faC545936693aC917d5E7563';

const BLOCK = 14699000;
const TIMESTAMP = 1651503884;
const YEAR = 60 * 60 * 24 * 365;

describe('Compound', () => {
  before(async () => {
    this.timeTraveler = new TimeTraveler(network.provider);
    await this.timeTraveler.fork(BLOCK);

    await this.timeTraveler.request({
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

    await this.timeTraveler.snapshot();
  });

  describe('setupCompleted()', async function () {
    before(async function () {
      await this.timeTraveler.revertSnapshot();
    });

    it('Default', async function () {
      expect(await this.compound.setupCompleted()).to.eq(true);
    });
  });
});
