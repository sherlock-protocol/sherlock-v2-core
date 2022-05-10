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
} = require('./utilities');
const { TimeTraveler } = require('./utilities/snapshot');

// adding a strategy
// replacing a strategy
// removing a strategy
// replacing a splitter

const maxTokens = parseUnits('100000000000', 6);

describe('Test', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'TreeSplitterMock',
      'TreeStrategyMock',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.bob
    this.core = this.bob;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['store', this.InfoStorage, [this.erc20.address, this.core.address]]]);
    await deploy(this, [['master', this.MasterStrategy, [this.store.address]]]);

    // await deploy(this, [['splitterCustom', this.TreeSplitterMockCustom, []]]);
    // // await this.splitterCustom.setParent(this.address);
    // await this.splitterCustom.setCore(this.core.address);
    // await this.splitterCustom.setWant(this.erc20.address);

    // await deploy(this, [['strategyCustom', this.TreeStrategyMockCustom, []]]);

    await timeTraveler.snapshot();
  });
  describe('Adding a strategy', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Master --> strategy', async function () {
      //     m
      //     |
      //  strat1
      await deploy(this, [['strategy', this.TreeStrategyMock, [this.master.address]]]);

      await this.master.setInitialChildOne(this.strategy.address);
    });
    it('Master --> splitter1 --> strategy', async function () {
      //     m
      //     |
      //  splitter1
      //  /       \
      //strat2  strat1
      await deploy(this, [
        [
          'splitter1',
          this.TreeSplitterMock,
          [this.master.address, constants.AddressZero, this.strategy.address],
        ],
      ]);
      await deploy(this, [['strategy2', this.TreeStrategyMock, [this.splitter1.address]]]);

      await this.splitter1.setInitialChildOne(this.strategy2.address);
      await this.strategy.replaceAsChild(this.splitter1.address);
    });
    it('Master --> splitter1 --> splitter2 --> strategy', async function () {
      //     m
      //     |
      //  splitter1
      //  /       \
      //strat2  splitter2
      //        /       \
      //      strat3    strat1
      await deploy(this, [
        [
          'splitter2',
          this.TreeSplitterMock,
          [this.splitter1.address, constants.AddressZero, this.strategy.address],
        ],
      ]);
      await deploy(this, [['strategy3', this.TreeStrategyMock, [this.splitter2.address]]]);

      await this.splitter2.setInitialChildOne(this.strategy3.address);
      await this.strategy.replaceAsChild(this.splitter2.address);
    });
  });
  describe('Replacing a strategy', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Master --> strategy', async function () {
      //     m
      //     |
      //  strat1
      await deploy(this, [['strategy', this.TreeStrategyMock, [this.master.address]]]);

      await this.master.setInitialChildOne(this.strategy.address);
    });
    it('Master --> strategy2', async function () {
      //     m
      //     |
      //  strat2
      await deploy(this, [['strategy2', this.TreeStrategyMock, [this.master.address]]]);

      await this.strategy.replace(this.strategy2.address);
    });
    it('Master --> splitter1 --> strategy2', async function () {
      //     m
      //     |
      //  splitter1
      //  /       \
      //strat3  strat2
      await deploy(this, [
        [
          'splitter1',
          this.TreeSplitterMock,
          [this.master.address, constants.AddressZero, this.strategy2.address],
        ],
      ]);
      await deploy(this, [['strategy3', this.TreeStrategyMock, [this.splitter1.address]]]);

      await this.splitter1.setInitialChildOne(this.strategy3.address);

      await this.strategy2.replaceAsChild(this.splitter1.address);
    });
    it('Master --> splitter1 --> strategy4', async function () {
      //     m
      //     |
      //  splitter1
      //  /       \
      //strat3  strat4
      await deploy(this, [['strategy4', this.TreeStrategyMock, [this.splitter1.address]]]);

      await this.strategy2.replace(this.strategy4.address);
    });
  });
  describe('Removing a strategy', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Master --> strategy', async function () {
      //     m
      //     |
      //  strat1
      await deploy(this, [['strategy', this.TreeStrategyMock, [this.master.address]]]);

      await this.master.setInitialChildOne(this.strategy.address);
    });
    it('Master --> strategy', async function () {
      //     m
      //     |
      //  strat1

      await expect(this.strategy.remove()).to.be.reverted;
    });
    it('Master --> splitter1 --> strategy', async function () {
      //     m
      //     |
      //  splitter1
      //  /       \
      //strat2  strat
      await deploy(this, [
        [
          'splitter1',
          this.TreeSplitterMock,
          [this.master.address, constants.AddressZero, this.strategy.address],
        ],
      ]);
      await deploy(this, [['strategy2', this.TreeStrategyMock, [this.splitter1.address]]]);

      await this.splitter1.setInitialChildOne(this.strategy2.address);

      await this.strategy.replaceAsChild(this.splitter1.address);
    });
    it('Master --> splitter1 --> strategy', async function () {
      //     m
      //     |
      //  strat2

      await this.strategy.remove();
    });
  });
  describe('Replacing a splitter', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Master --> strategy', async function () {
      //     m
      //     |
      //  strat1
      await deploy(this, [['strategy', this.TreeStrategyMock, [this.master.address]]]);

      await this.master.setInitialChildOne(this.strategy.address);
    });
    it('Master --> splitter1 --> strategy', async function () {
      //     m
      //     |
      //  splitter1
      //  /       \
      //strat2  strat
      await deploy(this, [
        [
          'splitter1',
          this.TreeSplitterMock,
          [this.master.address, constants.AddressZero, this.strategy.address],
        ],
      ]);
      await deploy(this, [['strategy2', this.TreeStrategyMock, [this.splitter1.address]]]);

      await this.splitter1.setInitialChildOne(this.strategy2.address);

      await this.strategy.replaceAsChild(this.splitter1.address);
    });
    it('Master --> splitter2 --> strategy', async function () {
      //     m
      //     |
      //  splitter2
      //  /       \
      //strat2  strat
      await deploy(this, [
        [
          'splitter2',
          this.TreeSplitterMock,
          [this.master.address, this.strategy2.address, this.strategy.address],
        ],
      ]);

      await this.splitter1.replace(this.splitter2.address);
    });
  });
});
