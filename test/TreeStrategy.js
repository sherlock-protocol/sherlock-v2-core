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
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'TreeSplitterMock',
      'TreeStrategyMock',
      'TreeStrategyMockCustom',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.bob
    this.core = this.bob;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['store', this.InfoStorage, [this.erc20.address, this.core.address]]]);
    await deploy(this, [['master', this.MasterStrategy, [this.store.address]]]);
    await deploy(this, [['strategy', this.TreeStrategyMock, [this.master.address]]]);
    await deploy(this, [['strategy2', this.TreeStrategyMock, [this.master.address]]]);
    await deploy(this, [['strategyCustom', this.TreeStrategyMockCustom, []]]);

    await timeTraveler.snapshot();
  });
  describe('Constructor', function () {});
  describe('Default checks', function () {
    it('isMaster', async function () {
      expect(await this.master.isMaster()).to.eq(true);
    });
    it('core', async function () {
      expect(await this.master.core()).to.eq(this.core.address);
    });
    it('parent', async function () {
      expect(await this.master.parent()).to.eq(this.store.address);
    });
    it('childRemoved', async function () {
      await expect(this.master.childRemoved()).to.be.revertedWith(
        'NotImplemented("' + (await this.master.interface.getSighash('childRemoved()')) + '")',
      );
    });
    it('replace', async function () {
      await expect(this.master.replace(this.alice.address)).to.be.revertedWith(
        'NotImplemented("' + (await this.master.interface.getSighash('replace(address)')) + '")',
      );
    });
    it('replaceForce', async function () {
      await expect(this.master.replaceForce(this.alice.address)).to.be.revertedWith(
        'NotImplemented("' +
          (await this.master.interface.getSighash('replaceForce(address)')) +
          '")',
      );
    });
    it('updateParent', async function () {
      await expect(this.master.updateParent(constants.AddressZero)).to.be.revertedWith(
        'NotImplemented("' +
          (await this.master.interface.getSighash('updateParent(address)')) +
          '")',
      );
    });
  });
  describe('setInitialChildOne()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(
        this.master.connect(this.carol).setInitialChildOne(this.alice.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(this.master.setInitialChildOne(constants.AddressZero)).to.be.revertedWith(
        'ZeroArg()',
      );
    });
    // TODO test all other edge cases? Uses same underlying function  as updateChild (_verifySetChild)
    it('Set', async function () {
      await this.master.setInitialChildOne(this.strategy.address);

      await expect(this.master.setInitialChildOne(this.strategy.address)).to.be.revertedWith(
        'InvalidState()',
      );
    });
  });
  describe('updateChild()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Not setup', async function () {
      await expect(this.master.updateChild(this.alice.address)).to.be.revertedWith('NotSetup()');
    });
    it('Invalid sender', async function () {
      await this.master.setInitialChildOne(this.strategy.address);

      await expect(this.master.updateChild(this.alice.address)).to.be.revertedWith(
        'InvalidSender()',
      );
    });
    it('Zero', async function () {
      await expect(
        this.strategy.mockUpdateChild(this.master.address, constants.AddressZero),
      ).to.be.revertedWith('ZeroArg()');
    });
    it('Same', async function () {
      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategy.address),
      ).to.be.revertedWith('InvalidArg()');
    });
    it('Wrong parent', async function () {
      await this.strategyCustom.setParent(this.alice.address);

      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyCustom.address),
      ).to.be.revertedWith('InvalidParent()');
    });
    it('Wrong core', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.alice.address);

      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyCustom.address),
      ).to.be.revertedWith('InvalidCore()');
    });
    it('Wrong want', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.alice.address);

      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyCustom.address),
      ).to.be.revertedWith('InvalidWant()');
    });
    it('Update', async function () {
      expect(await this.master.childOne()).to.eq(this.strategy.address);

      this.t0 = await meta(
        this.strategy.mockUpdateChild(this.master.address, this.strategy2.address),
      );
      this.t0.events[0] = this.master.interface.parseLog(this.t0.events[0]);
      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].name).to.eq('ChildOneUpdate');
      expect(this.t0.events[0].args.oldChild).to.eq(this.strategy.address);
      expect(this.t0.events[0].args.newChild).to.eq(this.strategy2.address);

      expect(await this.master.childOne()).to.eq(this.strategy2.address);
    });
  });
  describe('deposit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.master.deposit()).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid balance', async function () {
      await expect(this.master.connect(this.core).deposit()).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('Deposit', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      await this.erc20.transfer(this.master.address, maxTokens);

      expect(await this.strategyCustom.depositCalled()).to.eq(0);
      expect(await this.erc20.balanceOf(this.strategyCustom.address)).to.eq(0);

      await this.master.connect(this.core).deposit();

      expect(await this.strategyCustom.depositCalled()).to.eq(1);
      expect(await this.erc20.balanceOf(this.strategyCustom.address)).to.eq(maxTokens);
      expect(await this.erc20.balanceOf(this.master.address)).to.eq(0);
    });
  });
  describe('withdrawAllByAdmin()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.master.connect(this.carol).withdrawAllByAdmin()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      expect(await this.strategyCustom.withdrawAllCalled()).to.eq(0);

      await this.master.withdrawAllByAdmin();
      // todo assert event

      expect(await this.strategyCustom.withdrawAllCalled()).to.eq(1);
    });
  });
  describe('withdrawAll()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.master.connect(this.carol).withdrawAll()).to.be.revertedWith(
        'InvalidSender()',
      );
    });
    it('Do', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      expect(await this.strategyCustom.withdrawAllCalled()).to.eq(0);

      await this.master.connect(this.core).withdrawAll();

      expect(await this.strategyCustom.withdrawAllCalled()).to.eq(1);
    });
  });
  describe('withdrawByAdmin()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.master.connect(this.carol).withdrawByAdmin(maxTokens)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      expect(await this.strategyCustom.withdrawCalled()).to.eq(0);

      await this.master.withdrawByAdmin(maxTokens);
      // todo assert event

      expect(await this.strategyCustom.withdrawCalled()).to.eq(1);
    });
  });
  describe('withdraw()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.master.connect(this.carol).withdraw(maxTokens)).to.be.revertedWith(
        'InvalidSender()',
      );
    });
    it('Do', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      expect(await this.strategyCustom.withdrawCalled()).to.eq(0);

      await this.master.connect(this.core).withdraw(maxTokens);

      expect(await this.strategyCustom.withdrawCalled()).to.eq(1);
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
