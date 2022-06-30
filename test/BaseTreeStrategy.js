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

const maxTokens = parseUnits('100000000000', 6);

describe('MasterStrategy', function () {
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
    it('replaceAsChild', async function () {
      await expect(this.master.replaceAsChild(this.alice.address)).to.be.revertedWith(
        'NotImplemented("' +
          (await this.master.interface.getSighash('replaceAsChild(address)')) +
          '")',
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
    it('Not setup', async function () {
      await expect(this.master.setInitialChildOne(this.strategyCustom.address)).to.be.revertedWith(
        'SetupNotCompleted("' + this.strategyCustom.address + '")',
      );
    });
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
    it('Not setup', async function () {
      await this.strategyCustom.setSetupCompleted(false);

      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyCustom.address),
      ).to.be.revertedWith('SetupNotCompleted("' + this.strategyCustom.address + '")');
    });
    it('Wrong core', async function () {
      await this.strategyCustom.setSetupCompleted(true);
      await this.strategyCustom.setCore(this.alice.address);

      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyCustom.address),
      ).to.be.revertedWith('InvalidCore()');
    });
    it('Wrong want', async function () {
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.alice.address);

      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyCustom.address),
      ).to.be.revertedWith('InvalidWant()');
    });
    it('Wrong parent', async function () {
      await this.strategyCustom.setParent(this.alice.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);

      await expect(
        this.strategy.mockUpdateChild(this.master.address, this.strategyCustom.address),
      ).to.be.revertedWith('InvalidParent()');
    });
    it('Update', async function () {
      expect(await this.master.childOne()).to.eq(this.strategy.address);

      this.t0 = await meta(
        this.strategy.mockUpdateChild(this.master.address, this.strategy2.address),
      );
      this.t0.events[0] = this.master.interface.parseLog(this.t0.events[0]);
      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].name).to.eq('ChildOneUpdate');
      expect(this.t0.events[0].args.previous).to.eq(this.strategy.address);
      expect(this.t0.events[0].args.current).to.eq(this.strategy2.address);

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
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.strategyCustom.setSetupCompleted(true);

      await this.master.setInitialChildOne(this.strategyCustom.address);
      await expect(this.master.connect(this.core).deposit()).to.be.revertedWith(
        'InvalidConditions()',
      );
    });
    it('Deposit', async function () {
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
      await this.strategyCustom.setSetupCompleted(true);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      expect(await this.strategyCustom.withdrawAllCalled()).to.eq(0);

      this.t0 = await meta(this.master.withdrawAllByAdmin());
      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('AdminWithdraw');
      expect(this.t0.events[0].args.amount).to.eq(constants.MaxUint256);

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
      await this.strategyCustom.setSetupCompleted(true);
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
    it('Zero amount', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.strategyCustom.setSetupCompleted(true);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      await expect(this.master.withdrawByAdmin(0)).to.be.revertedWith('ZeroArg()');
    });
    it('Do', async function () {
      expect(await this.strategyCustom.withdrawCalled()).to.eq(0);

      this.t0 = await meta(this.master.withdrawByAdmin(maxTokens));
      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('AdminWithdraw');
      expect(this.t0.events[0].args.amount).to.eq(maxTokens);

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
    it('Zero amount', async function () {
      await this.strategyCustom.setParent(this.master.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);
      await this.strategyCustom.setSetupCompleted(true);
      await this.master.setInitialChildOne(this.strategyCustom.address);

      await expect(this.master.connect(this.core).withdraw(0)).to.be.revertedWith('ZeroArg()');
    });
    it('Do', async function () {
      expect(await this.strategyCustom.withdrawCalled()).to.eq(0);

      await this.master.connect(this.core).withdraw(maxTokens);

      expect(await this.strategyCustom.withdrawCalled()).to.eq(1);
    });
  });
});
describe('BaseNode', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'TreeSplitterMock',
      'TreeSplitterMockCustom',
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
    await deploy(this, [
      [
        'splitter',
        this.TreeSplitterMock,
        [this.master.address, constants.AddressZero, constants.AddressZero],
      ],
    ]);
    await deploy(this, [['splitterCustom', this.TreeSplitterMockCustom, []]]);

    // Set want and core for this deployment
    await this.splitterCustom.setWant(this.alice.address);
    await this.splitterCustom.setCore(this.alice.address);
    await deploy(this, [
      ['strategyOfSplitter', this.TreeStrategyMock, [this.splitterCustom.address]],
    ]);
    // Reset to zero
    await this.splitterCustom.setWant(constants.AddressZero);
    await this.splitterCustom.setCore(constants.AddressZero);

    await this.master.setInitialChildOne(this.strategy.address);

    await timeTraveler.snapshot();
  });
  it('default', async function () {
    expect(await this.strategy.parent()).to.eq(this.master.address);
    expect(await this.strategy.want()).to.eq(this.erc20.address);
    expect(await this.strategy.core()).to.eq(this.bob.address);
  });
  describe('constructor', function () {
    it('Zero parent', async function () {
      await expect(this.TreeStrategyMock.deploy(constants.AddressZero)).to.be.revertedWith(
        'ZeroArg()',
      );
    });
    it('Invalid parent', async function () {
      await expect(this.TreeStrategyMock.deploy(this.alice.address)).to.be.revertedWith(
        'Transaction reverted: function returned an unexpected amount of data',
      );
    });
    it('Zero want parent', async function () {
      await this.splitterCustom.setWant(constants.AddressZero);

      await expect(this.TreeStrategyMock.deploy(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidWant()',
      );
    });
    it('Zero core parent', async function () {
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setCore(constants.AddressZero);

      await expect(this.TreeStrategyMock.deploy(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidCore()',
      );
    });
  });
  describe('replaceAsChild()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(
        this.strategy.connect(this.carol).replaceAsChild(this.splitter.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Is master', async function () {
      await expect(this.strategy.replaceAsChild(this.master.address)).to.be.revertedWith(
        'IsMaster()',
      );
    });
    it('Is node itself', async function () {
      await expect(this.splitter.replaceAsChild(this.splitter.address)).to.be.revertedWith(
        'InvalidParentAddress()',
      );
    });
    it('Is same parent', async function () {
      // TODO test with splitter as parent (instead of master)
    });
    it('Invalid core', async function () {
      await this.splitterCustom.setCore(this.alice.address);
      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidCore()',
      );
    });
    it('Invalid want', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.alice.address);
      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidWant()',
      );
    });
    it('Not setup', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);

      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'SetupNotCompleted("' + this.splitterCustom.address + '")',
      );
    });
    it('Not child', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setSetupCompleted(true);

      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'NotChild()',
      );
    });
    it('Both child', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy.address);

      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'BothChild()',
      );
    });
    it('Invalid parent', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setParent(this.carol.address);

      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidParent()',
      );
    });
    it('Target setup not completed ', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setSetupCompleted(false);

      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'SetupNotCompleted("' + this.splitterCustom.address + '")',
      );
    });
    it('Invalid other parent', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setSetupCompleted(true);

      await expect(this.strategy.replaceAsChild(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidParent()',
      );
    });
    it('Success', async function () {
      await this.strategyCustom.setParent(this.splitterCustom.address);

      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategyCustom.address);
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setSetupCompleted(true);

      expect(await this.strategy.parent()).to.eq(this.master.address);
      expect(await this.master.childOne()).to.eq(this.strategy.address);

      this.t0 = await meta(this.strategy.replaceAsChild(this.splitterCustom.address));

      this.t0.events[0] = this.master.interface.parseLog(this.t0.events[0]);

      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[0].name).to.eq('ChildOneUpdate');
      expect(this.t0.events[0].args.previous).to.eq(this.strategy.address);
      expect(this.t0.events[0].args.current).to.eq(this.splitterCustom.address);
      expect(this.t0.events[1].event).to.eq('ParentUpdate');
      expect(this.t0.events[1].args.previous).to.eq(this.master.address);
      expect(this.t0.events[1].args.current).to.eq(this.splitterCustom.address);
      expect(this.t0.events[2].event).to.eq('ReplaceAsChild');

      expect(await this.strategy.parent()).to.eq(this.splitterCustom.address);
      expect(await this.master.childOne()).to.eq(this.splitterCustom.address);
    });
  });
  describe('updateParent()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.master.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.master.address, '0x100000000000000000000000000'],
      });
      this.m = await ethers.provider.getSigner(this.master.address);
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.updateParent(this.splitter.address)).to.be.revertedWith(
        'SenderNotParent()',
      );
    });
    it('Is node itself', async function () {
      await expect(
        this.strategy.connect(this.m).updateParent(this.strategy.address),
      ).to.be.revertedWith('InvalidParentAddress()');
    });
    it('Is same parent', async function () {
      await expect(
        this.strategy.connect(this.m).updateParent(this.master.address),
      ).to.be.revertedWith('InvalidParentAddress()');
    });
    it('Invalid core', async function () {
      await this.splitterCustom.setCore(this.alice.address);

      await expect(
        this.strategy.connect(this.m).updateParent(this.splitterCustom.address),
      ).to.be.revertedWith('InvalidCore()');
    });
    it('Invalid want', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.alice.address);

      await expect(
        this.strategy.connect(this.m).updateParent(this.splitterCustom.address),
      ).to.be.revertedWith('InvalidWant()');
    });
    it('Setup not completed', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setSetupCompleted(false);

      await expect(
        this.strategy.connect(this.m).updateParent(this.splitterCustom.address),
      ).to.be.revertedWith('SetupNotCompleted("' + this.splitterCustom.address + '")');
    });
    it('Not child', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setSetupCompleted(true);

      await expect(
        this.strategy.connect(this.m).updateParent(this.splitterCustom.address),
      ).to.be.revertedWith('NotChild()');
    });
    it('Both child', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setSetupCompleted(true);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy.address);

      await expect(
        this.strategy.connect(this.m).updateParent(this.splitterCustom.address),
      ).to.be.revertedWith('BothChild()');
    });
    it('Both child', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy.address);

      await expect(
        this.strategy.connect(this.m).updateParent(this.splitterCustom.address),
      ).to.be.revertedWith('BothChild()');
    });
    it('Success', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.carol.address);

      expect(await this.strategy.parent()).to.eq(this.master.address);

      this.t0 = await meta(this.strategy.connect(this.m).updateParent(this.splitterCustom.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ParentUpdate');
      expect(this.t0.events[0].args.previous).to.eq(this.master.address);
      expect(this.t0.events[0].args.current).to.eq(this.splitterCustom.address);

      expect(await this.strategy.parent()).to.eq(this.splitterCustom.address);
    });
  });
  describe('siblingRemoved()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.splitterCustom.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.splitterCustom.address, '0x100000000000000000000000000'],
      });
      this.s = await ethers.provider.getSigner(this.splitterCustom.address);
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.siblingRemoved()).to.be.revertedWith('SenderNotParent()');
    });
    it('Is node itself', async function () {
      await this.splitterCustom.setParent(this.strategyOfSplitter.address);

      await expect(this.strategyOfSplitter.connect(this.s).siblingRemoved()).to.be.revertedWith(
        'InvalidParentAddress()',
      );
    });
    it('Is same parent', async function () {
      await this.splitterCustom.setParent(this.splitterCustom.address);

      await expect(this.strategyOfSplitter.connect(this.s).siblingRemoved()).to.be.revertedWith(
        'InvalidParentAddress()',
      );
    });
    it('Invalid core', async function () {
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setCore(this.alice.address);

      await expect(this.strategyOfSplitter.connect(this.s).siblingRemoved()).to.be.revertedWith(
        'InvalidCore()',
      );
    });
    it('Invalid want', async function () {
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.alice.address);

      await expect(this.strategyOfSplitter.connect(this.s).siblingRemoved()).to.be.revertedWith(
        'InvalidWant()',
      );
    });
    it('Success', async function () {
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);

      expect(await this.strategyOfSplitter.parent()).to.eq(this.splitterCustom.address);

      this.t0 = await meta(this.strategyOfSplitter.connect(this.s).siblingRemoved());

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ParentUpdate');
      expect(this.t0.events[0].args.previous).to.eq(this.splitterCustom.address);
      expect(this.t0.events[0].args.current).to.eq(this.master.address);

      expect(await this.strategy.parent()).to.eq(this.master.address);
    });
  });
  describe('withdrawAll()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.withdrawAll()).to.be.revertedWith('SenderNotParent()');
    });
    it('Do', async function () {
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(0);
      await this.master.withdrawAllByAdmin();
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(1);
    });
  });
  describe('withdrawAllByAdmin()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.connect(this.bob).withdrawAllByAdmin()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do', async function () {
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(0);

      this.t0 = await meta(this.strategy.withdrawAllByAdmin());
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[2].event).to.eq('AdminWithdraw');
      expect(this.t0.events[2].args.amount).to.eq(0);
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(1);
    });
  });
  describe('withdraw()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.withdraw(0)).to.be.revertedWith('SenderNotParent()');
    });
    it('Zero amount', async function () {
      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.master.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.master.address, '0x100000000000000000000000000'],
      });
      this.m = await ethers.provider.getSigner(this.master.address);

      await expect(this.strategy.connect(this.m).withdraw(0)).to.be.revertedWith('ZeroArg()');
    });
    it('Do', async function () {
      await this.erc20.transfer(this.strategy.address, maxTokens);

      expect(await this.strategy.internalWithdrawCalled()).to.eq(0);
      await this.master.withdrawByAdmin(maxTokens);
      expect(await this.strategy.internalWithdrawCalled()).to.eq(1);
    });
  });
  describe('withdrawByAdmin()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.connect(this.carol).withdrawByAdmin(0)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Zero amount', async function () {
      await expect(this.strategy.withdrawByAdmin(0)).to.be.revertedWith('ZeroArg()');
    });
    it('Do', async function () {
      await this.erc20.transfer(this.strategy.address, maxTokens);

      expect(await this.strategy.internalWithdrawCalled()).to.eq(0);
      await this.strategy.withdrawByAdmin(maxTokens);
      expect(await this.strategy.internalWithdrawCalled()).to.eq(1);
    });
  });
  describe('deposit()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.deposit()).to.be.revertedWith('SenderNotParent()');
    });
    it('Do', async function () {
      await this.erc20.transfer(this.master.address, maxTokens);

      expect(await this.strategy.internalDepositCalled()).to.eq(0);
      await this.master.connect(this.core).deposit();
      expect(await this.strategy.internalDepositCalled()).to.eq(1);
    });
  });
});
describe('BaseSplitter', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'TreeSplitterMock',
      'TreeSplitterMockCustom',
      'TreeStrategyMock',
      'TreeStrategyMockCustom',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.bob
    this.core = this.bob;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['store', this.InfoStorage, [this.erc20.address, this.core.address]]]);
    await deploy(this, [['master', this.MasterStrategy, [this.store.address]]]);
    await deploy(this, [
      [
        'splitter',
        this.TreeSplitterMock,
        [this.master.address, constants.AddressZero, constants.AddressZero],
      ],
    ]);
    await deploy(this, [['splitterCustom', this.TreeSplitterMockCustom, []]]);

    await deploy(this, [['strategy', this.TreeStrategyMock, [this.splitter.address]]]);
    await deploy(this, [['strategy2', this.TreeStrategyMock, [this.splitter.address]]]);

    await deploy(this, [['strategyC', this.TreeStrategyMockCustom, []]]);
    await deploy(this, [['strategyC2', this.TreeStrategyMockCustom, []]]);

    await timeTraveler.snapshot();
  });
  describe('constructor', function () {
    it('Zero childs', async function () {
      const x = await this.TreeSplitterMock.deploy(
        this.master.address,
        constants.AddressZero,
        constants.AddressZero,
      );
      expect(await x.childOne()).to.eq(constants.AddressZero);
      expect(await x.childTwo()).to.eq(constants.AddressZero);
    });
    it('Single child', async function () {
      const x = await this.TreeSplitterMock.deploy(
        this.master.address,
        this.strategy.address,
        constants.AddressZero,
      );
      expect(await x.childOne()).to.eq(this.strategy.address);
      expect(await x.childTwo()).to.eq(constants.AddressZero);
    });
    it('Double child', async function () {
      const x = await this.TreeSplitterMock.deploy(
        this.master.address,
        this.strategy.address,
        this.strategy2.address,
      );
      expect(await x.childOne()).to.eq(this.strategy.address);
      expect(await x.childTwo()).to.eq(this.strategy2.address);
    });
  });
  describe('setupCompleted()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Default', async function () {
      expect(await this.splitter.setupCompleted()).to.eq(false);
    });
    it('Single child', async function () {
      await this.splitter.setInitialChildOne(this.strategy.address);
      expect(await this.splitter.setupCompleted()).to.eq(false);
    });
    it('Double child', async function () {
      await this.splitter.setInitialChildTwo(this.strategy2.address);
      expect(await this.splitter.setupCompleted()).to.eq(true);
    });
  });
  it('default', async function () {
    expect(await this.splitter.parent()).to.eq(this.master.address);
    expect(await this.splitter.want()).to.eq(this.erc20.address);
    expect(await this.splitter.core()).to.eq(this.core.address);
    expect(await this.splitter.isMaster()).to.eq(false);
  });
  describe('replaceForce()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(
        this.splitter.connect(this.carol).replaceForce(this.splitterCustom.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Success', async function () {
      await this.splitter.setInitialChildOne(this.strategy.address);
      await this.splitter.setInitialChildTwo(this.strategy2.address);
      await this.master.setInitialChildOne(this.splitter.address);

      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setSetupCompleted(true);

      expect(await this.strategy.parent()).to.eq(this.splitter.address);
      expect(await this.strategy2.parent()).to.eq(this.splitter.address);
      expect(await this.master.childOne()).to.eq(this.splitter.address);

      this.t0 = await meta(this.splitter.replaceForce(this.splitterCustom.address));
      expect(this.t0.events.length).to.eq(6);
      expect(this.t0.events[1].event).to.eq('Replace');
      expect(this.t0.events[1].args.newAddress).to.eq(this.splitterCustom.address);
      expect(this.t0.events[2].event).to.eq('Obsolete');
      expect(this.t0.events[2].args.implementation).to.eq(this.splitter.address);
      expect(this.t0.events[5].event).to.eq('ForceReplace');

      expect(await this.strategy.parent()).to.eq(this.splitterCustom.address);
      expect(await this.strategy2.parent()).to.eq(this.splitterCustom.address);
      expect(await this.master.childOne()).to.eq(this.splitterCustom.address);
    });
  });
  describe('replace()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(
        this.splitter.connect(this.carol).replace(this.splitterCustom.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Self not completed', async function () {
      await expect(this.splitter.replace(this.splitterCustom.address)).to.be.revertedWith(
        'SetupNotCompleted("' + this.splitter.address + '")',
      );
    });
    it('Invalid child one', async function () {
      await this.splitter.setInitialChildOne(this.strategy.address);
      await this.splitter.setInitialChildTwo(this.strategy2.address);
      await this.splitterCustom.setChildOne(this.strategy2.address);

      await expect(this.splitter.replace(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidChildOne()',
      );
    });
    it('Invalid child two', async function () {
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy.address);

      await expect(this.splitter.replace(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidChildTwo()',
      );
    });
    it('Target not completed', async function () {
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setSetupCompleted(false);

      await expect(this.splitter.replace(this.splitterCustom.address)).to.be.revertedWith(
        'SetupNotCompleted("' + this.splitterCustom.address + '")',
      );
    });
    it('Invalid node', async function () {
      await this.splitterCustom.setSetupCompleted(true);

      await expect(this.splitter.replace(this.splitter.address)).to.be.revertedWith('InvalidArg()');
    });
    it('Invalid parent', async function () {
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);

      await expect(this.splitter.replace(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidParent()',
      );
    });
    it('Invalid core', async function () {
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setParent(this.master.address);

      await expect(this.splitter.replace(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidCore()',
      );
    });
    it('Invalid want', async function () {
      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setCore(this.core.address);

      await expect(this.splitter.replace(this.splitterCustom.address)).to.be.revertedWith(
        'InvalidWant()',
      );
    });
    it('Success', async function () {
      await this.master.setInitialChildOne(this.splitter.address);

      await this.splitterCustom.setChildOne(this.strategy.address);
      await this.splitterCustom.setChildTwo(this.strategy2.address);
      await this.splitterCustom.setParent(this.master.address);
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);

      expect(await this.strategy.parent()).to.eq(this.splitter.address);
      expect(await this.strategy2.parent()).to.eq(this.splitter.address);
      expect(await this.master.childOne()).to.eq(this.splitter.address);

      this.t0 = await meta(this.splitter.replace(this.splitterCustom.address));
      expect(this.t0.events.length).to.eq(5);
      expect(this.t0.events[1].event).to.eq('Replace');
      expect(this.t0.events[1].args.newAddress).to.eq(this.splitterCustom.address);
      expect(this.t0.events[2].event).to.eq('Obsolete');
      expect(this.t0.events[2].args.implementation).to.eq(this.splitter.address);

      expect(await this.strategy.parent()).to.eq(this.splitterCustom.address);
      expect(await this.strategy2.parent()).to.eq(this.splitterCustom.address);
      expect(await this.master.childOne()).to.eq(this.splitterCustom.address);
    });
  });
  describe('updateChild()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.strategy.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.strategy.address, '0x100000000000000000000000000'],
      });
      this.s = await ethers.provider.getSigner(this.strategy.address);
    });
    it('Self not completed', async function () {
      await expect(this.splitter.updateChild(this.splitterCustom.address)).to.be.revertedWith(
        'SetupNotCompleted("' + this.splitter.address + '")',
      );
    });
    it('Target not completed', async function () {
      await this.splitter.setInitialChildOne(this.strategy.address);
      await this.splitter.setInitialChildTwo(this.strategy2.address);
      await this.splitterCustom.setSetupCompleted(false);

      await expect(
        this.splitter.connect(this.s).updateChild(this.splitterCustom.address),
      ).to.be.revertedWith('SetupNotCompleted("' + this.splitterCustom.address + '")');
    });
    it('Same as child one', async function () {
      await expect(
        this.splitter.connect(this.s).updateChild(this.strategy.address),
      ).to.be.revertedWith('InvalidArg()');
    });
    it('Same as child two', async function () {
      await expect(
        this.splitter.connect(this.s).updateChild(this.strategy2.address),
      ).to.be.revertedWith('InvalidArg()');
    });
    it('Invalid core', async function () {
      await this.splitterCustom.setSetupCompleted(true);

      await this.splitterCustom.setCore(this.alice.address);

      await expect(
        this.splitter.connect(this.s).updateChild(this.splitterCustom.address),
      ).to.be.revertedWith('InvalidCore()');
    });
    it('Invalid want', async function () {
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.alice.address);

      await expect(
        this.splitter.connect(this.s).updateChild(this.splitterCustom.address),
      ).to.be.revertedWith('InvalidWant()');
    });
    it('Invalid parent', async function () {
      await this.splitterCustom.setWant(this.erc20.address);

      await expect(
        this.splitter.connect(this.s).updateChild(this.splitterCustom.address),
      ).to.be.revertedWith('InvalidParent()');
    });
    it('Invalid sender', async function () {
      await this.splitterCustom.setParent(this.splitter.address);

      await expect(
        this.splitter.connect(this.carol).updateChild(this.splitterCustom.address),
      ).to.be.revertedWith('SenderNotChild()');
    });
    it('Update child one', async function () {
      await this.splitterCustom.setWant(this.erc20.address);

      expect(await this.splitter.childOne()).to.eq(this.strategy.address);
      expect(await this.splitter.childTwo()).to.eq(this.strategy2.address);

      this.t0 = await meta(this.splitter.connect(this.s).updateChild(this.splitterCustom.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ChildOneUpdate');
      expect(this.t0.events[0].args.previous).to.eq(this.strategy.address);
      expect(this.t0.events[0].args.current).to.eq(this.splitterCustom.address);

      expect(await this.splitter.childOne()).to.eq(this.splitterCustom.address);
      expect(await this.splitter.childTwo()).to.eq(this.strategy2.address);
    });
    it('Update child one again', async function () {
      await expect(
        this.splitter.connect(this.s).updateChild(this.splitterCustom.address),
      ).to.be.revertedWith('SenderNotChild()');
    });
    it('Prepare child two', async function () {
      await timeTraveler.revertSnapshot();

      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.strategy2.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.strategy2.address, '0x100000000000000000000000000'],
      });
      this.s2 = await ethers.provider.getSigner(this.strategy2.address);

      await this.splitter.setInitialChildOne(this.strategy.address);
      await this.splitter.setInitialChildTwo(this.strategy2.address);
      await this.splitterCustom.setSetupCompleted(true);
      await this.splitterCustom.setCore(this.core.address);
      await this.splitterCustom.setWant(this.erc20.address);
      await this.splitterCustom.setParent(this.splitter.address);
    });
    it('Update child two', async function () {
      expect(await this.splitter.childOne()).to.eq(this.strategy.address);
      expect(await this.splitter.childTwo()).to.eq(this.strategy2.address);

      this.t0 = await meta(this.splitter.connect(this.s2).updateChild(this.splitterCustom.address));

      expect(this.t0.events.length).to.eq(1);
      expect(this.t0.events[0].event).to.eq('ChildTwoUpdate');
      expect(this.t0.events[0].args.previous).to.eq(this.strategy2.address);
      expect(this.t0.events[0].args.current).to.eq(this.splitterCustom.address);

      expect(await this.splitter.childOne()).to.eq(this.strategy.address);
      expect(await this.splitter.childTwo()).to.eq(this.splitterCustom.address);
    });
    it('Update child two again', async function () {
      await expect(
        this.splitter.connect(this.s2).updateChild(this.splitterCustom.address),
      ).to.be.revertedWith('SenderNotChild()');
    });
  });
  describe('childRemoved()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.strategyC.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.strategyC.address, '0x100000000000000000000000000'],
      });
      this.s = await ethers.provider.getSigner(this.strategyC.address);

      await this.strategyC.setParent(this.splitter.address);
      await this.strategyC.setCore(this.core.address);
      await this.strategyC.setWant(this.erc20.address);
      await this.strategyC.setSetupCompleted(true);

      await this.strategyC2.setParent(this.splitter.address);
      await this.strategyC2.setCore(this.core.address);
      await this.strategyC2.setWant(this.erc20.address);
      await this.strategyC2.setSetupCompleted(true);
    });
    it('Self not completed', async function () {
      await expect(this.splitter.childRemoved()).to.be.revertedWith(
        'SetupNotCompleted("' + this.splitter.address + '")',
      );
    });
    it('Invalid sender', async function () {
      await this.splitter.setInitialChildOne(this.strategyC.address);
      await this.splitter.setInitialChildTwo(this.strategyC2.address);

      await expect(this.splitter.childRemoved()).to.be.revertedWith('SenderNotChild()');
    });
    it('ChildOne removed', async function () {
      await this.master.setInitialChildOne(this.splitter.address);

      expect(await this.strategyC2.siblingRemovedCalled()).to.eq(0);

      await this.strategyC2.setParent(this.master.address);
      expect(await this.master.childOne()).to.eq(this.splitter.address);

      this.t0 = await meta(this.splitter.connect(this.s).childRemoved());

      expect(await this.master.childOne()).to.eq(this.strategyC2.address);
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[1].event).to.eq('Obsolete');
      expect(this.t0.events[1].args.implementation).to.eq(this.strategyC.address);
      expect(this.t0.events[2].event).to.eq('Obsolete');
      expect(this.t0.events[2].args.implementation).to.eq(this.splitter.address);

      expect(await this.strategyC2.siblingRemovedCalled()).to.eq(1);
    });
  });
  describe('childRemoved(), child two', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [this.strategyC2.address],
      });
      await timeTraveler.request({
        method: 'hardhat_setBalance',
        params: [this.strategyC2.address, '0x100000000000000000000000000'],
      });
      this.s2 = await ethers.provider.getSigner(this.strategyC2.address);

      await this.strategyC.setParent(this.splitter.address);
      await this.strategyC.setCore(this.core.address);
      await this.strategyC.setWant(this.erc20.address);
      await this.strategyC.setSetupCompleted(true);

      await this.strategyC2.setParent(this.splitter.address);
      await this.strategyC2.setCore(this.core.address);
      await this.strategyC2.setWant(this.erc20.address);
      await this.strategyC2.setSetupCompleted(true);

      await this.splitter.setInitialChildOne(this.strategyC.address);
      await this.splitter.setInitialChildTwo(this.strategyC2.address);
      await this.master.setInitialChildOne(this.splitter.address);
    });

    it('ChildTwo removed', async function () {
      expect(await this.strategyC.siblingRemovedCalled()).to.eq(0);

      await this.strategyC.setParent(this.master.address);
      expect(await this.master.childOne()).to.eq(this.splitter.address);

      this.t0 = await meta(this.splitter.connect(this.s2).childRemoved());

      expect(await this.master.childOne()).to.eq(this.strategyC.address);

      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[1].event).to.eq('Obsolete');
      expect(this.t0.events[1].args.implementation).to.eq(this.strategyC2.address);
      expect(this.t0.events[2].event).to.eq('Obsolete');
      expect(this.t0.events[2].args.implementation).to.eq(this.splitter.address);

      expect(await this.strategyC.siblingRemovedCalled()).to.eq(1);
    });
  });
  describe('setInitialChildTwo()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(
        this.splitter.connect(this.carol).setInitialChildTwo(this.alice.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero argument', async function () {
      await expect(this.splitter.setInitialChildTwo(constants.AddressZero)).to.be.revertedWith(
        'ZeroArg()',
      );
    });
    // TODO test all other edge cases? Uses same underlying function  as updateChild (_verifySetChild)
    it('Not setup', async function () {
      await expect(
        this.splitter.setInitialChildTwo(this.splitterCustom.address),
      ).to.be.revertedWith('SetupNotCompleted("' + this.splitterCustom.address + '")');
    });
    it('Set', async function () {
      await this.splitter.setInitialChildTwo(this.strategy.address);

      await expect(this.splitter.setInitialChildTwo(this.strategy.address)).to.be.revertedWith(
        'InvalidState()',
      );
    });
  });
  describe('withdrawAllByAdmin()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.splitter.connect(this.bob).withdrawAllByAdmin()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do', async function () {
      await expect(this.splitter.withdrawAllByAdmin()).to.be.revertedWith(
        'NotImplemented("' +
          (await this.splitter.interface.getSighash('withdrawAllByAdmin()')) +
          '")',
      );
    });
  });
  describe('withdrawByAdmin()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.splitter.connect(this.bob).withdrawByAdmin(1)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Do', async function () {
      await expect(this.splitter.withdrawByAdmin(1)).to.be.revertedWith(
        'NotImplemented("' +
          (await this.splitter.interface.getSighash('withdrawByAdmin(uint256)')) +
          '")',
      );
    });
  });
  describe('balanceOf()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.splitter.setInitialChildOne(this.strategy.address);
      await this.splitter.setInitialChildTwo(this.strategy2.address);
    });
    it('Default', async function () {
      expect(await this.splitter.balanceOf()).to.eq(0);
    });
    it('Single balance', async function () {
      await this.erc20.transfer(this.strategy.address, parseUnits('100', 6));
      expect(await this.splitter.balanceOf()).to.eq(parseUnits('100', 6));
    });
    it('Double balance', async function () {
      await this.erc20.transfer(this.strategy2.address, parseUnits('100', 6));
      expect(await this.splitter.balanceOf()).to.eq(parseUnits('200', 6));
    });
  });
});
describe('BaseStrategy', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);
    // deploy master strategy
    // set EOA as owner and sherlock core

    await prepare(this, [
      'InfoStorage',
      'MasterStrategy',
      'TreeSplitterMock',
      'TreeSplitterMockCustom',
      'TreeStrategyMock',
      'TreeStrategyMockCustom',
      'ERC20Mock6d',
    ]);

    // mare this.core a proxy for this.bob
    this.core = this.bob;

    await deploy(this, [['erc20', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);

    await deploy(this, [['splitterCustom', this.TreeSplitterMockCustom, []]]);
    // await this.splitterCustom.setParent(this.address);
    await this.splitterCustom.setCore(this.core.address);
    await this.splitterCustom.setWant(this.erc20.address);

    await deploy(this, [['strategy', this.TreeStrategyMock, [this.splitterCustom.address]]]);
    await deploy(this, [['strategyCustom', this.TreeStrategyMockCustom, []]]);

    await timeTraveler.snapshot();
  });
  describe('pause()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.connect(this.carol).pause()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('unpause()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.connect(this.carol).unpause()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('remove()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(this.strategy.connect(this.carol).remove()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
    it('Invalid balance', async function () {
      await this.erc20.transfer(this.strategy.address, 1);
      await this.strategy.setNotWithdraw(true);

      await expect(this.strategy.connect(this.alice).remove()).to.be.revertedWith(
        'NonZeroBalance()',
      );
    });
    it('Do', async function () {
      await this.strategy.setNotWithdraw(false);

      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(0);
      expect(await this.splitterCustom.childRemovedCalled()).to.eq(0);

      this.t0 = await meta(this.strategy.connect(this.alice).remove());

      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(1);
      expect(await this.splitterCustom.childRemovedCalled()).to.eq(1);
    });
  });
  describe('replace()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(
        this.strategy.connect(this.carol).replace(constants.AddressZero),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero arg', async function () {
      await expect(
        this.strategy.connect(this.alice).replace(constants.AddressZero),
      ).to.be.revertedWith('ZeroArg()');
    });
    it('Invalid balance', async function () {
      await this.erc20.transfer(this.strategy.address, 1);
      await this.strategy.setNotWithdraw(true);

      await expect(
        this.strategy.connect(this.alice).replace(this.strategyCustom.address),
      ).to.be.revertedWith('NonZeroBalance()');
    });
    it('Do', async function () {
      await this.strategy.setNotWithdraw(false);

      await this.strategyCustom.setSetupCompleted(true);
      await this.strategyCustom.setParent(this.splitterCustom.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);

      expect(await this.splitterCustom.updateChildCalled()).to.eq(constants.AddressZero);
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(0);

      await this.strategy.connect(this.alice).replace(this.strategyCustom.address);

      expect(await this.splitterCustom.updateChildCalled()).to.eq(this.strategyCustom.address);
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(1);
    });
  });
  describe('replaceForce()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Invalid sender', async function () {
      await expect(
        this.strategy.connect(this.carol).replaceForce(constants.AddressZero),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
    it('Zero arg', async function () {
      await expect(
        this.strategy.connect(this.alice).replaceForce(constants.AddressZero),
      ).to.be.revertedWith('ZeroArg()');
    });
    it('Do', async function () {
      await this.strategyCustom.setSetupCompleted(true);
      await this.strategyCustom.setParent(this.splitterCustom.address);
      await this.strategyCustom.setCore(this.core.address);
      await this.strategyCustom.setWant(this.erc20.address);

      expect(await this.splitterCustom.updateChildCalled()).to.eq(constants.AddressZero);
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(0);

      this.t0 = await meta(
        this.strategy.connect(this.alice).replaceForce(this.strategyCustom.address),
      );
      expect(this.t0.events.length).to.eq(3);
      expect(this.t0.events[2].event).to.eq('ForceReplace');

      expect(await this.splitterCustom.updateChildCalled()).to.eq(this.strategyCustom.address);
      expect(await this.strategy.internalWithdrawAllCalled()).to.eq(0);
    });
  });
});
