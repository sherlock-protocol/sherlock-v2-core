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

// steps to run
// npx hardhat node --fork mainnet --fork-block-number 14804703
// npx hardhat run --network local scripts/6_strat.deploy.js
// npx hardhat --network local test
const masterStrategy = '0xee4b70AE96fFC70563f70964ebDD8635033Bc6b4';
const aave = '0xE3C37e951F1404b162DFA71A13F0c99c9798Db82';
const comp = '0x8AEA96da625791103a29a16C06c5cfC8B25f6832';
const euler = '0x9a902e8Aae5f1aB423c7aFB29C0Af50e0d3Fea7e';
const truefi = '0x1eC37c35BeE1b8b18fC01740db7750Cf93943254';
const maple = '0xfa01268bd200d0D0f13A6F9758Ba3C09F928E2f7';

// Mainnet addresses
const sherlock = '0x0865a889183039689034dA55c1Fd12aF5083eabF';
const ownerAddress = '0x92AEffFfaD9fff820f7FCaf1563d8467aFe358c4';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const MILLIE = parseUnits('1000000', 6);

// make .only() when running against mainnet fork
describe.skip('Deployment strategy test', function () {
  before(async function () {
    this.core = this.carol;
    this.usdc = await ethers.getContractAt('ERC20', USDC);
    this.strategy = await ethers.getContractAt('MasterStrategy', masterStrategy);
    this.sherlock = await ethers.getContractAt('Sherlock', sherlock);
    this.aave = await ethers.getContractAt('BaseStrategy', aave);
    this.comp = await ethers.getContractAt('BaseStrategy', comp);
    this.euler = await ethers.getContractAt('BaseStrategy', euler);
    this.truefi = await ethers.getContractAt('BaseStrategy', truefi);
    this.maple = await ethers.getContractAt('BaseStrategy', maple);

    this.mintUSDC = async (target, amount) => {
      const usdcWhale = await ethers.provider.getSigner(usdcWhaleAddress);
      await this.usdc.connect(usdcWhale).transfer(target, amount);
    };

    await network.provider.request({
      method: 'hardhat_setBalance',
      params: [ownerAddress, '0x100000000000000000000000000'],
    });
    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [ownerAddress],
    });
    owner = await ethers.provider.getSigner(ownerAddress);
  });
  it('Update', async function () {
    expect(await this.sherlock.totalTokenBalanceStakers()).to.be.closeTo(
      parseUnits('20145000', 6), // 20.1m
      parseUnits('10000', 6),
    );
    expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
      parseUnits('50000', 6), // 50k
      parseUnits('5000', 6),
    );

    await this.sherlock.connect(owner).updateYieldStrategy(this.strategy.address);

    expect(await this.sherlock.totalTokenBalanceStakers()).to.be.closeTo(
      parseUnits('20145000', 6), // 20.1m
      parseUnits('10000', 6),
    );
    // All usdc withdrawn
    expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
      parseUnits('20101900', 6), // 20.145m - premiums
      parseUnits('10000', 6),
    );
  });
  it('Deposit', async function () {
    // deposit 20 million USDC
    await this.sherlock.connect(owner).yieldStrategyDeposit(MILLIE.mul(20));

    expect(await this.sherlock.totalTokenBalanceStakers()).to.be.closeTo(
      parseUnits('20135000', 6), // ~10k less than previous, because of truefi discount factor
      parseUnits('10000', 6),
    );
    expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
      parseUnits('145000', 6), // 145k (it claimPremiumsForStakers)
      parseUnits('10000', 6),
    );
  });
  it('Verify balances', async function () {
    expect(await this.aave.balanceOf()).to.be.closeTo(
      parseUnits('5000000', 6), // 5m
      parseUnits('10000', 6),
    );

    expect(await this.comp.balanceOf()).to.be.closeTo(
      parseUnits('5000000', 6), // 5m
      parseUnits('10000', 6),
    );

    expect(await this.euler.balanceOf()).to.be.closeTo(
      parseUnits('2000000', 6), // 2m
      parseUnits('10000', 6),
    );

    expect(await this.truefi.balanceOf()).to.be.closeTo(
      parseUnits('3988000', 6), // 3.98m (12k less)
      parseUnits('10000', 6),
    );

    expect(await this.maple.balanceOf()).to.be.closeTo(
      parseUnits('4000000', 6), // 4m
      parseUnits('10000', 6),
    );
  });
});
