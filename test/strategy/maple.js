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

const mapleMaven11Rewards = '0x7C57bF654Bc16B0C9080F4F75FF62876f50B8259';
const mapleMaven11 = '0x6F6c8013f639979C84b756C7FC1500eB5aF18Dc4';

const mapleOrthoRewards = '0x7869D7a3B074b5fa484dc04798E254c9C06A5e90';
const mapleOrtho = '0xFeBd6F15Df3B73DC4307B1d7E65D46413e710C27';

const usdcWhaleAddress = '0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const mapleToken = '0x33349b282065b0284d756f0577fb39c158f935e6';

const MULTISIG = '0x666B8EbFbF4D5f0CE56962a25635CfF563F13161';

const BLOCK = 14699000;
const TIMESTAMP = 1651503884;
const YEAR = 60 * 60 * 24 * 365;
const hundredOfAYEAR = (60 * 60 * 24 * 365) / 100;
const day90 = 60 * 60 * 24 * 90;
const day45 = 60 * 60 * 24 * 45;
const day10 = 60 * 60 * 24 * 10;
const day2 = 60 * 60 * 24 * 2;

describe('Maple', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    await timeTraveler.fork(BLOCK);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [usdcWhaleAddress],
    });

    await prepare(this, ['TreeSplitterMockTest', 'MapleStrategy']);

    this.core = this.carol;
    this.usdc = await ethers.getContractAt('ERC20', USDC);
    this.mapleMaven11 = await ethers.getContractAt('IPool', mapleMaven11);
    this.mapleOrtho = await ethers.getContractAt('IPool', mapleOrtho);
    this.mapleMaven11Rewards = await ethers.getContractAt('IMplRewards', mapleMaven11Rewards);
    this.mapleOrthoRewards = await ethers.getContractAt('IMplRewards', mapleOrthoRewards);
    this.mapleToken = await ethers.getContractAt('ERC20', mapleToken);

    await deploy(this, [['splitter', this.TreeSplitterMockTest, []]]);

    await this.splitter.setCore(this.core.address);
    await this.splitter.setWant(this.usdc.address);

    await deploy(this, [
      ['maple', this.MapleStrategy, [this.splitter.address, this.mapleMaven11Rewards.address]],
    ]);

    await deploy(this, [
      ['maple2', this.MapleStrategy, [this.splitter.address, this.mapleOrthoRewards.address]],
    ]);

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
      expect(await this.maple.setupCompleted()).to.eq(true);
      expect(await this.maple.maturityTime()).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
      expect(await this.maple.maplePool()).to.eq(mapleMaven11);
      expect(await this.maple.mapleRewards()).to.eq(mapleMaven11Rewards);
    });
  });
  describe('deposit()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.eq(0);
    });
    it('Empty deposit', async function () {
      await this.splitter.deposit(this.maple.address);

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.eq(0);
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));

      this.t0 = await meta(this.splitter.deposit(this.maple.address));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('100'),
        1,
      );
      expect(await this.maple.balanceOf()).to.be.closeTo(parseUnits('100', 6), 1);
      expect(await this.maple.maturityTime()).to.eq(this.t0.time.add(day90));
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('100'),
        1,
      );
    });
    it('Year later', async function () {
      await timeTraveler.setNextBlockTimestamp(TIMESTAMP + YEAR);
      await timeTraveler.mine(1);

      // No changes
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('100'),
        1,
      );
      expect(await this.maple.balanceOf()).to.be.closeTo(parseUnits('100', 6), 1);
      expect(await this.maple.maturityTime()).to.eq(this.t0.time.add(day90));
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('100'),
        1,
      );
    });
  });
  describe('deposit(), test weighted maturity', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.eq(0);
    });
    it('Empty deposit', async function () {
      await this.splitter.deposit(this.maple.address);

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.eq(0);
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));

      this.t0 = await meta(this.splitter.deposit(this.maple.address));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('100'),
        1,
      );
      expect(await this.maple.balanceOf()).to.be.closeTo(parseUnits('100', 6), 1);
      expect(await this.maple.maturityTime()).to.eq(this.t0.time.add(day90));
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('100'),
        1,
      );
    });
    it('45 days later 100 USDC deposit', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time.add(day45)));

      this.t1 = await meta(this.splitter.deposit(this.maple.address));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('200'),
        1,
      );
      expect(await this.maple.balanceOf()).to.be.closeTo(parseUnits('200', 6), 1);
      // "normal" would be t1.time + 90 days
      // But because we are already in the pool for 45 days (with same amount)
      // It will discount 50% of those days (- 45/2)
      expect(await this.maple.maturityTime()).to.eq(this.t1.time.add(day90 - day45 / 2));
      expect(await this.mapleMaven11Rewards.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('200'),
        1,
      );
    });
  });
  describe('deposit(), test weighted maturity again', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
    });
    it('Empty deposit', async function () {
      await this.splitter.deposit(this.maple.address);

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));

      this.t0 = await meta(this.splitter.deposit(this.maple.address));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('100'),
        1,
      );
      expect(await this.maple.balanceOf()).to.be.closeTo(parseUnits('100', 6), 1);
      expect(await this.maple.maturityTime()).to.eq(this.t0.time.add(day90));
    });
    it('45 days later 200 USDC deposit', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('200', 6));
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time.add(day45)));

      this.t1 = await meta(this.splitter.deposit(this.maple.address));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.be.closeTo(
        parseEther('300'),
        1,
      );
      expect(await this.maple.balanceOf()).to.be.closeTo(parseUnits('300', 6), 1);
      // "normal" would be t1.time + 90 days
      // But because we are already in the pool for 45 days (with 50% of the amount)
      // It will discount 33% of those days (- 45/3)
      // as it does 100/300 on this line
      // https://github.com/maple-labs/maple-core/blob/main/contracts/library/PoolLib.sol#L215

      expect(await this.maple.maturityTime()).to.eq(this.t1.time.add(day90 - day45 / 3));
    });
  });
  describe('intendToWithdraw()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.mapleMaven11.withdrawCooldown(this.maple.address)).to.eq(0);
    });
    it('Now owner', async function () {
      await expect(this.maple.connect(this.bob).intendToWithdraw()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do fail', async function () {
      await expect(this.maple.intendToWithdraw()).to.be.revertedWith('P:ZERO_BAL');
    });
    it('Do success', async function () {
      // deposit first
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));
      await this.splitter.deposit(this.maple.address);

      this.t0 = await meta(this.maple.intendToWithdraw());

      expect(await this.mapleMaven11.withdrawCooldown(this.maple.address)).to.eq(this.t0.time);
    });
  });
  describe('withdrawFromMaple()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(0);
    });
    it('Now owner', async function () {
      await expect(
        this.maple.connect(this.bob).withdrawFromMaple(parseUnits('100', 18)),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Do zero', async function () {
      await expect(this.maple.withdrawFromMaple(0)).to.be.revertedWith('ZeroArg()');
    });
    it('Do MAX with current balance = 0', async function () {
      await expect(this.maple.withdrawFromMaple(constants.MaxUint256)).to.be.revertedWith(
        'InvalidState()',
      );
    });
    it('Deposit, start cooldown', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));
      this.t0 = await meta(this.splitter.deposit(this.maple.address));

      // intent withdraw 10 days before lockup ends
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + day90 - day10);
      this.t1 = await meta(this.maple.intendToWithdraw());

      // skip 10 days (total of 90 days since deposit)
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + day90);
    });
    it('Do exceed balance', async function () {
      await expect(this.maple.withdrawFromMaple(parseUnits('1000', 18))).to.be.revertedWith(
        'SafeMath: subtraction overflow',
      );
    });
    it('Do withdraw', async function () {
      // do withdraw
      await this.maple.withdrawFromMaple(parseUnits('100', 18));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(parseUnits('100', 6));
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(parseUnits('100', 6));
    });
  });
  describe('withdrawFromMaple() - MAX', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Deposit, start cooldown, and withdraw', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));
      this.t0 = await meta(this.splitter.deposit(this.maple.address));

      // intent withdraw 10 days before lockup ends
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + day90 - day10);
      this.t1 = await meta(this.maple.intendToWithdraw());

      // skip 10 days (total of 90 days since deposit)
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + day90);
      expect(await this.maple.maturityTime()).to.eq(Number(this.t0.time) + day90);

      // do withdraw
      await this.maple.withdrawFromMaple(constants.MaxUint256);

      expect(await this.maple.maturityTime()).to.eq(Number(this.t0.time) + day90);
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(parseUnits('100', 6));
      expect(await this.mapleMaven11.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.maple.balanceOf()).to.eq(parseUnits('100', 6));
    });
    it('100 USDC deposit', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));

      this.t2 = await meta(this.splitter.deposit(this.maple.address));

      // Make sure maturity time resets
      expect(await this.maple.maturityTime()).to.eq(Number(this.t2.time) + day90);
    });
  });
  describe('withdrawAll()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      // mint
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(parseUnits('100', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);
    });
    it('withdrawAll', async function () {
      // withdraw
      this.t0 = await meta(this.maple.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(2);
      expect(this.t0.events[1].event).to.eq('AdminWithdraw');
      expect(this.t0.events[1].args.amount).to.be.closeTo(
        parseUnits('100', 6),
        parseUnits('0.1', 6),
      );
    });
    it('State', async function () {
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(parseUnits('100', 6));
    });
    it('withdrawAll again', async function () {
      // withdraw
      this.t0 = await meta(this.maple.withdrawAllByAdmin());

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('AdminWithdraw');
      expect(this.t0.events[0].args.amount).to.eq(0);
    });
  });
  describe('withdraw()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      // mint
      await this.mintUSDC(this.maple.address, parseUnits('100', 6));
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(parseUnits('100', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(0);
    });
    it('withdraw 20', async function () {
      // withdraw
      await this.splitter.withdraw(this.maple.address, parseUnits('20', 6));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(parseUnits('80', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(parseUnits('20', 6));
    });
    it('withdraw 20', async function () {
      // withdraw
      await this.splitter.withdraw(this.maple.address, parseUnits('20', 6));

      expect(await this.usdc.balanceOf(this.maple.address)).to.eq(parseUnits('60', 6));
      expect(await this.usdc.balanceOf(this.core.address)).to.eq(parseUnits('40', 6));
    });
    it('Withdraw too much', async function () {
      // withdraw
      await expect(
        this.splitter.withdraw(this.maple.address, parseUnits('80', 6)),
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
    it('Withdraw max', async function () {
      // withdraw
      await expect(
        this.splitter.withdraw(this.maple.address, constants.MaxUint256),
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
  });
  describe('Calc MPL APY for maven11', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      // mint 1m USDC
      await this.mintUSDC(this.maple.address, parseUnits('1000000', 6));
    });
    it('Initial state', async function () {
      expect(await this.mapleToken.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(this.alice.address)).to.eq(0);
      expect(await this.mapleMaven11Rewards.earned(this.maple.address)).to.eq(0);
    });
    it('Deposit +0.01y', async function () {
      // Skipping 0.01y as rewards are distributed per week
      this.t0 = await meta(this.splitter.deposit(this.maple.address));
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + hundredOfAYEAR);
      await timeTraveler.mine(1);

      expect(await this.mapleToken.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(this.alice.address)).to.eq(0);
      // Earning 10.3 maple tokens = ~410 USDC = 41k per year = 4.1% APY
      expect(await this.mapleMaven11Rewards.earned(this.maple.address)).to.be.closeTo(
        parseUnits('10.3', 18),
        parseUnits('0.5', 18),
      );
    });
  });
  describe('Calc MPL APY for ortho', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      // mint 1m USDC
      await this.mintUSDC(this.maple2.address, parseUnits('1000000', 6));
    });
    it('Initial state', async function () {
      expect(await this.mapleToken.balanceOf(this.maple2.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(this.alice.address)).to.eq(0);
      expect(await this.mapleOrthoRewards.earned(this.maple2.address)).to.eq(0);
    });
    it('Deposit +0.01y', async function () {
      // Skipping 0.01y as rewards are distributed per week
      this.t0 = await meta(this.splitter.deposit(this.maple2.address));
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + hundredOfAYEAR);
      await timeTraveler.mine(1);

      expect(await this.mapleToken.balanceOf(this.maple2.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(this.alice.address)).to.eq(0);
      // Earning 8.8 maple tokens = ~350 USDC = 35k per year = 3.5% APY
      expect(await this.mapleOrthoRewards.earned(this.maple2.address)).to.be.closeTo(
        parseUnits('8.8', 18),
        parseUnits('0.5', 18),
      );
    });
  });
  describe('claimReward()', async function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      // mint 1m USDC
      await this.mintUSDC(this.maple.address, parseUnits('1000000', 6));
    });
    it('Initial state', async function () {
      expect(await this.mapleToken.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(MULTISIG)).to.eq(0);
      expect(await this.mapleMaven11Rewards.earned(this.maple.address)).to.eq(0);
    });
    it('Deposit +1y', async function () {
      this.t0 = await meta(this.splitter.deposit(this.maple.address));
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + day2);
      await timeTraveler.mine(1);

      expect(await this.mapleToken.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(MULTISIG)).to.eq(0);
      expect(await this.mapleMaven11Rewards.earned(this.maple.address)).to.be.closeTo(
        parseUnits('5.6', 18),
        parseUnits('0.5', 18),
      );
    });
    it('Deposit +1y', async function () {
      await this.mintUSDC(this.maple.address, parseUnits('1000000', 6));
      this.t0 = await meta(this.splitter.deposit(this.maple.address));
      await timeTraveler.setNextBlockTimestamp(Number(this.t0.time) + day2);
      await timeTraveler.mine(1);

      expect(await this.mapleToken.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(MULTISIG)).to.eq(0);
      expect(await this.mapleMaven11Rewards.earned(this.maple.address)).to.be.closeTo(
        parseUnits('16.9', 18),
        parseUnits('0.5', 18),
      );
    });
    it('Claim', async function () {
      await this.maple.claimReward();

      expect(await this.mapleToken.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(MULTISIG)).to.be.closeTo(
        parseUnits('16.9', 18),
        parseUnits('0.5', 18),
      );
      expect(await this.mapleMaven11Rewards.earned(this.maple.address)).to.eq(0);
    });
    it('Claim again', async function () {
      await this.maple.claimReward();

      expect(await this.mapleToken.balanceOf(this.maple.address)).to.eq(0);
      expect(await this.mapleToken.balanceOf(MULTISIG)).to.be.closeTo(
        parseUnits('16.9', 18),
        parseUnits('0.5', 18),
      );
      expect(await this.mapleMaven11Rewards.earned(this.maple.address)).to.eq(0);
    });
  });
});
