const { expect } = require('chai');
const { constants } = require('ethers');
const { parseEther, parseUnits } = require('ethers/lib/utils');
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
const { TimeTraveler } = require('../utilities/snapshot');

const maxTokens = parseUnits('100000000000', 6);
const amount = parseUnits('100', 6);

describe('AlphaBetaSplitter', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'AlphaBetaSplitter',
      'TreeStrategyMockCustom',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.alice
    this.core = this.alice;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['store', this.InfoStorage, [this.erc20.address, this.core.address]]]);
    await deploy(this, [['master', this.MasterStrategy, [this.store.address]]]);

    await deploy(this, [
      [
        'splitter',
        this.AlphaBetaSplitter,
        [this.master.address, constants.AddressZero, constants.AddressZero],
      ],
    ]);

    await deploy(this, [['strategy', this.TreeStrategyMockCustom, []]]);
    await this.strategy.setParent(this.splitter.address);
    await this.strategy.setCore(this.core.address);
    await this.strategy.setWant(this.erc20.address);
    await this.strategy.setSetupCompleted(true);

    await deploy(this, [['strategy2', this.TreeStrategyMockCustom, []]]);
    await this.strategy2.setParent(this.splitter.address);
    await this.strategy2.setCore(this.core.address);
    await this.strategy2.setWant(this.erc20.address);
    await this.strategy2.setSetupCompleted(true);

    await this.splitter.setInitialChildOne(this.strategy.address);
    await this.splitter.setInitialChildTwo(this.strategy2.address);

    await this.master.setInitialChildOne(this.splitter.address);

    await timeTraveler.snapshot();
  });
  describe('Deposit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Do again', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(2));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount);

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
  });
  describe('Withdraw()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(2));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(1);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(1));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(2);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(0));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(3);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(0));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(2));

      expect(await this.strategy.withdrawCalled()).to.eq(3);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(1);
    });
  });
  describe('Withdraw() both test', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do', async function () {
      await this.master.withdraw(amount.mul(4));

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(2));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
      expect(await this.strategy.withdrawAllCalled()).to.eq(1);
      expect(await this.strategy2.withdrawCalled()).to.eq(1);
    });
    it('Do again', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(1));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
      expect(await this.strategy.withdrawAllCalled()).to.eq(1);
      expect(await this.strategy2.withdrawCalled()).to.eq(2);
    });
  });
});

describe('AlphaBetaEqualDepositSplitter', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'AlphaBetaEqualDepositSplitter',
      'TreeStrategyMockCustom',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.alice
    this.core = this.alice;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['store', this.InfoStorage, [this.erc20.address, this.core.address]]]);
    await deploy(this, [['master', this.MasterStrategy, [this.store.address]]]);

    await deploy(this, [
      [
        'splitter',
        this.AlphaBetaEqualDepositSplitter,
        [this.master.address, constants.AddressZero, constants.AddressZero, amount.mul(4)],
      ],
    ]);

    await deploy(this, [['strategy', this.TreeStrategyMockCustom, []]]);
    await this.strategy.setParent(this.splitter.address);
    await this.strategy.setCore(this.core.address);
    await this.strategy.setWant(this.erc20.address);
    await this.strategy.setSetupCompleted(true);

    await deploy(this, [['strategy2', this.TreeStrategyMockCustom, []]]);
    await this.strategy2.setParent(this.splitter.address);
    await this.strategy2.setCore(this.core.address);
    await this.strategy2.setWant(this.erc20.address);
    await this.strategy2.setSetupCompleted(true);

    await this.splitter.setInitialChildOne(this.strategy.address);
    await this.splitter.setInitialChildTwo(this.strategy2.address);

    await this.master.setInitialChildOne(this.splitter.address);

    await timeTraveler.snapshot();
  });
  describe('Withdraw() - Normal', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(2));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(1);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(1));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(2);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
  });
  describe('Deposit() - Normal', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Do again', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(2));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount);

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
  });
  describe('Deposit() - Split', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do - childOne eq', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(6));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Add small extra to childTwo', async function () {
      await this.erc20.transfer(this.strategy2.address, amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(4));

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Do - childOne lt --> split', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(6));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(6));

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Add large extra to childTwo', async function () {
      await this.erc20.transfer(this.strategy2.address, amount.mul(10));

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(6));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(16));

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Do - childOne lt --> single', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(11));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(16));

      expect(await this.strategy.depositCalled()).to.eq(3);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Add small extra to childOne', async function () {
      await this.erc20.transfer(this.strategy.address, amount.mul(6));

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(17));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(16));

      expect(await this.strategy.depositCalled()).to.eq(3);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Do - childTwo lt --> split', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(19));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(19));

      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(3);
    });
    it('Add large extra to childOne', async function () {
      await this.erc20.transfer(this.strategy.address, amount.mul(10));

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(29));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(19));

      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(3);
    });
    it('Do - childTwo lt --> single', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(29));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(24));

      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(4);
    });
  });
});

