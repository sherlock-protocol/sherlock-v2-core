const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);
const days7 = 60 * 60 * 24 * 7;
describe('SherlockClaimManager ─ Stateless', function () {
  before(async function () {
    await prepare(this, ['SherlockProtocolManagerTest', 'ERC20Mock6d', 'SherlockMock']);

    await deploy(this, [['ERC20Mock6d', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['spm', this.SherlockProtocolManagerTest, [this.ERC20Mock6d.address]]]);
    await deploy(this, [['SherlockMock', this.SherlockMock, []]]);
  });
  describe('renounceUmaHaltOperator()', function () {
    it('Invalid sender', async function () {});
  });
  describe('startClaim()', function () {});
  describe('spccApprove()', function () {});
  describe('spccRefuse()', function () {});
  describe('escalate()', function () {});
  describe('payoutClaim()', function () {});
  describe('executeHalt()', function () {});
  describe('priceProposed()', function () {});
  describe('priceDisputed()', function () {});
  describe('priceSettled()', function () {});
});
