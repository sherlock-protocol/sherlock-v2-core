require('@nomiclabs/hardhat-waffle');
require('solidity-coverage');
require('hardhat-gas-reporter');
require('hardhat-contract-sizer');
require('dotenv').config();
require('@nomiclabs/hardhat-etherscan');

require('./tasks/advance_time_with_days');
require('./tasks/automine');
require('./tasks/spccResolveClaim');
require('./tasks/addNewProtocol');
require('./tasks/provideUSDC');
require('./tasks/cleanup_claim');
require('./tasks/umaResolve');
require("./tasks/mine_year");
require("./tasks/mine");

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const ALCHEMY_API_KEY_MAINNET = process.env.ALCHEMY_API_KEY_MAINNET || '';
const ALCHEMY_API_KEY_GOERLI = process.env.ALCHEMY_API_KEY_GOERLI || '';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
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
        // url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_API_KEY_GOERLI}`,
        // blockNumber: 6800270,
        url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY_MAINNET}`,
        blockNumber: 14310500,
      },
      allowUnlimitedContractSize: true,
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
      accounts: [PRIVATE_KEY].filter((item) => item !== ''),
    },
    goerli: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_API_KEY_GOERLI}`,
      accounts: [PRIVATE_KEY].filter((item) => item !== ''),
      gasLimit: 2500000,
    },
  },
  etherscan: {
    apiKey: {
      goerli: 'K6FAYBFH4MW1X4WK7QRRW4AMF2MQN8S9NE',
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: 'USD',
    gasPrice: 100,
    coinmarketcap: process.env.COINMARKETCAP,
  },
};
