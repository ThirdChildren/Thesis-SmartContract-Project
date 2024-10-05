async function main() {
  // Recupera i signatori (account) che effettueranno il deploy dei contratti
  /*  const signers = await ethers.getSigners(); // Ottieni tutti gli account
  const tsoAdmin = signers[1]; // Usa il secondo account come tsoAdmin

  console.log(
    "Deploying tso contract with the admin account:",
    tsoAdmin.address
  ); */

  // 1. Deploy Aggregator contract
  const Aggregator = await ethers.getContractFactory("Aggregator");
  const aggregator = await Aggregator.deploy(10);
  await aggregator.deployed();
  console.log("Aggregator contract deployed to:", aggregator.address);

  // 2. Deploy TSO contract
  const TSO = await ethers.getContractFactory("TSO");
  const tso = await TSO.deploy(aggregator.address);
  await tso.deployed();
  console.log("TSO contract deployed to:", tso.address);

  // 3. Deploy Market contract
  const Market = await ethers.getContractFactory("Market");
  const market = await Market.deploy(
    "0xf45a1e6f1dA17327AbDDF5f7C9fF9ed1443e3db9" // Se ci sono argomenti per il costruttore, passarli qui
  );
  await market.deployed();
  console.log("Market contract deployed to:", market.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
