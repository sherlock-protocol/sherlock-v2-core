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

const usdcWhaleAddress = '0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const eUSDC = '0xEb91861f8A4e1C12333F42DCE8fB0Ecdc28dA716';

const BLOCK = 14699000;
const TIMESTAMP = 1651503884;
const YEAR = 60 * 60 * 24 * 365;

describe('Compound', () => {
  before(async () => {
    const timeTraveler = new TimeTraveler();
    await timeTraveler.fork(BLOCK);

    await timeTraveler.request({
      method: 'hardhat_impersonateAccount',
      params: usdcWhaleAddress
    });

    await prepare(this, ['TreeSplitterMockTest', 'CompoundStrategy']);


    await timeTraveler.snapshot();
  });

  describe('constructor', () => {
    it('Zero cToken', () => {
      await expect(
        this.CompoundStrategy.deploy(this.bob.address, constants.AddressZero)
      ).to.be.revertedWith('ZeroArgument()');
    });
  });
});