describe('AlphaBetaEqualDepositMaxSplitter - childTwoMax', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'AlphaBetaEqualDepositMaxSplitter',
      'TreeStrategyMockCustom',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.alice
    this.core = this.alice;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['store', this.InfoStorage, [this.erc20.address, this.core.address]]]);
    await deploy(this, [['master', this.MasterStrategy, [this.store.address]]]);

    await deploy(this, [
      [
        'splitter',
        this.AlphaBetaEqualDepositMaxSplitter,
        [
          this.master.address,
          constants.AddressZero,
          constants.AddressZero,
          amount.mul(4),
          constants.MaxUint256,
          amount.mul(50),
        ],
      ],
    ]);

    await deploy(this, [['strategy', this.TreeStrategyMockCustom, []]]);
    await this.strategy.setParent(this.splitter.address);
    await this.strategy.setCore(this.core.address);
    await this.strategy.setWant(this.erc20.address);
    await this.strategy.setSetupCompleted(true);

    await deploy(this, [['strategy2', this.TreeStrategyMockCustom, []]]);
    await this.strategy2.setParent(this.splitter.address);
    await this.strategy2.setCore(this.core.address);
    await this.strategy2.setWant(this.erc20.address);
    await this.strategy2.setSetupCompleted(true);

    await this.splitter.setInitialChildOne(this.strategy.address);
    await this.splitter.setInitialChildTwo(this.strategy2.address);

    await this.master.setInitialChildOne(this.splitter.address);

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Both non zero', async function () {
      await expect(
        this.AlphaBetaEqualDepositMaxSplitter.deploy(
          this.master.address,
          constants.AddressZero,
          constants.AddressZero,
          amount.mul(4),
          amount.mul(50),
          amount.mul(50),
        ),
      ).to.be.revertedWith('InvalidArg()');
    });
    it('Both zero', async function () {
      await expect(
        this.AlphaBetaEqualDepositMaxSplitter.deploy(
          this.master.address,
          constants.AddressZero,
          constants.AddressZero,
          amount.mul(4),
          0,
          0,
        ),
      ).to.be.revertedWith('InvalidArg()');
    });
  });
  describe('Withdraw() - Normal', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(0);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(2));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(1);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.master.withdraw(amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(1));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.withdrawCalled()).to.eq(2);
      expect(await this.strategy.withdrawAllCalled()).to.eq(0);
      expect(await this.strategy2.withdrawCalled()).to.eq(0);
    });
  });
  describe('Deposit() - Normal', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do again', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount);

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Do again', async function () {
      await this.erc20.transfer(this.master.address, amount);
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(2));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount);

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
  });
  describe('Deposit() - Split', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(0);

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Do - childOne eq', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(6));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(3));

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Add small extra to childTwo', async function () {
      await this.erc20.transfer(this.strategy2.address, amount);

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(3));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(4));

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Do - childOne lt --> split', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(6));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(6));

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Add large extra to childTwo', async function () {
      await this.erc20.transfer(this.strategy2.address, amount.mul(10));

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(6));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(16));

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Do - childOne lt --> single', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(11));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(16));

      expect(await this.strategy.depositCalled()).to.eq(3);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Add small extra to childOne', async function () {
      await this.erc20.transfer(this.strategy.address, amount.mul(6));

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(17));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(16));

      expect(await this.strategy.depositCalled()).to.eq(3);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Do - childTwo lt --> split', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(19));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(19));

      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(3);
    });
    it('Add large extra to childOne', async function () {
      await this.erc20.transfer(this.strategy.address, amount.mul(10));

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(29));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(19));

      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(3);
    });
    it('Do - childTwo lt --> single', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(5));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(29));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(24));

      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(4);
    });
  });
  describe('Deposit() - Max ChildTwo - Non-Split', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.strategy.address, amount.mul(100));
      await this.erc20.transfer(this.strategy2.address, amount.mul(46));
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(46));

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Deposit non-split amount get close to max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(49));

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Deposit non-split amount but exceed max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(102));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(50));

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Deposit non-split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(105));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(50));

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
  });
  describe('Deposit() - Max ChildTwo - Split', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.strategy.address, amount.mul(100));
      await this.erc20.transfer(this.strategy2.address, amount.mul(40));
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(40));

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Deposit split amount get close to max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(48));

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Deposit split amount but exceed max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(106));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(50));

      expect(await this.strategy.depositCalled()).to.eq(1);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Deposit split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(114));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(50));

      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Deposit split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(80));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(194));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(50));

      // It will deposit strategy 2 times as it's trying to balance 80 between 114 and 50
      // Because 50 + 80 exceeds 114
      // If we were to deposit 60, we would have a single deposit call
      // Multideposits are showcased in the next section
      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
  });
  describe('Deposit() - Max ChildTwo - Split - Multi', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.strategy.address, amount.mul(48));
      await this.erc20.transfer(this.strategy2.address, amount.mul(40));
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(48));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(40));

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(0);
    });
    it('Deposit split amount get close to max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(48));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(48));

      expect(await this.strategy.depositCalled()).to.eq(0);
      expect(await this.strategy2.depositCalled()).to.eq(1);
    });
    it('Deposit split amount but exceed max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(54));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(50));

      // Double DEPOSIT on one!
      expect(await this.strategy.depositCalled()).to.eq(2);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
    it('Deposit split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(62));
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(50));

      // Double DEPOSIT on one again!
      expect(await this.strategy.depositCalled()).to.eq(4);
      expect(await this.strategy2.depositCalled()).to.eq(2);
    });
  });
});

