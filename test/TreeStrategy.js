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

// test basenode (as strategy)
// - deploy with master as parent
// - deploy with master --> node --> as parent
// -- call replaceAsChild on strategy to test `_executeParentUpdate` on node
// -- remove child to test `updateParent`

// test baseSplitter
// - replace child --> `updateChild`
// - remove child --> `childRemoved`
// - call replace

// test basestrategy
// - remove
// - replace

const maxTokens = parseUnits('100000000000', 6);

// first test master strategy

describe.only('MasterStrategy', function () {
  before(async function () {
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'MasterStrategy',
      'TreeSplitterMock',
      'TreeStrategyMock',
      'TreeStrategyMockZeroCore',
      'TreeStrategyMockZeroWant',
      'ERC20Mock6d',
    ]);

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [
      ['strategy', this.TreeStrategyMock, [this.bob.address, this.erc20.address]],
    ]);
    await deploy(this, [
      ['strategy2', this.TreeStrategyMock, [this.bob.address, this.erc20.address]],
    ]);
    await deploy(this, [
      ['strategyInvalidCore', this.TreeStrategyMock, [this.carol.address, this.erc20.address]],
    ]);
    await deploy(this, [
      ['strategyInvalidWant', this.TreeStrategyMock, [this.bob.address, this.carol.address]],
    ]);

    await deploy(this, [['strategyZeroCore', this.TreeStrategyMockZeroCore, []]]);
    await deploy(this, [['strategyZeroWant', this.TreeStrategyMockZeroWant, []]]);

    await deploy(this, [['master', this.MasterStrategy, [this.strategy.address]]]);

    await this.strategyInvalidCore.mockSetInitialParent(this.master.address);
    await this.strategyInvalidWant.mockSetInitialParent(this.master.address);
  });
  describe('Constructor', function () {
    it('Zero address', async function () {
      await expect(this.MasterStrategy.deploy(constants.AddressZero)).to.be.revertedWith(
        'Transaction reverted: function returned an unexpected amount of data',
      );
    });
    it('Zero want', async function () {
      await expect(this.MasterStrategy.deploy(this.strategyZeroWant.address)).to.be.revertedWith(
        'InvalidWant()',
      );
    });
    it('Zero core', async function () {
      await expect(this.MasterStrategy.deploy(this.strategyZeroCore.address)).to.be.revertedWith(
        'InvalidCore()',
      );
    });
    it('setSherlockCoreAddress', async function () {
      await expect(this.master.setSherlockCoreAddress(this.alice.address)).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
  });
  describe('Default checks', function () {
    it('isMaster', async function () {
      expect(await this.master.isMaster()).to.eq(true);
    });
    it('core', async function () {
      expect(await this.master.core()).to.eq(this.bob.address);
    });
    it('parent', async function () {
      expect(await this.master.parent()).to.eq(constants.AddressZero);
    });
    it('childRemoved', async function () {
      await expect(this.master.childRemoved()).to.be.revertedWith(
        'NotImplemented("' + (await this.master.interface.getSighash('childRemoved()')) + '")',
      );
    });
    it('updateParent', async function () {
      await expect(this.master.updateParent(constants.AddressZero)).to.be.revertedWith(
        'NotImplemented("' +
          (await this.master.interface.getSighash('updateParent(address)')) +
          '")',
      );
    });
    it('setInitialParent', async function () {
      await expect(this.master.setInitialParent(constants.AddressZero)).to.be.revertedWith(
        'NotImplemented("' +
          (await this.master.interface.getSighash('setInitialParent(address)')) +
          '")',
      );
    });
  });
  describe('updateChild()', function () {
    it('Invalid sender', async function () {
      await expect(this.master.updateChild(this.alice.address)).to.be.revertedWith(
        'InvalidSender()',
      );
    });
    it('Invalid sender', async function () {
      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.strategy.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.strategy.address, '0x100000000000000000000000000'],
      });
      const strategy = await ethers.provider.getSigner(this.strategy.address);

      await expect(
        this.master.connect(strategy).updateChild(constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Invalid Parent', async function () {
      // call `updateChild` with strategy.address that has parent = address(0)
      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategy.address),
      ).to.be.revertedWith('InvalidParent()');
    });
    it('Invalid core', async function () {
      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyInvalidCore.address),
      ).to.be.revertedWith('InvalidCore()');
    });
    it('Invalid want', async function () {
      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyInvalidWant.address),
      ).to.be.revertedWith('InvalidWant()');
    });
    it('Success', async function () {
      await this.strategy2.setInitialParent(this.master.address);
      this.t0 = await meta(
        this.strategy.mockUpdateChild(this.master.address, this.strategy2.address),
      );
    });
  });
});

// describe.only('Basenode', function () {
//   before(async function () {
//     // deploy master strategy
//     // set EOA as owner and sherlock core

//     await prepare(this, ['MasterStrategy', 'TreeSplitterMock', 'TreeStrategyMock', 'ERC20Mock6d']);

//     await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

//     await deploy(this, [
//       ['strategy', this.TreeStrategyMock, [this.bob.address, this.erc20.address]],
//     ]);
//     await deploy(this, [['master', this.MasterStrategy, [this.strategy.address]]]);

//     await this.strategy.setInitialParent(this.master.address);
//   });
//   describe('Initial state', function () {
//     it('state', async function () {
//       expect(await this.master.childOne()).to.eq(this.strategy.address);
//       expect(await this.master.parent()).to.eq(constants.AddressZero);
//       expect(await this.master.want()).to.eq(this.erc20.address);
//       expect(await this.master.core()).to.eq(this.bob.address);

//       expect(await this.strategy.parent()).to.eq(this.master.address);
//       expect(await this.strategy.want()).to.eq(this.erc20.address);
//       expect(await this.strategy.core()).to.eq(this.bob.address);
//     });
//   });
//   describe('constructor', function () {
//     it('Zero aToken', async function () {});
//   });
// });
