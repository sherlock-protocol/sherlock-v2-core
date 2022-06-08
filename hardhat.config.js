require('@nomiclabs/hardhat-waffle');
require('solidity-coverage');
require('hardhat-gas-reporter');
require('hardhat-contract-sizer');
require('@nomiclabs/hardhat-etherscan');
require('dotenv').config();
/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const ETHERSCAN_API = process.env.ETHERSCAN_API || '';
const ALCHEMY_API_KEY_MAINNET = process.env.ALCHEMY_API_KEY_MAINNET || '';
const ALCHEMY_API_KEY_GOERLI = process.env.ALCHEMY_API_KEY_GOERLI || '';
const PRIVATE_KEY_GOERLI = process.env.PRIVATE_KEY_GOERLI || '';
const PRIVATE_KEY_MAINNET = process.env.PRIVATE_KEY_MAINNET || '';

module.exports = {
  solidity: {
    version: '0.8.10',
    settings: {
      optimizer: {
        enabled: true,
        runs: 20000,
      },
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic:
          'apart turn peace asthma useful mother tank math engine usage prefer orphan exile fold squirrel',
      },
      forking: {
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY_MAINNET}`,
        blockNumber: 14921360
      },
      chainId: 1
    },
    localhost: {
      timeout: 999999999,
      gasPrice: 1600000000000,
      //accounts: [PRIVATE_KEY].filter(item => item !== ''),
    },
    local: {
      url: 'http://127.0.0.1:8545',
      gasPrice: 500000000000,
    },
    mainnet: {
      timeout: 999999999,
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY_MAINNET}`,
      gasPrice: 100000000000,
      accounts: [PRIVATE_KEY_MAINNET].filter((item) => item !== ''),
    },
    goerli: {
      url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY_GOERLI}`,
      gasPrice: 9000000000,
      accounts: [PRIVATE_KEY_GOERLI].filter((item) => item !== ''),
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: 'USD',
    gasPrice: 100,
    coinmarketcap: process.env.COINMARKETCAP,
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: ETHERSCAN_API,
  },
};
