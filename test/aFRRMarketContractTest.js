/* const { ethers } = require("hardhat");
const assert = require("assert");

describe("aFRR Market Contract", function () {
  const startIndex = 1; // Indice da cui iniziare
  const numSigners = 7; // Numero di signers che vuoi ottenere

  let selectedSigners;
  let owner1, owner2, owner3, owner4, owner5, aggregatorAdmin, tsoAdmin;

  before(async () => {
    const allSigners = await ethers.getSigners();
    selectedSigners = allSigners.slice(startIndex, startIndex + numSigners);

    [owner1, owner2, owner3, owner4, owner5, aggregatorAdmin, tsoAdmin] =
      selectedSigners.map((s) => s.address);

    const Aggregator = await ethers.getContractFactory("Aggregator");
    const TSO = await ethers.getContractFactory("TSO");

    aggregatorContract = await Aggregator.deploy(10);
    await aggregatorContract.deployed();
    console.log("Aggregator deployed at: ", aggregatorContract.address);

    tsoContract = await TSO.deploy(aggregatorContract.address);
    await tsoContract.deployed();
    console.log("TSO deployed at: ", tsoContract.address);
  });

  it("should register batteries", async () => {
    const owner1Signer = await ethers.getSigner(owner1);
    const owner2Signer = await ethers.getSigner(owner2);
    const owner3Signer = await ethers.getSigner(owner3);
    const owner4Signer = await ethers.getSigner(owner4);
    const owner5Signer = await ethers.getSigner(owner5);
    // Register batteries for Aggregator 1
    await aggregatorContract.connect(owner1Signer).registerBattery(110, 84);
    await aggregatorContract.connect(owner2Signer).registerBattery(150, 85);
    await aggregatorContract.connect(owner3Signer).registerBattery(120, 83);
    await aggregatorContract.connect(owner4Signer).registerBattery(130, 88);
    await aggregatorContract.connect(owner5Signer).registerBattery(142, 90);

    //await aggregatorContract.registerBattery(owner1, 105, 89);

    const battery1 = await aggregatorContract.batteries(owner1);
    const battery2 = await aggregatorContract.batteries(owner2);
    const battery3 = await aggregatorContract.batteries(owner3);
    const battery4 = await aggregatorContract.batteries(owner4);
    const battery5 = await aggregatorContract.batteries(owner5);

    assert.equal(battery1.capacity, 110, "Battery 1 capacity mismatch");
    assert.equal(battery1.SoC, 84, "Battery 1 SoC mismatch");

    assert.equal(battery2.capacity, 150, "Battery 2 capacity mismatch");
    assert.equal(battery2.SoC, 85, "Battery 2 SoC mismatch");

    assert.equal(battery3.capacity, 120, "Battery 3 capacity mismatch");
    assert.equal(battery3.SoC, 83, "Battery 3 SoC mismatch");

    assert.equal(battery4.capacity, 130, "Battery 4 capacity mismatch");
    assert.equal(battery4.SoC, 88, "Battery 4 SoC mismatch");

    assert.equal(battery5.capacity, 142, "Battery 5 capacity mismatch");
    assert.equal(battery5.SoC, 90, "Battery 5 SoC mismatch");
  });

  //Positive Reserve
  it("should open the market for positive reserve", async function () {
    // Apri il mercato con 500 kWh di energia richiesta per la riserva positiva
    //const tsoSigner = await ethers.getSigner(tsoAdmin);
    await tsoContract.openMarket(500, true);
    const marketOpen = await tsoContract.marketOpen();
    assert.equal(marketOpen, true, "Market not open");
  });

  it("should place bids", async function () {
    const aggregatorSigner = await ethers.getSigner(aggregatorAdmin);
    // Place bids for each battery
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner1, 90, 88, { gasLimit: 1000000 }); // 90 kWh, 88 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner2, 108, 69, { gasLimit: 1000000 }); // 108 kWh, 69 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner3, 80, 73, { gasLimit: 1000000 }); // 80 kWh, 73 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner4, 105, 62, { gasLimit: 1000000 }); // 105 kWh, 62 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner5, 115, 58, { gasLimit: 1000000 }); // 115 kWh, 58 EUR/MWh

    // Verifica che le bid siano state piazzate correttamente
    const bid1 = await tsoContract.bids(0);
    const bid2 = await tsoContract.bids(1);
    const bid3 = await tsoContract.bids(2);
    const bid4 = await tsoContract.bids(3);
    const bid5 = await tsoContract.bids(4);

    assert.equal(bid1.batteryOwner, owner1, "Bid 1 owner mismatch");
    assert.equal(bid1.amount, 90, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 7, "Bid 1 price mismatch");

    assert.equal(bid2.batteryOwner, owner2, "Bid 2 owner mismatch");
    assert.equal(bid2.amount, 108, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 7, "Bid 2 price mismatch");

    assert.equal(bid3.batteryOwner, owner3, "Bid 3 owner mismatch");
    assert.equal(bid3.amount, 80, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 5, "Bid 3 price mismatch");

    assert.equal(bid4.batteryOwner, owner4, "Bid 4 owner mismatch");
    assert.equal(bid4.amount, 105, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 6, "Bid 4 price mismatch");

    assert.equal(bid5.batteryOwner, owner5, "Bid 5 owner mismatch");
    assert.equal(bid5.amount, 115, "Bid 5 amount mismatch");
    assert.equal(bid5.price, 6, "Bid 5 price mismatch");
  });

  it("should close the market", async function () {
    await tsoContract.closeMarket();
    const marketOpen = await tsoContract.marketOpen();
    assert.equal(marketOpen, false, "Market not closed");
  });

  it("should select bids, process payments, and update the SoC", async function () {
    const tsoSigner = await ethers.getSigner(tsoAdmin);

    // Recupera le bid esistenti
    const bid0 = await tsoContract.bids(0);
    const bid1 = await tsoContract.bids(1);
    const bid2 = await tsoContract.bids(2);
    const bid3 = await tsoContract.bids(3);
    const bid4 = await tsoContract.bids(4);

    // Calcola l'importo necessario per ogni pagamento
    const price0 = bid0.amount * bid0.price;
    const price1 = bid1.amount * bid1.price;
    const price2 = bid2.amount * bid2.price;
    const price3 = bid3.amount * bid3.price;
    const price4 = bid4.amount * bid4.price;

    // Seleziona le bid e processa il pagamento
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(0, { value: price0, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(1, { value: price1, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(2, { value: price2, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(3, { value: price3, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(4, { value: price4, gasLimit: 1000000 });

    // Verifica che le bid siano state selezionate
    const updatedBid0 = await tsoContract.bids(0);
    const updatedBid1 = await tsoContract.bids(1);
    const updatedBid2 = await tsoContract.bids(2);
    const updatedBid3 = await tsoContract.bids(3);
    const updatedBid4 = await tsoContract.bids(4);

    assert.equal(updatedBid0.isSelected, true, "Bid 0 not accepted");
    assert.equal(updatedBid1.isSelected, true, "Bid 1 not accepted");
    assert.equal(updatedBid2.isSelected, true, "Bid 2 not accepted");
    assert.equal(updatedBid3.isSelected, true, "Bid 3 not accepted");
    assert.equal(updatedBid4.isSelected, true, "Bid 4 not accepted");

    // Controlla se il SoC delle batterie è stato aggiornato
    const battery1 = await aggregatorContract.batteries(owner1);
    const battery2 = await aggregatorContract.batteries(owner2);
    const battery3 = await aggregatorContract.batteries(owner3);
    const battery4 = await aggregatorContract.batteries(owner4);
    const battery5 = await aggregatorContract.batteries(owner5);

    assert.equal(
      battery1.SoC.toNumber(),
      3,
      "Battery 1 SoC not updated correctly"
    );
    assert.equal(
      battery2.SoC.toNumber(),
      13,
      "Battery 2 SoC not updated correctly"
    );
    assert.equal(
      battery3.SoC.toNumber(),
      17,
      "Battery 3 SoC not updated correctly"
    );
    assert.equal(
      battery4.SoC.toNumber(),
      8,
      "Battery 4 SoC not updated correctly"
    );
    assert.equal(
      battery5.SoC.toNumber(),
      10,
      "Battery 5 SoC not updated correctly"
    );
  });

  //Negative Reserve
  it("should open the market for negative reserve", async function () {
    // Apri il mercato con 1000 kWh di energia richiesta per la riserva positiva
    //const tsoSigner = await ethers.getSigner(tsoAdmin);
    await tsoContract.openMarket(1000, false);
    const marketOpen = await tsoContract.marketOpen();
    assert.equal(marketOpen, true, "Market not open");
  });

  it("should place bids", async function () {
    const aggregatorSigner = await ethers.getSigner(aggregatorAdmin);
    // Place bids for each battery
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner1, 90, 88, { gasLimit: 1000000 }); // 90 kWh, 88 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner2, 108, 69, { gasLimit: 1000000 }); // 108 kWh, 69 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner3, 80, 73, { gasLimit: 1000000 }); // 80 kWh, 73 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner4, 105, 62, { gasLimit: 1000000 }); // 105 kWh, 62 EUR/MWh
    await tsoContract
      .connect(aggregatorSigner)
      .placeBid(owner5, 115, 58, { gasLimit: 1000000 }); // 115 kWh, 58 EUR/MWh

    // Verifica che le bid siano state piazzate correttamente
    const bid1 = await tsoContract.bids(0);
    const bid2 = await tsoContract.bids(1);
    const bid3 = await tsoContract.bids(2);
    const bid4 = await tsoContract.bids(3);
    const bid5 = await tsoContract.bids(4);

    assert.equal(bid1.batteryOwner, owner1, "Bid 1 owner mismatch");
    assert.equal(bid1.amount, 90, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 7, "Bid 1 price mismatch");

    assert.equal(bid2.batteryOwner, owner2, "Bid 2 owner mismatch");
    assert.equal(bid2.amount, 108, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 7, "Bid 2 price mismatch");

    assert.equal(bid3.batteryOwner, owner3, "Bid 3 owner mismatch");
    assert.equal(bid3.amount, 80, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 5, "Bid 3 price mismatch");

    assert.equal(bid4.batteryOwner, owner4, "Bid 4 owner mismatch");
    assert.equal(bid4.amount, 105, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 6, "Bid 4 price mismatch");

    assert.equal(bid5.batteryOwner, owner5, "Bid 5 owner mismatch");
    assert.equal(bid5.amount, 115, "Bid 5 amount mismatch");
    assert.equal(bid5.price, 6, "Bid 5 price mismatch");
  });

  it("should close the market", async function () {
    await tsoContract.closeMarket();
    const marketOpen = await tsoContract.marketOpen();
    assert.equal(marketOpen, false, "Market not closed");
  });

  it("should select bids, process payments, and update the SoC", async function () {
    const tsoSigner = await ethers.getSigner(tsoAdmin);

    // Recupera le bid esistenti
    const bid0 = await tsoContract.bids(0);
    const bid1 = await tsoContract.bids(1);
    const bid2 = await tsoContract.bids(2);
    const bid3 = await tsoContract.bids(3);
    const bid4 = await tsoContract.bids(4);

    // Calcola l'importo necessario per ogni pagamento
    const price0 = bid0.amount * bid0.price;
    const price1 = bid1.amount * bid1.price;
    const price2 = bid2.amount * bid2.price;
    const price3 = bid3.amount * bid3.price;
    const price4 = bid4.amount * bid4.price;

    // Seleziona le bid e processa il pagamento
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(0, { value: price0, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(1, { value: price1, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(2, { value: price2, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(3, { value: price3, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .acceptBid(4, { value: price4, gasLimit: 1000000 });

    // Verifica che le bid siano state selezionate
    const updatedBid0 = await tsoContract.bids(0);
    const updatedBid1 = await tsoContract.bids(1);
    const updatedBid2 = await tsoContract.bids(2);
    const updatedBid3 = await tsoContract.bids(3);
    const updatedBid4 = await tsoContract.bids(4);

    assert.equal(updatedBid0.isSelected, true, "Bid 0 not accepted");
    assert.equal(updatedBid1.isSelected, true, "Bid 1 not accepted");
    assert.equal(updatedBid2.isSelected, true, "Bid 2 not accepted");
    assert.equal(updatedBid3.isSelected, true, "Bid 3 not accepted");
    assert.equal(updatedBid4.isSelected, true, "Bid 4 not accepted");

    // Controlla se il SoC delle batterie è stato aggiornato
    const battery1 = await aggregatorContract.batteries(owner1);
    const battery2 = await aggregatorContract.batteries(owner2);
    const battery3 = await aggregatorContract.batteries(owner3);
    const battery4 = await aggregatorContract.batteries(owner4);
    const battery5 = await aggregatorContract.batteries(owner5);

    assert.equal(
      battery1.SoC.toNumber(),
      84,
      "Battery 1 SoC not updated correctly"
    );
    assert.equal(
      battery2.SoC.toNumber(),
      85,
      "Battery 2 SoC not updated correctly"
    );
    assert.equal(
      battery3.SoC.toNumber(),
      83,
      "Battery 3 SoC not updated correctly"
    );
    assert.equal(
      battery4.SoC.toNumber(),
      88,
      "Battery 4 SoC not updated correctly"
    );
    assert.equal(
      battery5.SoC.toNumber(),
      90,
      "Battery 5 SoC not updated correctly"
    );
  });
});
 */
