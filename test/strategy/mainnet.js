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
// npx hardhat node --fork mainnet --fork-block-number 15056000
// npx hardhat run --network local scripts/6_strat.deploy.js
// npx hardhat --network local test
const masterStrategy = '0xee4b70AE96fFC70563f70964ebDD8635033Bc6b4';
const aave = '0xE3C37e951F1404b162DFA71A13F0c99c9798Db82';
const comp = '0x8AEA96da625791103a29a16C06c5cfC8B25f6832';
const euler = '0x9a902e8Aae5f1aB423c7aFB29C0Af50e0d3Fea7e';

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
      parseUnits('20224000', 6), // 20.24m
      parseUnits('10000', 6),
    );
    expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
      parseUnits('59000', 6), // 59k
      parseUnits('5000', 6),
    );

    await this.sherlock.connect(owner).updateYieldStrategy(this.strategy.address);

    expect(await this.sherlock.totalTokenBalanceStakers()).to.be.closeTo(
      parseUnits('20224000', 6), // 20.24m
      parseUnits('10000', 6),
    );
    // All usdc withdrawn
    expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
      parseUnits('20134000', 6), // 20.13m - premiums
      parseUnits('10000', 6),
    );
  });
  it('Deposit', async function () {
    // deposit 20 million USDC
    await this.sherlock.connect(owner).yieldStrategyDeposit(MILLIE.mul(20));

    expect(await this.sherlock.totalTokenBalanceStakers()).to.be.closeTo(
      parseUnits('20224000', 6),
      parseUnits('10000', 6),
    );
    expect(await this.usdc.balanceOf(this.sherlock.address)).to.be.closeTo(
      parseUnits('225000', 6), // 225k (it claimPremiumsForStakers)
      parseUnits('10000', 6),
    );
  });
  it('Verify balances', async function () {
    expect(await this.aave.balanceOf()).to.be.closeTo(
      parseUnits('9000000', 6), // 9m
      parseUnits('10000', 6),
    );

    expect(await this.comp.balanceOf()).to.be.closeTo(
      parseUnits('9000000', 6), // 9m
      parseUnits('10000', 6),
    );

    expect(await this.euler.balanceOf()).to.be.closeTo(
      parseUnits('2000000', 6), // 2m
      parseUnits('10000', 6),
    );
  });
});
