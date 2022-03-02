const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, timestamp, Uint16Max, meta } = require('./utilities');
const { constants, BigNumber } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');
const { id } = require('ethers/lib/utils');

const maxTokens = parseUnits('100000000000', 6);
const maxTokens2 = parseEther('100000000000', 18);

const weeks1 = 60 * 60 * 24 * 7 * 1;
const weeks2 = 60 * 60 * 24 * 7 * 2;
const weeks12 = 60 * 60 * 24 * 7 * 12;
const weeks26 = 60 * 60 * 24 * 7 * 26;

describe('Sherlock ─ ERC721', function () {
  before(async function () {
    await prepare(this, [
      'StrategyMock',
      'SherlockProtocolManagerMock',
      'SherDistributionMock',
      'ERC20Mock6d',
      'ERC20Mock18d',
      'Sherlock',
    ]);

    this.claimManager = this.carol;
    this.nonStaker = this.bob;

    await deploy(this, [['token', this.ERC20Mock6d, ['USDC Token', 'USDC', maxTokens]]]);
    await deploy(this, [['sher', this.ERC20Mock18d, ['SHER Token', 'SHER', maxTokens]]]);

    await deploy(this, [['strategy', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['strategy2', this.StrategyMock, [this.token.address]]]);
    await deploy(this, [['protmanager', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [['protmanager2', this.SherlockProtocolManagerMock, [this.token.address]]]);
    await deploy(this, [
      ['sherdist', this.SherDistributionMock, [this.token.address, this.sher.address]],
    ]);
    await deploy(this, [
      ['sherdist2', this.SherDistributionMock, [this.token.address, this.sher.address]],
    ]);

    await deploy(this, [
      [
        'sherlock',
        this.Sherlock,
        [
          this.token.address,
          this.sher.address,
          'SHER POSITION',
          'SPS',
          this.strategy.address,
          this.sherdist.address,
          this.nonStaker.address,
          this.protmanager.address,
          this.claimManager.address,
          [10, 20],
        ],
      ],
    ]);

    await this.token.approve(this.sherlock.address, maxTokens);
  });

  describe('tokenURI', function () {
    before(async function () {});
    it('Initial state', async function () {
      await expect(this.sherlock.tokenURI(1)).to.be.revertedWith(
        'ERC721Metadata: URI query for nonexistent token',
      );

      await expect(this.sherlock.tokenURI(2)).to.be.revertedWith(
        'ERC721Metadata: URI query for nonexistent token',
      );
    });
    it('Do 1', async function () {
      await this.sherlock.initialStake(parseUnits('100', 6), 10, this.bob.address);

      expect(await this.sherlock.tokenURI(1)).to.be.eq('https://nft.sherlock.xyz/api/mainnet/1');
      await expect(this.sherlock.tokenURI(2)).to.be.revertedWith(
        'ERC721Metadata: URI query for nonexistent token',
      );
    });
    it('Do 2', async function () {
      await this.sherlock.initialStake(parseUnits('100', 6), 10, this.bob.address);

      expect(await this.sherlock.tokenURI(1)).to.be.eq('https://nft.sherlock.xyz/api/mainnet/1');
      expect(await this.sherlock.tokenURI(2)).to.be.eq('https://nft.sherlock.xyz/api/mainnet/2');
    });
  });
});
