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

const tfUSDC = '0xA991356d261fbaF194463aF6DF8f0464F8f1c742';
const tfFarm = '0xec6c3FD795D6e6f202825Ddb56E01b3c128b0b10';
const trueFiToken = '0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784';
const usdcWhaleAddress = '0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const BLOCK = 14699000;
const TIMESTAMP = 1651503884;
const YEAR = 60 * 60 * 24 * 365;
const day90 = 60 * 60 * 24 * 90;
const day45 = 60 * 60 * 24 * 45;
const day10 = 60 * 60 * 24 * 10;
const day2 = 60 * 60 * 24 * 2;

describe.only('TrueFi', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await timeTraveler.fork(BLOCK);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [usdcWhaleAddress],
    });

    await prepare(this, ['TreeSplitterMockTest', 'TrueFiStrategy']);

    this.core = this.carol;
    this.usdc = await ethers.getContractAt('ERC20', USDC);
    this.tfUSDC = await ethers.getContractAt('ITrueFiPool2', tfUSDC);
    this.tfFarm = await ethers.getContractAt('ITrueMultiFarm', tfFarm);
    this.trueFiToken = await ethers.getContractAt('ERC20', trueFiToken);

    await deploy(this, [['splitter', this.TreeSplitterMockTest, []]]);

    await this.splitter.setCore(this.core.address);
    await this.splitter.setWant(this.usdc.address);

    await deploy(this, [['truefi', this.TrueFiStrategy, [this.splitter.address]]]);

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
      expect(await this.truefi.setupCompleted()).to.eq(true);
      expect(await this.truefi.balanceOf()).to.eq(0);
    });
  });
  describe('deposit()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.truefi.balanceOf()).to.eq(0);
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.eq(0);
    });
    it('Empty deposit', async function () {
      await this.splitter.deposit(this.truefi.address);

      expect(await this.truefi.balanceOf()).to.eq(0);
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.eq(0);
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.truefi.address, parseUnits('100', 6));

      this.t0 = await meta(this.splitter.deposit(this.truefi.address));

      // Taking into account exit fee
      expect(await this.truefi.balanceOf()).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      // Taking into account USDC to tfUSDC exchange rate
      // https://github.com/trusttoken/contracts-pre22/blob/main/contracts/truefi2/TrueFiPool2.sol#L730
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('95', 6),
        parseUnits('0.5', 6),
      );
      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
    });
    it('Year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);

      // Looks like ~0.8% yield? (even though their website says ~8%)
      // Pools value depends on a lot of external factors https://github.com/trusttoken/contracts-pre22/blob/main/contracts/truefi2/TrueFiPool2.sol#L389
      // Maybe time isn't the only factor that increases APY
      expect(await this.truefi.balanceOf()).to.be.closeTo(
        parseUnits('100.8', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      // Staked tokens don't change
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('95', 6),
        parseUnits('0.5', 6),
      );
      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('24.55', 8), //24.53220944 TrueFi tokens
        parseUnits('0.1', 8),
      );
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
    });
    it('200 USDC deposit', async function () {
      await this.mintUSDC(this.truefi.address, parseUnits('200', 6));

      this.t0 = await meta(this.splitter.deposit(this.truefi.address));

      expect(await this.truefi.balanceOf()).to.be.closeTo(
        parseUnits('300.8', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);

      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('284', 6), // almost 3 times 95
        parseUnits('0.5', 6),
      );
      // on staking the TrueFi tokens are send to the contract
      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.be.closeTo(
        parseUnits('24.55', 8), //24.53220944 TrueFi tokens
        parseUnits('0.1', 8),
      );
    });
  });
  describe('liquidExit()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Now owner', async function () {
      await expect(this.truefi.connect(this.bob).liquidExit(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Zero arg', async function () {
      await expect(this.truefi.liquidExit(0)).to.be.revertedWith('ZeroArg()');
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.truefi.address, parseUnits('100', 6));

      this.t0 = await meta(this.splitter.deposit(this.truefi.address));

      expect(await this.truefi.balanceOf()).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      // Taking into account USDC to tfUSDC exchange rate
      // https://github.com/trusttoken/contracts-pre22/blob/main/contracts/truefi2/TrueFiPool2.sol#L730
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('95', 6),
        parseUnits('0.5', 6),
      );
      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
    });
    it('Exit 20 tfUSDC', async function () {
      await this.truefi.liquidExit(parseUnits('20', 6));

      // Stays the same
      expect(await this.truefi.balanceOf()).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.usdc.balanceOf(this.truefi.address)).to.be.closeTo(
        parseUnits('21', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      // Deduct 20
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('75', 6),
        parseUnits('0.5', 6),
      );
      // 1 block truefi rewards
      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(77);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
    });
    it('Exit 20 tfUSDC a year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);

      await this.truefi.liquidExit(parseUnits('20', 6));

      // Add some yield
      expect(await this.truefi.balanceOf()).to.be.closeTo(
        parseUnits('100.6', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.usdc.balanceOf(this.truefi.address)).to.be.closeTo(
        parseUnits('42.1', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      // Deduct 20 again
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('55', 6),
        parseUnits('0.5', 6),
      );
      // 1 block truefi rewards
      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('19.38', 8),
        parseUnits('0.1', 8),
      );
      // Doesn't send the rewards to the contract on exit
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
    });
    it('Exit remaining tfUSDC a year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR + YEAR);

      await this.truefi.liquidExit(constants.MaxUint256);

      // Now new yield
      expect(await this.truefi.balanceOf()).to.be.closeTo(
        parseUnits('100.6', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.usdc.balanceOf(this.truefi.address)).to.be.closeTo(
        parseUnits('100.6', 6),
        parseUnits('0.1', 6),
      );
      expect(await this.tfUSDC.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.tfFarm.staked(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      // 1 block truefi rewards
      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('23.91', 8),
        parseUnits('0.1', 8),
      );
      // Doesn't send the rewards to the contract on exit
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
    });
    it('Exit remaining tfUSDC again (0)', async function () {
      await expect(this.truefi.liquidExit(constants.MaxUint256)).to.be.revertedWith(
        'InvalidState()',
      );
    });
  });
  describe('claimReward()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Now owner', async function () {
      await expect(this.truefi.connect(this.bob).claimReward()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.truefi.address, parseUnits('100', 6));
      await this.splitter.deposit(this.truefi.address);

      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);

      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('24.55', 8), //24.53220944 TrueFi tokens
        parseUnits('0.1', 8),
      );
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.alice.address)).to.eq(0);
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.truefi.address, parseUnits('100', 6));
      await this.splitter.deposit(this.truefi.address);

      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.be.closeTo(
        parseUnits('24.55', 8), //24.53220944 TrueFi tokens
        parseUnits('0.1', 8),
      );
      expect(await this.trueFiToken.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR + YEAR);
      await timeTraveler.mine(1);

      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.be.closeTo(
        parseUnits('15.55', 8),
        parseUnits('0.1', 8),
      );
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.be.closeTo(
        parseUnits('24.55', 8), //24.53220944 TrueFi tokens
        parseUnits('0.1', 8),
      );
      expect(await this.trueFiToken.balanceOf(this.alice.address)).to.eq(0);
    });
    it('Claim', async function () {
      // claiming claimabe() + tokens already in the contract
      await this.truefi.claimReward();

      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.alice.address)).to.be.closeTo(
        parseUnits('40', 8),
        parseUnits('0.1', 8),
      );
    });
    it('Claim again (0)', async function () {
      // claiming claimabe() + tokens already in the contract
      await this.truefi.claimReward();

      expect(await this.tfFarm.claimable(this.tfUSDC.address, this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.trueFiToken.balanceOf(this.alice.address)).to.be.closeTo(
        parseUnits('40', 8),
        parseUnits('0.1', 8),
      );
    });
  });
  describe('withdrawAll()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      // mint
      await this.mintUSDC(this.truefi.address, parseUnits('100', 6));
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(parseUnits('100', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);
    });
    it('withdrawAll', async function () {
      // withdraw
      await this.splitter.withdrawAll(this.truefi.address);
    });
    it('State', async function () {
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(parseUnits('100', 6));
    });
  });
  describe('withdraw()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      // mint
      await this.mintUSDC(this.truefi.address, parseUnits('100', 6));
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(parseUnits('100', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);
    });
    it('withdraw 20', async function () {
      // withdraw
      await this.splitter.withdraw(this.truefi.address, parseUnits('20', 6));

      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(parseUnits('80', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(parseUnits('20', 6));
    });
    it('withdraw 20', async function () {
      // withdraw
      await this.splitter.withdraw(this.truefi.address, parseUnits('20', 6));

      expect(await this.usdc.balanceOf(this.truefi.address)).to.eq(parseUnits('60', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(parseUnits('40', 6));
    });
  });
});
