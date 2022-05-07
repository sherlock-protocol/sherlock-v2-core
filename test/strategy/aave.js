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
const USDC_AMOUNT = parseUnits('100000', 6);

const BLOCK = 14699000;
const TIMESTAMP = 1651503884;
const YEAR = 60 * 60 * 24 * 365;

// Copied from ../Aave2.js
// Made to function with new environment

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const aUSDC = '0xBcca60bB61934080951369a648Fb03DF4F96263C';
const INCENTIVES = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';
const LP_ADDRESS_PROVIDER = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5';
const LP = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
const stkAAVE = '0x4da27a545c0c5b758a6ba100e3a049001de870f5';

describe('Aave', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await timeTraveler.fork(BLOCK);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [usdcWhaleAddress],
    });

    await prepare(this, ['TreeSplitterMockTest', 'AaveStrategy']);

    this.core = this.carol;
    this.usdc = await ethers.getContractAt('ERC20', USDC);
    this.aUSDC = await ethers.getContractAt('ERC20', aUSDC);
    this.stkAAVE = await ethers.getContractAt('ERC20', stkAAVE);
    this.incentives = await ethers.getContractAt('IAaveIncentivesController', INCENTIVES);

    await deploy(this, [['splitter', this.TreeSplitterMockTest, []]]);

    await this.splitter.setCore(this.core.address);
    await this.splitter.setWant(this.usdc.address);

    await deploy(this, [
      ['aave', this.AaveStrategy, [this.splitter.address, aUSDC, this.bob.address]],
    ]);

    this.mintUSDC = async (target, amount) => {
      const usdcWhale = await ethers.provider.getSigner(usdcWhaleAddress);
      await this.usdc.connect(usdcWhale).transfer(target, amount);
    };

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Zero aToken', async function () {
      await expect(
        this.AaveStrategy.deploy(this.splitter.address, this.bob.address, constants.AddressZero),
      ).to.be.revertedWith('ZeroArg()');
    });
    it('Zero lmReceiver', async function () {
      await expect(
        this.AaveStrategy.deploy(this.splitter.address, constants.AddressZero, this.bob.address),
      ).to.be.revertedWith('ZeroArg()');
    });
  });
  it('Constructor state', async function () {
    expect(await this.aave.aWant()).to.eq(this.aUSDC.address);
    expect(await this.aave.want()).to.eq(this.usdc.address);
    expect(await this.aave.aaveIncentivesController()).to.eq(this.incentives.address);
    expect(await this.aave.aaveLmReceiver()).to.eq(this.bob.address);

    expect(await this.aave.LP_ADDRESS_PROVIDER()).to.eq(LP_ADDRESS_PROVIDER);

    expect(await this.usdc.allowance(this.aave.address, LP)).to.eq(0);
  });
  it('Allowance error test', async function () {
    await prepare(this, ['AllowanceErrorTest']);

    await expect(this.AllowanceErrorTest.deploy(this.usdc.address)).to.be.reverted;
  });
  describe('deposit()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aave.balanceOf()).to.eq(0);
    });
    it('Empty deposit', async function () {
      await expect(this.splitter.deposit(this.aave.address)).to.be.revertedWith('InvalidState()');
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.aave.address, parseUnits('100', 6));

      await this.splitter.deposit(this.aave.address);

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aave.address)).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.aave.balanceOf()).to.be.closeTo(parseUnits('100', 6), parseUnits('0.1', 6));
    });
    it('Year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      // 1.8% yield
      expect(await this.aUSDC.balanceOf(this.aave.address)).to.be.closeTo(
        parseUnits('101.8', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.aave.balanceOf()).to.be.closeTo(
        parseUnits('101.8', 6),
        parseUnits('0.1', 6),
      );
    });
    it('200 USDC deposit', async function () {
      await this.mintUSDC(this.aave.address, parseUnits('200', 6));

      await this.splitter.deposit(this.aave.address);

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aUSDC.balanceOf(this.aave.address)).to.be.closeTo(
        parseUnits('301.8', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.aave.balanceOf()).to.be.closeTo(
        parseUnits('301.8', 6),
        parseUnits('0.1', 6),
      );
    });
  });
  describe('withdrawAll()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);

      expect(await this.aUSDC.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aave.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit + withdraw', async function () {
      // deposit
      await this.mintUSDC(this.aave.address, parseUnits('100', 6));
      await this.splitter.deposit(this.aave.address);

      // withdraw
      this.t0 = await meta(this.aave.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(14);
      expect(this.t0.events[13].event).to.eq('AdminWithdraw');
      expect(this.t0.events[13].args.amount).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.aUSDC.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aave.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit + 1y', async function () {
      // deposit
      await this.mintUSDC(this.aave.address, parseUnits('100', 6));
      await this.splitter.deposit(this.aave.address);

      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);
    });
    it('Withdraw', async function () {
      // withdraw
      this.t0 = await meta(this.aave.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(14);
      expect(this.t0.events[13].event).to.eq('AdminWithdraw');
      expect(this.t0.events[13].args.amount).to.be.closeTo(
        parseUnits('101.8', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(
        parseUnits('201.8', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.aUSDC.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aave.balanceOf()).to.eq(0);
    });
    it('Withdraw again', async function () {
      // withdraw
      this.t0 = await meta(this.aave.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('AdminWithdraw');
      expect(this.t0.events[0].args.amount).to.eq(0);

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(
        parseUnits('201.8', 6),
        parseUnits('0.1', 6),
      );

      expect(await this.aUSDC.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aave.balanceOf()).to.eq(0);
    });
  });
  describe('withdraw()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);

      expect(await this.aUSDC.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.aave.balanceOf()).to.eq(0);
    });
    it('Invalid arg', async function () {
      await expect(
        this.splitter.withdraw(this.aave.address, constants.MaxUint256),
      ).to.be.revertedWith('InvalidArg()');
    });
    it('100 USDC deposit + 20 USDC withdraw', async function () {
      // deposit
      await this.mintUSDC(this.aave.address, parseUnits('100', 6));
      await this.splitter.deposit(this.aave.address);

      // withdraw
      await this.splitter.withdraw(this.aave.address, parseUnits('20', 6));

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('20', 6), 1);

      expect(await this.aave.balanceOf()).to.be.closeTo(parseUnits('80', 6), 1);
    });
    it('20 USDC deposit + 1y', async function () {
      // deposit
      await this.mintUSDC(this.aave.address, parseUnits('20', 6));
      await this.splitter.deposit(this.aave.address);

      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);
    });
    it('Withdraw 80 USDC', async function () {
      // withdraw
      await this.splitter.withdraw(this.aave.address, parseUnits('80', 6));

      expect(await this.usdc.balanceOf(this.aave.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.be.closeTo(parseUnits('100', 6), 1);

      expect(await this.aave.balanceOf()).to.be.closeTo(
        parseUnits('21.8', 6),
        parseUnits('0.1', 6),
      );
    });
    it('Withdraw too much', async function () {
      await expect(
        this.splitter.withdraw(this.aave.address, parseUnits('80', 6)),
      ).to.be.revertedWith('5');
    });
    it('Withdraw max', async function () {
      await expect(
        this.splitter.withdraw(this.aave.address, constants.MaxUint256),
      ).to.be.revertedWith('InvalidArg()');
    });
  });
  describe('claimReward()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('10m USDC deposit', async function () {
      await this.mintUSDC(this.aave.address, parseUnits('10000000', 6));

      await this.splitter.deposit(this.aave.address);
    });
    it('t=1, state', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);

      expect(
        await this.incentives.getRewardsBalance([this.aUSDC.address], this.aave.address),
      ).to.be.closeTo(parseEther('10.45'), parseEther('0.1'));
      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.eq(0);
    });
    it('t=2, do', async function () {
      await this.aave.claimReward();

      expect(
        await this.incentives.getRewardsBalance([this.aUSDC.address], this.aave.address),
      ).to.eq(0);

      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.be.closeTo(
        parseEther('10.45'),
        parseEther('0.1'),
      );
    });
    it('t=3, do again', async function () {
      await this.aave.claimReward();

      expect(
        await this.incentives.getRewardsBalance([this.aUSDC.address], this.aave.address),
      ).to.eq(0);

      expect(await this.stkAAVE.balanceOf(this.bob.address)).to.be.closeTo(
        parseEther('10.45'),
        parseEther('0.1'),
      );
    });
  });
});
