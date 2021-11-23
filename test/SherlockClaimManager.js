const { expect } = require('chai');
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
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id, formatBytes32String, keccak256 } = require('ethers/lib/utils');

const maxTokens = parseUnits('1000000', 6);
const days7 = 60 * 60 * 24 * 7;
const days3 = 60 * 60 * 24 * 3;
const year2035timestamp = 2079361524;

const UMA_ADDRESS = '0xeE3Afe347D5C74317041E2618C49534dAf887c24';
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const UMA_IDENTIFIER = '0x534845524c4f434b5f434c41494d000000000000000000000000000000000000';
const COVERAGE_AMOUNT = parseUnits('100', 6);

const STATE = {
  NonExistent: 0,
  SpccPending: 1,
  SpccApproved: 2,
  SpccDenied: 3,
  UmaPriceProposed: 4,
  ReadyToProposeUmaDispute: 5,
  UmaDisputeProposed: 6,
  UmaPending: 7,
  UmaApproved: 8,
  UmaDenied: 9,
};

describe('SherlockClaimManager ─ Stateless', function () {
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
  describe('constructor', function () {
    it('Zero umaho', async function () {
      await expect(
        this.SherlockClaimManagerTest.deploy(constants.AddressZero, this.alice.address),
      ).to.be.revertedWith('ZeroArgument()');
    });
    it('Zero spcc', async function () {
      await expect(
        this.SherlockClaimManagerTest.deploy(this.alice.address, constants.AddressZero),
      ).to.be.revertedWith('ZeroArgument()');
    });
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
      await expect(this.scm.escalate(0, parseUnits('50000001', 6))).to.be.revertedWith(
        'InvalidArgument()',
      );
      await expect(this.scm.escalate(1, parseUnits('50000001', 6))).to.be.revertedWith(
        'InvalidArgument()',
      );
    });
    it('Invalid amount', async function () {
      await expect(this.scm.escalate(0, parseUnits('4999', 6))).to.be.revertedWith(
        'InvalidArgument()',
      );
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
        this.scm.priceProposed(UMA_IDENTIFIER, 3, '0x3123', {
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
        this.scm.connect(this.uma).priceProposed(UMA_IDENTIFIER, 3, '0x', {
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
        this.scm.priceDisputed(UMA_IDENTIFIER, 3, '0x3123', {
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
        this.scm.connect(this.uma).priceDisputed(UMA_IDENTIFIER, 3, '0x', {
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
        this.scm.priceSettled(UMA_IDENTIFIER, 3, '0x3123', {
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
        this.scm.connect(this.uma).priceSettled(UMA_IDENTIFIER, 3, '0x', {
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
        this.scm.connect(this.uma).priceSettled(UMA_IDENTIFIER, 3, '0x', {
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

describe('SherlockClaimManager ─ Functional', function () {
  before(async function () {
    await fork(13671132);

    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['SherlockClaimManagerTest', 'Sherlock', 'SherlockProtocolManager']);

    this.umaho = this.carol;
    this.spcc = this.gov;

    await deploy(this, [
      ['scm', this.SherlockClaimManagerTest, [this.umaho.address, this.spcc.address]],
      ['spm', this.SherlockProtocolManager, [USDC_ADDRESS]],
    ]);

    await deploy(this, [
      [
        'sherlock',
        this.Sherlock,
        [
          USDC_ADDRESS,
          USDC_ADDRESS,
          'test',
          'tst',
          this.alice.address,
          constants.AddressZero,
          this.alice.address,
          this.spm.address,
          this.scm.address,
          [1000],
        ],
      ],
    ]);
    await this.scm.setSherlockCoreAddress(this.sherlock.address);
    await this.spm.setSherlockCoreAddress(this.sherlock.address);

    await this.spm.protocolAdd(this.protocolX, this.carol.address, id('x'), 0, COVERAGE_AMOUNT);
    await this.spm.protocolAdd(this.protocolY, this.carol.address, id('x'), 0, COVERAGE_AMOUNT);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: [UMA_ADDRESS],
    });
    await timeTraveler.request({
      method: 'hardhat_setBalance',
      params: [UMA_ADDRESS, '0x100000000000000000000000000'],
    });

    this.uma = await ethers.provider.getSigner(UMA_ADDRESS);

    this.usdc = await ethers.getContractAt('ERC20', USDC_ADDRESS);
    this.mintUSDC = async (target, amount) => {
      const usdcWhaleAddress = '0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0';
      await timeTraveler.request({
        method: 'hardhat_impersonateAccount',
        params: [usdcWhaleAddress],
      });
      const usdcWhale = await ethers.provider.getSigner(usdcWhaleAddress);
      await this.usdc.connect(usdcWhale).transfer(target, amount);
    };
    this.umaOracleInstance = await ethers.getContractAt(
      'SkinnyOptimisticOracleInterface',
      UMA_ADDRESS,
    );

    await this.mintUSDC(this.alice.address, maxTokens);
    await this.usdc.approve(this.sherlock.address, maxTokens);
    this.lastT = await meta(this.sherlock.initialStake(maxTokens, 1000, this.alice.address));

    await timeTraveler.snapshot();
  });
  describe('startClaim(), active', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');
    });
    it('Do', async function () {
      await expect(
        this.scm.connect(this.carol).startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212'),
      ).to.be.revertedWith('ClaimActive()');
    });
  });
  describe('startClaim(), similair data, different protocol', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');
    });
    it('Do', async function () {
      await expect(
        this.scm.connect(this.carol).startClaim(this.protocolY, 1, this.alice.address, 1, '0x1212'),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('startClaim(), invalid sender', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await expect(
        this.scm.startClaim(this.protocolY, 1, this.alice.address, 1, '0x1212'),
      ).to.be.revertedWith('InvalidSender()');
    });
  });
  describe('startClaim(), exceed max', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await expect(
        this.scm
          .connect(this.carol)
          .startClaim(this.protocolY, COVERAGE_AMOUNT.add(1), this.alice.address, 1, '0x1212'),
      ).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('startClaim()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      this.internalIdentifier = keccak256('0x1212');
      expect(await this.scm.viewLastClaimID()).to.eq(0);
      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(false);
      expect(await this.scm.viewPublicToInternalID(1)).to.eq(constants.HashZero);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(0);
      const claim = await this.scm.viewClaims(this.internalIdentifier);
      expect(claim[0]).to.eq(0);
      expect(claim[1]).to.eq(0);
      expect(claim[2]).to.eq(constants.AddressZero);
      expect(claim[3]).to.eq(constants.HashZero);
      expect(claim[4]).to.eq(0);
      expect(claim[5]).to.eq(constants.AddressZero);
      expect(claim[6]).to.eq(0);
      expect(claim[7]).to.eq('0x');
      expect(claim[8]).to.eq(STATE.NonExistent);
      await expect(this.scm.claims(1)).to.be.revertedWith('InvalidArgument');
    });
    it('Do', async function () {
      this.t1 = await meta(
        this.scm.connect(this.carol).startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212'),
      );

      expect(this.t1.events.length).to.eq(2);
      expect(this.t1.events[0].event).to.eq('ClaimCreated');
      expect(this.t1.events[0].args.claimID).to.eq(1);
      expect(this.t1.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[0].args.amount).to.eq(1);
      expect(this.t1.events[0].args.receiver).to.eq(this.alice.address);
      expect(this.t1.events[0].args.previousCoverageAmount).to.eq(false);
      expect(this.t1.events[1].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[1].args.claimID).to.eq(1);
      expect(this.t1.events[1].args.previousState).to.eq(STATE.NonExistent);
      expect(this.t1.events[1].args.currentState).to.eq(STATE.SpccPending);
    });
    it('Verify state', async function () {
      expect(await this.scm.viewLastClaimID()).to.eq(1);
      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
      expect(await this.scm.viewPublicToInternalID(1)).to.eq(this.internalIdentifier);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(1);
      const claim = await this.scm.viewClaims(this.internalIdentifier);
      expect(claim[0]).to.eq(this.t1.time);
      expect(claim[1]).to.eq(this.t1.time);
      expect(claim[2]).to.eq(this.carol.address);
      expect(claim[3]).to.eq(this.protocolX);
      expect(claim[4]).to.eq(1);
      expect(claim[5]).to.eq(this.alice.address);
      expect(claim[6]).to.eq(1);
      expect(claim[7]).to.eq('0x1212');
      expect(claim[8]).to.eq(STATE.SpccPending);
      const claim2 = await this.scm.claims(1);
      expect(claim2[0]).to.eq(this.t1.time);
    });
    it('Do again', async function () {
      this.internalIdentifier2 = keccak256('0x121212');
      this.t2 = await meta(
        this.scm
          .connect(this.carol)
          .startClaim(this.protocolY, 1, this.alice.address, 1, '0x121212'),
      );

      expect(this.t2.events.length).to.eq(2);
      expect(this.t2.events[0].event).to.eq('ClaimCreated');
      expect(this.t2.events[0].args.claimID).to.eq(2);
      expect(this.t2.events[0].args.protocol).to.eq(this.protocolY);
      expect(this.t2.events[0].args.amount).to.eq(1);
      expect(this.t2.events[0].args.receiver).to.eq(this.alice.address);
      expect(this.t2.events[0].args.previousCoverageAmount).to.eq(false);
      expect(this.t2.events[1].event).to.eq('ClaimStatusChanged');
      expect(this.t2.events[1].args.claimID).to.eq(2);
      expect(this.t2.events[1].args.previousState).to.eq(STATE.NonExistent);
      expect(this.t2.events[1].args.currentState).to.eq(STATE.SpccPending);
    });
    it('Verify claim state', async function () {
      expect(await this.scm.viewLastClaimID()).to.eq(2);
      expect(await this.scm.protocolClaimActive(this.protocolY)).to.eq(true);
      expect(await this.scm.viewPublicToInternalID(2)).to.eq(this.internalIdentifier2);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier2)).to.eq(2);
      const claim = await this.scm.viewClaims(this.internalIdentifier2);
      expect(claim[0]).to.eq(this.t2.time);
      expect(claim[1]).to.eq(this.t2.time);
      expect(claim[2]).to.eq(this.carol.address);
      expect(claim[3]).to.eq(this.protocolY);
      expect(claim[4]).to.eq(1);
      expect(claim[5]).to.eq(this.alice.address);
      expect(claim[6]).to.eq(1);
      expect(claim[7]).to.eq('0x121212');
      expect(claim[8]).to.eq(STATE.SpccPending);
      const claim2 = await this.scm.claims(2);
      expect(claim2[0]).to.eq(this.t2.time);
    });
    it('Verify old claim state', async function () {
      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
      expect(await this.scm.viewPublicToInternalID(1)).to.eq(this.internalIdentifier);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(1);
      const claim = await this.scm.viewClaims(this.internalIdentifier);
      expect(claim[0]).to.eq(this.t1.time);
      expect(claim[1]).to.eq(this.t1.time);
      expect(claim[2]).to.eq(this.carol.address);
      expect(claim[3]).to.eq(this.protocolX);
      expect(claim[4]).to.eq(1);
      expect(claim[5]).to.eq(this.alice.address);
      expect(claim[6]).to.eq(1);
      expect(claim[7]).to.eq('0x1212');
      expect(claim[8]).to.eq(STATE.SpccPending);
      const claim2 = await this.scm.claims(1);
      expect(claim2[0]).to.eq(this.t1.time);
    });
  });
  describe('startClaim(), old coverage amount', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.spm.protocolUpdate(this.protocolX, id('x'), 0, COVERAGE_AMOUNT.div(2));
    });
    it('Initial state', async function () {
      this.internalIdentifier = keccak256('0x1212');
      expect(await this.scm.viewLastClaimID()).to.eq(0);
      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(false);
      expect(await this.scm.viewPublicToInternalID(1)).to.eq(constants.HashZero);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(0);
      const claim = await this.scm.viewClaims(this.internalIdentifier);
      expect(claim[0]).to.eq(0);
      expect(claim[1]).to.eq(0);
      expect(claim[2]).to.eq(constants.AddressZero);
      expect(claim[3]).to.eq(constants.HashZero);
      expect(claim[4]).to.eq(0);
      expect(claim[5]).to.eq(constants.AddressZero);
      expect(claim[6]).to.eq(0);
      expect(claim[7]).to.eq('0x');
      expect(claim[8]).to.eq(STATE.NonExistent);
      await expect(this.scm.claims(1)).to.be.revertedWith('InvalidArgument');
    });
    it('Do', async function () {
      this.t1 = await meta(
        this.scm
          .connect(this.carol)
          .startClaim(this.protocolX, COVERAGE_AMOUNT, this.alice.address, 1, '0x1212'),
      );

      expect(this.t1.events.length).to.eq(2);
      expect(this.t1.events[0].event).to.eq('ClaimCreated');
      expect(this.t1.events[0].args.claimID).to.eq(1);
      expect(this.t1.events[0].args.protocol).to.eq(this.protocolX);
      expect(this.t1.events[0].args.amount).to.eq(COVERAGE_AMOUNT);
      expect(this.t1.events[0].args.receiver).to.eq(this.alice.address);
      expect(this.t1.events[0].args.previousCoverageAmount).to.eq(true);
      expect(this.t1.events[1].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[1].args.claimID).to.eq(1);
      expect(this.t1.events[1].args.previousState).to.eq(STATE.NonExistent);
      expect(this.t1.events[1].args.currentState).to.eq(STATE.SpccPending);
    });
    it('Verify state', async function () {
      expect(await this.scm.viewLastClaimID()).to.eq(1);
      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
      expect(await this.scm.viewPublicToInternalID(1)).to.eq(this.internalIdentifier);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(1);
      const claim = await this.scm.viewClaims(this.internalIdentifier);
      expect(claim[0]).to.eq(this.t1.time);
      expect(claim[1]).to.eq(this.t1.time);
      expect(claim[2]).to.eq(this.carol.address);
      expect(claim[3]).to.eq(this.protocolX);
      expect(claim[4]).to.eq(COVERAGE_AMOUNT);
      expect(claim[5]).to.eq(this.alice.address);
      expect(claim[6]).to.eq(1);
      expect(claim[7]).to.eq('0x1212');
      expect(claim[8]).to.eq(STATE.SpccPending);
      const claim2 = await this.scm.claims(1);
      expect(claim2[0]).to.eq(this.t1.time);
    });
  });
  describe('renounceUmaHaltOperator()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.scm.umaHaltOperator()).to.eq(this.umaho.address);
    });
    it('Do', async function () {
      this.t1 = await meta(this.scm.renounceUmaHaltOperator());

      expect(this.t1.events.length).to.eq(1);
      expect(this.t1.events[0].event).to.eq('UMAHORenounced');
    });
    it('Verify state', async function () {
      expect(await this.scm.umaHaltOperator()).to.eq(constants.AddressZero);
    });
    it('Do again', async function () {
      await expect(this.scm.renounceUmaHaltOperator()).to.be.revertedWith('InvalidConditions()');
    });
  });
  describe('spccApprove()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');
    });
    it('Initial state', async function () {
      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.SpccPending);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
    it('Do', async function () {
      this.t1 = await meta(this.scm.connect(this.spcc).spccApprove(1));

      expect(this.t1.events.length).to.eq(1);
      expect(this.t1.events[0].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[0].args.claimID).to.eq(1);
      expect(this.t1.events[0].args.previousState).to.eq(STATE.SpccPending);
      expect(this.t1.events[0].args.currentState).to.eq(STATE.SpccApproved);
    });
    it('Verify state', async function () {
      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.SpccApproved);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
    it('Do again', async function () {
      await expect(this.scm.connect(this.spcc).spccApprove(1)).to.be.revertedWith('InvalidState()');
    });
  });
  describe('spccRefuse()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');
    });
    it('Initial state', async function () {
      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.SpccPending);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
    it('Do', async function () {
      this.t1 = await meta(this.scm.connect(this.spcc).spccRefuse(1));

      expect(this.t1.events.length).to.eq(1);
      expect(this.t1.events[0].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[0].args.claimID).to.eq(1);
      expect(this.t1.events[0].args.previousState).to.eq(STATE.SpccPending);
      expect(this.t1.events[0].args.currentState).to.eq(STATE.SpccDenied);
    });
    it('Verify state', async function () {
      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.SpccDenied);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
    it('Do again', async function () {
      await expect(this.scm.connect(this.spcc).spccRefuse(1)).to.be.revertedWith('InvalidState()');
    });
  });
  describe('escalate(), invalid sender', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');

      await this.scm.connect(this.spcc).spccRefuse(1);
    });
    it('Do', async function () {
      await expect(this.scm.escalate(1, parseUnits('5000', 6))).to.be.revertedWith(
        'InvalidSender()',
      );
    });
  });
  describe('escalate(), invalid state, pending no delay', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');
    });
    it('Do', async function () {
      await expect(
        this.scm.connect(this.carol).escalate(1, parseUnits('5000', 6)),
      ).to.be.revertedWith('InvalidState()');
    });
  });
  describe('escalate(), denied by spcc', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');

      await this.scm.connect(this.spcc).spccRefuse(1);

      this.usdcAmount = parseUnits('20000', 6);
      await this.mintUSDC(this.carol.address, this.usdcAmount);

      await this.usdc.connect(this.carol).approve(this.scm.address, this.usdcAmount);
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.carol.address)).to.eq(parseUnits('20000', 6));

      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.SpccDenied);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
    it('Do', async function () {
      this.t1 = await meta(this.scm.connect(this.carol).escalate(1, this.usdcAmount));

      // pre uma interaction
      expect(this.t1.events.length).to.eq(16);
      expect(this.t1.events[0].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[0].args.claimID).to.eq(1);
      expect(this.t1.events[0].args.previousState).to.eq(STATE.SpccDenied);
      expect(this.t1.events[0].args.currentState).to.eq(STATE.UmaPriceProposed);

      // on UMA request and propose price for
      expect(this.t1.events[4].address).to.eq(UMA_ADDRESS);
      this.t1.events[4] = this.umaOracleInstance.interface.parseLog(this.t1.events[4]);
      expect(this.t1.events[4].name).to.eq('RequestPrice');
      expect(this.t1.events[4].args.requester).to.eq(this.scm.address);
      expect(this.t1.events[4].args.identifier).to.eq(UMA_IDENTIFIER);
      expect(this.t1.events[4].args.timestamp).to.eq(1);
      expect(this.t1.events[4].args.ancillaryData).to.eq('0x1212');
      const request = this.t1.events[4].args.request;
      expect(request.currency).to.eq(USDC_ADDRESS);
      expect(request.reward).to.eq(0);
      expect(request.finalFee).to.eq(parseUnits('400', 6));
      expect(request.bond).to.eq(parseUnits('5000', 6));
      expect(request.customLiveness).to.eq(7200);
      expect(request.proposer).to.eq(this.sherlock.address);
      expect(request.proposedPrice).to.eq(0);
      expect(request.expirationTime).to.eq(this.t1.time.add(7200));
      expect(request.disputer).to.eq(constants.AddressZero);
      expect(request.settled).to.eq(false);
      expect(request.resolvedPrice).to.eq(0);

      expect(this.t1.events[5].address).to.eq(UMA_ADDRESS);
      this.t1.events[5] = this.umaOracleInstance.interface.parseLog(this.t1.events[5]);
      expect(this.t1.events[5].name).to.eq('ProposePrice');
      expect(this.t1.events[5].args.requester).to.eq(this.scm.address);
      expect(this.t1.events[5].args.identifier).to.eq(UMA_IDENTIFIER);
      expect(this.t1.events[5].args.timestamp).to.eq(1);
      expect(this.t1.events[5].args.ancillaryData).to.eq('0x1212');
      const request2 = this.t1.events[4].args.request;
      expect(request2.currency).to.eq(USDC_ADDRESS);
      expect(request2.reward).to.eq(0);
      expect(request2.finalFee).to.eq(parseUnits('400', 6));
      expect(request2.bond).to.eq(parseUnits('5000', 6));
      expect(request2.customLiveness).to.eq(7200);
      expect(request2.proposer).to.eq(this.sherlock.address);
      expect(request2.proposedPrice).to.eq(0);
      expect(request2.expirationTime).to.eq(this.t1.time.add(7200));
      expect(request2.disputer).to.eq(constants.AddressZero);
      expect(request2.settled).to.eq(false);
      expect(request2.resolvedPrice).to.eq(0);

      // on request and propose callback
      expect(this.t1.events[6].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[6].args.claimID).to.eq(1);
      expect(this.t1.events[6].args.previousState).to.eq(STATE.UmaPriceProposed);
      expect(this.t1.events[6].args.currentState).to.eq(STATE.ReadyToProposeUmaDispute);

      // after initial uma interaction
      expect(this.t1.events[7].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[7].args.claimID).to.eq(1);
      expect(this.t1.events[7].args.previousState).to.eq(STATE.ReadyToProposeUmaDispute);
      expect(this.t1.events[7].args.currentState).to.eq(STATE.UmaDisputeProposed);

      // on UMA dispute price for
      expect(this.t1.events[12].address).to.eq(UMA_ADDRESS);
      this.t1.events[12] = this.umaOracleInstance.interface.parseLog(this.t1.events[12]);
      expect(this.t1.events[12].args.requester).to.eq(this.scm.address);
      expect(this.t1.events[12].args.identifier).to.eq(UMA_IDENTIFIER);
      expect(this.t1.events[12].args.timestamp).to.eq(1);
      expect(this.t1.events[12].args.ancillaryData).to.eq('0x1212');
      const request3 = this.t1.events[12].args.request;
      expect(request3.currency).to.eq(USDC_ADDRESS);
      expect(request3.reward).to.eq(0);
      expect(request3.finalFee).to.eq(parseUnits('400', 6));
      expect(request3.bond).to.eq(parseUnits('5000', 6));
      expect(request3.customLiveness).to.eq(7200);
      expect(request3.proposer).to.eq(this.sherlock.address);
      expect(request3.proposedPrice).to.eq(0);
      expect(request3.expirationTime).to.eq(this.t1.time.add(7200));
      expect(request3.disputer).to.eq(this.carol.address);
      expect(request3.settled).to.eq(false);
      expect(request3.resolvedPrice).to.eq(0);

      // On UMA dispute price for callback
      expect(this.t1.events[13].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[13].args.claimID).to.eq(1);
      expect(this.t1.events[13].args.previousState).to.eq(STATE.UmaDisputeProposed);
      expect(this.t1.events[13].args.currentState).to.eq(STATE.UmaPending);
    });
    it('Verify state', async function () {
      expect(await this.usdc.balanceOf(this.carol.address)).to.eq(parseUnits('9220', 6));

      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.UmaPending);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
  });
  describe('escalate(), valid state, pending yes delay', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      this.usdcAmount = parseUnits('20000', 6);
      await this.mintUSDC(this.carol.address, this.usdcAmount);
      await this.usdc.connect(this.carol).approve(this.scm.address, this.usdcAmount);

      await this.scm
        .connect(this.carol)
        .startClaim(this.protocolX, 1, this.alice.address, 1, '0x1212');

      await hre.network.provider.request({
        method: 'evm_increaseTime',
        params: [days7],
      });
      await timeTraveler.mine(1);
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.carol.address)).to.eq(parseUnits('20000', 6));

      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.SpccPending);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
    it('Do', async function () {
      await this.scm.connect(this.carol).escalate(1, this.usdcAmount);
    });
    it('Verify state', async function () {
      expect(await this.usdc.balanceOf(this.carol.address)).to.eq(parseUnits('9220', 6));

      const claim = await this.scm.claims(1);
      expect(claim[8]).to.eq(STATE.UmaPending);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);
    });
  });
  describe('payoutClaim(), by UMA, yes UMAHO', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      this.internalIdentifier = keccak256('0x1212');

      this.t0 = await meta(
        this.scm
          .connect(this.carol)
          .startClaim(this.protocolX, 1000, this.bob.address, 1, '0x1212'),
      );

      await this.scm.connect(this.spcc).spccRefuse(1);

      this.usdcAmount = parseUnits('20000', 6);
      await this.mintUSDC(this.carol.address, this.usdcAmount);
      await this.usdc.connect(this.carol).approve(this.scm.address, this.usdcAmount);

      this.t1 = await meta(this.scm.connect(this.carol).escalate(1, this.usdcAmount));
    });
    it('Invalid sender', async function () {
      await expect(this.scm.payoutClaim(1)).to.be.revertedWith('InvalidSender()');
    });
    it('Invalid state', async function () {
      await expect(this.scm.connect(this.carol).payoutClaim(1)).to.be.revertedWith(
        'InvalidState()',
      );

      this.t2 = await meta(
        this.scm.connect(this.uma).priceSettled(UMA_IDENTIFIER, 1, '0x1212', {
          proposer: this.sherlock.address,
          disputer: this.carol.address,
          currency: USDC_ADDRESS,
          settled: false,
          proposedPrice: BigNumber.from(0),
          resolvedPrice: BigNumber.from(1000),
          expirationTime: this.t1.time.add(7200),
          reward: BigNumber.from(0),
          finalFee: parseUnits('400', 6),
          bond: parseUnits('5000', 6),
          customLiveness: BigNumber.from(7200),
        }),
      );
    });
    it('Invalid state, uma time', async function () {
      await hre.network.provider.request({
        method: 'evm_increaseTime',
        params: [days3 - 10],
      });

      await expect(this.scm.connect(this.carol).payoutClaim(1)).to.be.revertedWith(
        'InvalidState()',
      );

      await timeTraveler.mine(10);
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.bob.address)).to.eq(0);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);

      expect(await this.scm.viewPublicToInternalID(1)).to.eq(this.internalIdentifier);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(1);

      const claim = await this.scm.claims(1);
      expect(claim[0]).to.eq(this.t0.time);
      expect(claim[1]).to.eq(this.t2.time);
      expect(claim[2]).to.eq(this.carol.address);
      expect(claim[3]).to.eq(this.protocolX);
      expect(claim[4]).to.eq(1000);
      expect(claim[5]).to.eq(this.bob.address);
      expect(claim[6]).to.eq(1);
      expect(claim[7]).to.eq('0x1212');
      expect(claim[8]).to.eq(STATE.UmaApproved);
    });
    it('Do', async function () {
      this.t1 = await meta(this.scm.connect(this.carol).payoutClaim(1));
      expect(this.t1.events.length).to.eq(4);
      expect(this.t1.events[0].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[0].args.claimID).to.eq(1);
      expect(this.t1.events[0].args.previousState).to.eq(STATE.UmaApproved);
      expect(this.t1.events[0].args.currentState).to.eq(STATE.NonExistent);
      expect(this.t1.events[1].event).to.eq('ClaimPayout');
      expect(this.t1.events[1].args.claimID).to.eq(1);
      expect(this.t1.events[1].args.receiver).to.eq(this.bob.address);
      expect(this.t1.events[1].args.amount).to.eq(1000);
    });
    it('Verify state', async function () {
      expect(await this.usdc.balanceOf(this.bob.address)).to.eq(1000);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(false);

      expect(await this.scm.viewPublicToInternalID(1)).to.eq(constants.HashZero);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(0);

      await expect(this.scm.claims(1)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('payoutClaim(), by SPCC, no UMAHO', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      this.internalIdentifier = keccak256('0x1212');

      await this.scm.renounceUmaHaltOperator();
      this.t0 = await meta(
        this.scm
          .connect(this.carol)
          .startClaim(this.protocolX, 1000, this.bob.address, 1, '0x1212'),
      );

      this.t1 = await meta(this.scm.connect(this.spcc).spccApprove(1));
    });
    it('Initial state', async function () {
      expect(await this.usdc.balanceOf(this.bob.address)).to.eq(0);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(true);

      expect(await this.scm.viewPublicToInternalID(1)).to.eq(this.internalIdentifier);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(1);

      const claim = await this.scm.claims(1);
      expect(claim[0]).to.eq(this.t0.time);
      expect(claim[1]).to.eq(this.t1.time);
      expect(claim[2]).to.eq(this.carol.address);
      expect(claim[3]).to.eq(this.protocolX);
      expect(claim[4]).to.eq(1000);
      expect(claim[5]).to.eq(this.bob.address);
      expect(claim[6]).to.eq(1);
      expect(claim[7]).to.eq('0x1212');
      expect(claim[8]).to.eq(STATE.SpccApproved);
    });
    it('Do', async function () {
      this.t1 = await meta(this.scm.connect(this.carol).payoutClaim(1));
      expect(this.t1.events.length).to.eq(4);
      expect(this.t1.events[0].event).to.eq('ClaimStatusChanged');
      expect(this.t1.events[0].args.claimID).to.eq(1);
      expect(this.t1.events[0].args.previousState).to.eq(STATE.SpccApproved);
      expect(this.t1.events[0].args.currentState).to.eq(STATE.NonExistent);
      expect(this.t1.events[1].event).to.eq('ClaimPayout');
      expect(this.t1.events[1].args.claimID).to.eq(1);
      expect(this.t1.events[1].args.receiver).to.eq(this.bob.address);
      expect(this.t1.events[1].args.amount).to.eq(1000);
    });
    it('Verify state', async function () {
      expect(await this.usdc.balanceOf(this.bob.address)).to.eq(1000);

      expect(await this.scm.protocolClaimActive(this.protocolX)).to.eq(false);

      expect(await this.scm.viewPublicToInternalID(1)).to.eq(constants.HashZero);
      expect(await this.scm.viewInternalToPublicID(this.internalIdentifier)).to.eq(0);

      await expect(this.scm.claims(1)).to.be.revertedWith('InvalidArgument()');
    });
  });
  describe('executeHalt()', function () {});
  describe('priceProposed()', function () {});
  describe('priceDisputed()', function () {});
  describe('priceSettled()', function () {});
  describe('isEscalateState() (private function)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Happy flows', async function () {
      expect(await this.scm.isEscalateState(STATE.SpccDenied, this.lastT.time)).to.eq(true);
      expect(await this.scm.isEscalateState(STATE.SpccDenied, 0)).to.eq(true);

      expect(await this.scm.isEscalateState(STATE.SpccPending, this.lastT.time.sub(days7))).to.eq(
        true,
      );
      expect(
        await this.scm.isEscalateState(STATE.SpccPending, this.lastT.time.sub(days7).sub(days7)),
      ).to.eq(true);
    });
    it('Sad flows', async function () {
      expect(await this.scm.isEscalateState(STATE.SpccApproved, this.lastT.time)).to.eq(false);
      expect(await this.scm.isEscalateState(STATE.NonExistent, 0)).to.eq(false);

      expect(await this.scm.isEscalateState(STATE.SpccPending, this.lastT.time.sub(days3))).to.eq(
        false,
      );
      expect(
        await this.scm.isEscalateState(STATE.SpccPending, this.lastT.time.sub(days3).sub(days3)),
      ).to.eq(false);
    });
  });
  describe('isPayoutState() (private function) -UMAHO', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.scm.renounceUmaHaltOperator();
    });
    it('Happy flows', async function () {
      expect(await this.scm.isPayoutState(STATE.SpccApproved, this.lastT.time)).to.eq(true);
      expect(await this.scm.isPayoutState(STATE.SpccApproved, 0)).to.eq(true);

      expect(await this.scm.isPayoutState(STATE.UmaApproved, this.lastT.time)).to.eq(true);
      expect(await this.scm.isPayoutState(STATE.UmaApproved, 0)).to.eq(true);
    });
    it('Sad flows', async function () {
      expect(await this.scm.isPayoutState(STATE.SpccDenied, this.lastT.time)).to.eq(false);
      expect(await this.scm.isPayoutState(STATE.SpccDenied, 0)).to.eq(false);

      expect(await this.scm.isPayoutState(STATE.UmaDenied, this.lastT.time)).to.eq(false);
      expect(await this.scm.isPayoutState(STATE.UmaDenied, 0)).to.eq(false);

      expect(await this.scm.isPayoutState(STATE.UmaPriceProposed, this.lastT.time)).to.eq(false);
      expect(await this.scm.isPayoutState(STATE.UmaPending, 0)).to.eq(false);
    });
  });
  describe('isPayoutState() (private function) +UMAHO', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Happy flows', async function () {
      expect(await this.scm.isPayoutState(STATE.SpccApproved, this.lastT.time)).to.eq(true);
      expect(await this.scm.isPayoutState(STATE.SpccApproved, 0)).to.eq(true);

      expect(await this.scm.isPayoutState(STATE.UmaApproved, this.lastT.time.sub(days3))).to.eq(
        true,
      );
      expect(await this.scm.isPayoutState(STATE.UmaApproved, this.lastT.time.sub(days7))).to.eq(
        true,
      );
    });
    it('Sad flows', async function () {
      expect(await this.scm.isPayoutState(STATE.SpccDenied, this.lastT.time)).to.eq(false);
      expect(await this.scm.isPayoutState(STATE.SpccDenied, 0)).to.eq(false);

      expect(await this.scm.isPayoutState(STATE.UmaApproved, this.lastT.time)).to.eq(false);
      expect(
        await this.scm.isPayoutState(STATE.UmaApproved, this.lastT.time.sub(days3).add(1)),
      ).to.eq(false);

      expect(await this.scm.isPayoutState(STATE.UmaDenied, this.lastT.time)).to.eq(false);
      expect(await this.scm.isPayoutState(STATE.UmaDenied, 0)).to.eq(false);

      expect(await this.scm.isPayoutState(STATE.UmaPriceProposed, this.lastT.time)).to.eq(false);
      expect(await this.scm.isPayoutState(STATE.UmaPending, 0)).to.eq(false);
    });
  });
  after(async function () {
    await unfork();
  });
});
