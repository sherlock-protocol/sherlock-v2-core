async function main() {
  [this.gov] = await ethers.getSigners();
  this.gov.address = await this.gov.getAddress();

  console.log(this.gov.address);

  const b = await this.gov.getBalance();
  console.log(b.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