// Copy of the previous test block but testing the other way around
describe('AlphaBetaEqualDepositMaxSplitter - childOneMax', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'AlphaBetaEqualDepositMaxSplitter',
      'TreeStrategyMockCustom',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.alice
    this.core = this.alice;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['store', this.InfoStorage, [this.erc20.address, this.core.address]]]);
    await deploy(this, [['master', this.MasterStrategy, [this.store.address]]]);

    await deploy(this, [
      [
        'splitter',
        this.AlphaBetaEqualDepositMaxSplitter,
        [
          this.master.address,
          constants.AddressZero,
          constants.AddressZero,
          amount.mul(4),
          amount.mul(50),
          constants.MaxUint256,
        ],
      ],
    ]);

    await deploy(this, [['strategy', this.TreeStrategyMockCustom, []]]);
    await this.strategy.setParent(this.splitter.address);
    await this.strategy.setCore(this.core.address);
    await this.strategy.setWant(this.erc20.address);
    await this.strategy.setSetupCompleted(true);

    await deploy(this, [['strategy2', this.TreeStrategyMockCustom, []]]);
    await this.strategy2.setParent(this.splitter.address);
    await this.strategy2.setCore(this.core.address);
    await this.strategy2.setWant(this.erc20.address);
    await this.strategy2.setSetupCompleted(true);

    await this.splitter.setInitialChildOne(this.strategy.address);
    await this.splitter.setInitialChildTwo(this.strategy2.address);

    await this.master.setInitialChildOne(this.splitter.address);

    await timeTraveler.snapshot();
  });
  describe('Deposit() - Max ChildOne - Non-Split', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.strategy2.address, amount.mul(100));
      await this.erc20.transfer(this.strategy.address, amount.mul(46));
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(46));

      expect(await this.strategy2.depositCalled()).to.eq(0);
      expect(await this.strategy.depositCalled()).to.eq(0);
    });
    it('Deposit non-split amount get close to max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(49));

      expect(await this.strategy2.depositCalled()).to.eq(0);
      expect(await this.strategy.depositCalled()).to.eq(1);
    });
    it('Deposit non-split amount but exceed max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(102));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(50));

      expect(await this.strategy2.depositCalled()).to.eq(1);
      expect(await this.strategy.depositCalled()).to.eq(2);
    });
    it('Deposit non-split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(3));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(105));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(50));

      expect(await this.strategy2.depositCalled()).to.eq(2);
      expect(await this.strategy.depositCalled()).to.eq(2);
    });
  });
  describe('Deposit() - Max ChildOne - amount->split', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.strategy2.address, amount.mul(100));
      await this.erc20.transfer(this.strategy.address, amount.mul(40));
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(40));

      expect(await this.strategy2.depositCalled()).to.eq(0);
      expect(await this.strategy.depositCalled()).to.eq(0);
    });
    it('Deposit split amount get close to max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(100));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(48));

      expect(await this.strategy2.depositCalled()).to.eq(0);
      expect(await this.strategy.depositCalled()).to.eq(1);
    });
    it('Deposit split amount but exceed max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(106));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(50));

      expect(await this.strategy2.depositCalled()).to.eq(1);
      expect(await this.strategy.depositCalled()).to.eq(2);
    });
    it('Deposit split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(114));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(50));

      expect(await this.strategy2.depositCalled()).to.eq(2);
      expect(await this.strategy.depositCalled()).to.eq(2);
    });
    it('Deposit split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(80));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(194));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(50));

      // It will deposit strategy2 2 times as it's trying to balance 80 between 114 and 50
      // Because 50 + 80 exceeds 114
      // If we were to deposit 60, we would have a single deposit call
      // Multideposits are showcased in the next section
      expect(await this.strategy2.depositCalled()).to.eq(4);
      expect(await this.strategy.depositCalled()).to.eq(2);
    });
  });
  describe('Deposit() - Max ChildOne - amount->split - Multi', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.erc20.transfer(this.strategy2.address, amount.mul(48));
      await this.erc20.transfer(this.strategy.address, amount.mul(40));
    });
    it('Initial state', async function () {
      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(48));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(40));

      expect(await this.strategy2.depositCalled()).to.eq(0);
      expect(await this.strategy.depositCalled()).to.eq(0);
    });
    it('Deposit split amount get close to max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(48));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(48));

      expect(await this.strategy2.depositCalled()).to.eq(0);
      expect(await this.strategy.depositCalled()).to.eq(1);
    });
    it('Deposit split amount but exceed max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(54));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(50));

      // Double DEPOSIT on one!
      expect(await this.strategy2.depositCalled()).to.eq(2);
      expect(await this.strategy.depositCalled()).to.eq(2);
    });
    it('Deposit split amount with exceeded max', async function () {
      await this.erc20.transfer(this.master.address, amount.mul(8));
      await this.master.deposit();

      expect(await this.erc20.balanceOf(this.strategy2.address)).to.eq(amount.mul(62));
      expect(await this.erc20.balanceOf(this.strategy.address)).to.eq(amount.mul(50));

      // Double DEPOSIT on one again!
      expect(await this.strategy2.depositCalled()).to.eq(4);
      expect(await this.strategy.depositCalled()).to.eq(2);
    });
  });
});
