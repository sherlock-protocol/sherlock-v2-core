const { parseEther, id, keccak256, sha256, toUtf8Bytes } = require('ethers/lib/utils');

async function main() {
  const x = id('euler');
  const xx = sha256(toUtf8Bytes('euler'));

  console.log(x);
  console.log(xx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
