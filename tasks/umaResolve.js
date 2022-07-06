const { task, types } = require("hardhat/config");

task("umaResolve", "Approve or refuse a claim by UMA")
    .addParam("claimId", "Public id of the claim", undefined, types.int)
    .addParam("approved", "UMA approves or refuses", undefined, types.boolean)
    .setAction(async ({ claimId, approved }) => {
        const SHERLOCK_ADDRESS = "0x0865a889183039689034dA55c1Fd12aF5083eabF";
        const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        const UMA_ADDRESS = "0xeE3Afe347D5C74317041E2618C49534dAf887c24";
        const UMA_IDENTIFIER = "0x534845524c4f434b5f434c41494d000000000000000000000000000000000000";
        const claimManager = await ethers.getContractAt("SherlockClaimManager", "0xfeedd254ae4b7c44a0472bb836b813ce4625eb84");

        await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [UMA_ADDRESS],
        });
        await hre.network.provider.request({
            method: 'hardhat_setBalance',
            params: [UMA_ADDRESS, '0x100000000000000000000000000'],
        });

        const uma = ethers.provider.getSigner(UMA_ADDRESS);

        const claim = await claimManager.claim(claimId);
        await claimManager.connect(uma).priceSettled(UMA_IDENTIFIER, 3, claim.ancillaryData, {
            proposer: SHERLOCK_ADDRESS,
            disputer: claim.initiator,
            currency: USDC_ADDRESS,
            settled: false,
            proposedPrice: 0,
            resolvedPrice: approved ? claim.amount : 0,
            expirationTime: 0,
            reward: 0,
            finalFee: 0,
            bond: 0,
            customLiveness: 0,
        });
    });