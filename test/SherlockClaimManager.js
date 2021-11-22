const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id, formatBytes32String, toUtf8Bytes } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);
const days7 = 60 * 60 * 24 * 7;
const year2035timestamp = 2079361524;

const UMA_ADDRESS = '0xeE3Afe347D5C74317041E2618C49534dAf887c24';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const SHERLOCK_IDENTIFIER = formatBytes32String(
  ethers.utils.hexlify(ethers.utils.toUtf8Bytes('SHERLOCK_CLAIM')),
);

describe.only('SherlockClaimManager ─ Stateless', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['SherlockClaimManagerTest']);

    this.umaho = this.carol;
    this.spcc = this.gov;

    await deploy(this, [
      ['scm', this.SherlockClaimManagerTest, [this.umaho.address, this.spcc.address]],
    ]);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [UMA_ADDRESS],
    });
    await timeTraveler.request({
      method: 'hardhat_setBalance',
      params: [UMA_ADDRESS, '0x100000000000000000000000000'],
    });

    this.uma = await ethers.provider.getSigner(UMA_ADDRESS);
  });
  describe('startClaim()', function () {
    it('Zero protocol', async function () {
      await expect(
        this.scm.startClaim(constants.HashZero, 1, this.bob.address, 1, '0x1213'),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero amount', async function () {
      await expect(
        this.scm.startClaim(id('x'), 0, this.bob.address, 1, '0x1213'),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero receiver', async function () {
      await expect(
        this.scm.startClaim(id('x'), 1, constants.AddressZero, 1, '0x1213'),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero timestamp', async function () {
      await expect(
        this.scm.startClaim(id('x'), 1, this.bob.address, 0, '0x1213'),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Too high timestamp', async function () {
      await expect(
        this.scm.startClaim(id('x'), 1, this.bob.address, year2035timestamp, '0x1213'),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Zero data length', async function () {
      await expect(this.scm.startClaim(id('x'), 1, this.bob.address, 1, '0x')).to.be.revertedWith(
        'ZeroArgument()',
      );
    });
    it('Core not set', async function () {
      await expect(
        this.scm.startClaim(id('x'), 1, this.bob.address, 1, '0x1213'),
      ).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('renounceUmaHaltOperator()', function () {
    it('Invalid sender', async function () {
      await expect(this.scm.connect(this.bob).renounceUmaHaltOperator()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
    });
  });
  describe('spccApprove()', function () {
    it('Invalid sender', async function () {
      await expect(this.scm.spccApprove(0)).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid claim', async function () {
      await expect(this.scm.connect(this.spcc).spccApprove(0)).to.be.revertedWith(
        'InvalidArgument()',
      );
      await expect(this.scm.connect(this.spcc).spccApprove(1)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
  });
  describe('spccRefuse()', function () {
    it('Invalid sender', async function () {
      await expect(this.scm.spccRefuse(0)).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid claim', async function () {
      await expect(this.scm.connect(this.spcc).spccRefuse(0)).to.be.revertedWith(
        'InvalidArgument()',
      );
      await expect(this.scm.connect(this.spcc).spccRefuse(1)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
  });
  describe('escalate()', function () {
    it('Invalid claim', async function () {
      await expect(this.scm.escalate(0)).to.be.revertedWith('InvalidArgument()');
      await expect(this.scm.escalate(1)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('payoutClaim()', function () {
    it('Invalid claim', async function () {
      await expect(this.scm.payoutClaim(0)).to.be.revertedWith('InvalidArgument()');
      await expect(this.scm.payoutClaim(1)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('executeHalt()', function () {
    it('Invalid sender', async function () {
      await expect(this.scm.executeHalt(0)).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid claim', async function () {
      await expect(this.scm.connect(this.umaho).executeHalt(0)).to.be.revertedWith(
        'InvalidArgument()',
      );
      await expect(this.scm.connect(this.umaho).executeHalt(1)).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
  });
  describe('priceProposed()', function () {
    it('Invalid sherlock identifier', async function () {
      await expect(
        this.scm.priceProposed(id('x'), 3, '0x3123', {
          proposer: this.bob.address,
          disputer: this.bob.address,
          currency: USDC_ADDRESS,
          settled: false,
          proposedPrice: parseEther('1'),
          resolvedPrice: parseEther('0'),
          expirationTime: parseEther('100'),
          reward: parseEther('50'),
          finalFee: parseEther('1'),
          bond: parseEther('10'),
          customLiveness: parseEther('10'),
        }),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Invalid sender', async function () {
      await expect(
        this.scm.priceProposed(SHERLOCK_IDENTIFIER, 3, '0x3123', {
          proposer: this.bob.address,
          disputer: this.bob.address,
          currency: USDC_ADDRESS,
          settled: false,
          proposedPrice: parseEther('1'),
          resolvedPrice: parseEther('0'),
          expirationTime: parseEther('100'),
          reward: parseEther('50'),
          finalFee: parseEther('1'),
          bond: parseEther('10'),
          customLiveness: parseEther('10'),
        }),
      ).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid claim', async function () {
      await expect(
        this.scm.connect(this.uma).priceProposed(SHERLOCK_IDENTIFIER, 3, '0x', {
          proposer: constants.AddressZero,
          disputer: constants.AddressZero,
          currency: constants.AddressZero,
          settled: false,
          proposedPrice: 0,
          resolvedPrice: 0,
          expirationTime: 0,
          reward: 0,
          finalFee: 0,
          bond: 0,
          customLiveness: 0,
        }),
      ).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('priceDisputed()', function () {
    it('Invalid sherlock identifier', async function () {
      await expect(
        this.scm.priceDisputed(id('x'), 3, '0x3123', {
          proposer: this.bob.address,
          disputer: this.bob.address,
          currency: USDC_ADDRESS,
          settled: false,
          proposedPrice: parseEther('1'),
          resolvedPrice: parseEther('0'),
          expirationTime: parseEther('100'),
          reward: parseEther('50'),
          finalFee: parseEther('1'),
          bond: parseEther('10'),
          customLiveness: parseEther('10'),
        }),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Invalid sender', async function () {
      await expect(
        this.scm.priceDisputed(SHERLOCK_IDENTIFIER, 3, '0x3123', {
          proposer: this.bob.address,
          disputer: this.bob.address,
          currency: USDC_ADDRESS,
          settled: false,
          proposedPrice: parseEther('1'),
          resolvedPrice: parseEther('0'),
          expirationTime: parseEther('100'),
          reward: parseEther('50'),
          finalFee: parseEther('1'),
          bond: parseEther('10'),
          customLiveness: parseEther('10'),
        }),
      ).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid claim', async function () {
      await expect(
        this.scm.connect(this.uma).priceDisputed(SHERLOCK_IDENTIFIER, 3, '0x', {
          proposer: constants.AddressZero,
          disputer: constants.AddressZero,
          currency: constants.AddressZero,
          settled: false,
          proposedPrice: 0,
          resolvedPrice: 0,
          expirationTime: 0,
          reward: 0,
          finalFee: 0,
          bond: 0,
          customLiveness: 0,
        }),
      ).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('priceSettled()', function () {
    it('Invalid sherlock identifier', async function () {
      await expect(
        this.scm.priceSettled(id('x'), 3, '0x3123', {
          proposer: this.bob.address,
          disputer: this.bob.address,
          currency: USDC_ADDRESS,
          settled: false,
          proposedPrice: parseEther('1'),
          resolvedPrice: parseEther('0'),
          expirationTime: parseEther('100'),
          reward: parseEther('50'),
          finalFee: parseEther('1'),
          bond: parseEther('10'),
          customLiveness: parseEther('10'),
        }),
      ).to.be.revertedWith('InvalidArgument()');
    });
    it('Invalid sender', async function () {
      await expect(
        this.scm.priceSettled(SHERLOCK_IDENTIFIER, 3, '0x3123', {
          proposer: this.bob.address,
          disputer: this.bob.address,
          currency: USDC_ADDRESS,
          settled: false,
          proposedPrice: parseEther('1'),
          resolvedPrice: parseEther('0'),
          expirationTime: parseEther('100'),
          reward: parseEther('50'),
          finalFee: parseEther('1'),
          bond: parseEther('10'),
          customLiveness: parseEther('10'),
        }),
      ).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid state, but approved', async function () {
      await expect(
        this.scm.connect(this.uma).priceSettled(SHERLOCK_IDENTIFIER, 3, '0x', {
          proposer: constants.AddressZero,
          disputer: constants.AddressZero,
          currency: constants.AddressZero,
          settled: false,
          proposedPrice: 0,
          resolvedPrice: 0,
          expirationTime: 0,
          reward: 0,
          finalFee: 0,
          bond: 0,
          customLiveness: 0,
        }),
      ).to.be.revertedWith('InvalidState()');
    });
    it('Invalid state, but denied', async function () {
      await expect(
        this.scm.connect(this.uma).priceSettled(SHERLOCK_IDENTIFIER, 3, '0x', {
          proposer: constants.AddressZero,
          disputer: constants.AddressZero,
          currency: constants.AddressZero,
          settled: false,
          proposedPrice: 0,
          resolvedPrice: 1,
          expirationTime: 0,
          reward: 0,
          finalFee: 0,
          bond: 0,
          customLiveness: 0,
        }),
      ).to.be.revertedWith('InvalidState()');
    });
  });
});
