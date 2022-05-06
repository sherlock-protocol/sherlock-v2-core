class TimeTraveler {
  constructor(ethereum) {
    this.ethereum = ethereum;
  }

  async snapshot() {
    const snapshot = await this.ethereum.send('evm_snapshot', []);
    await this.mine(1);
    this.snapshotID = snapshot;
    return;
  }

  async revertSnapshot() {
    await this.ethereum.send('evm_revert', [this.snapshotID]);
    //await this.mine(1);
    await this.snapshot();
    return;
  }

  async mine(amount) {
    for (let i = 0; i < amount; i++) {
      await this.ethereum.send('evm_mine', []);
    }
  }

  async hardhatMine(amount) {
    await this.ethereum.send('hardhat_mine', [`0x${amount.toString(16)}`])
  }

  async increaseTime(amount) {
    await this.ethereum.send('evm_increaseTime', [amount]);
  }

  async setNextBlockTimestamp(timestamp) {
    await this.ethereum.send('evm_setNextBlockTimestamp', [timestamp]);
  }

  async request(request) {
    await this.ethereum.request(request);
  }

  async fork(block) {
    await this.ethereum.send('hardhat_reset', [
      {
        forking: {
          jsonRpcUrl: `https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY_MAINNET}`,
          blockNumber: block,
        },
      },
    ]);
  }

  async unfork() {
    await this.ethereum.send('hardhat_reset', []);
  }
}

module.exports.TimeTraveler = TimeTraveler;
