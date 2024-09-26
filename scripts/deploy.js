async function main() {
  // Recupera il signatore (account) che effettuerà il deploy dei contratti
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // 1. Deploy Aggregator contract
  const Aggregator = await ethers.getContractFactory("Aggregator");
  const aggregator = await Aggregator.deploy(
    "0x9cfD36771A496f4BC904b94b778fC772759B605d",
    10
  ); // Se ci sono argomenti per il costruttore, passarli qui
  await aggregator.deployed();
  console.log("Aggregator contract deployed to:", aggregator.address);

  // 2. Deploy TSO contract
  const TSO = await ethers.getContractFactory("TSO");
  const tso = await TSO.deploy("0xFeEE9E7dF3D11cb102d5E629b841F69F08Db429F"); // Se ci sono argomenti per il costruttore, passarli qui
  await tso.deployed();
  console.log("TSO contract deployed to:", tso.address);

  // 3. Deploy Market contract
  const Market = await ethers.getContractFactory("Market");
  const market = await Market.deploy(
    "0xf45a1e6f1dA17327AbDDF5f7C9fF9ed1443e3db9"
  ); // Se ci sono argomenti per il costruttore, passarli qui
  await market.deployed();
  console.log("Market contract deployed to:", market.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
