const { ethers } = require("hardhat");
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

    aggregatorContract = await Aggregator.deploy(aggregatorAdmin, 10);
    await aggregatorContract.deployed();
    console.log("Aggregator deployed at: ", aggregatorContract.address);

    tsoContract = await TSO.deploy(tsoAdmin);
    await tsoContract.deployed();
    console.log("TSO deployed at: ", tsoContract.address);

    await tsoContract.setAggregator(owner1, aggregatorContract.address);
    await tsoContract.setAggregator(owner2, aggregatorContract.address);
    await tsoContract.setAggregator(owner3, aggregatorContract.address);
    await tsoContract.setAggregator(owner4, aggregatorContract.address);
    await tsoContract.setAggregator(owner5, aggregatorContract.address);
  });

  it("should register batteries", async () => {
    // Register batteries for Aggregator 1
    await aggregatorContract.registerBattery(owner1, 100, 80, true);
    await aggregatorContract.registerBattery(owner2, 150, 85, true);
    await aggregatorContract.registerBattery(owner3, 120, 83, true);
    await aggregatorContract.registerBattery(owner4, 130, 88, true);
    await aggregatorContract.registerBattery(owner5, 180, 90, true);

    const battery1 = await aggregatorContract.batteries(owner1);
    const battery2 = await aggregatorContract.batteries(owner2);
    const battery3 = await aggregatorContract.batteries(owner3);
    const battery4 = await aggregatorContract.batteries(owner4);
    const battery5 = await aggregatorContract.batteries(owner5);

    assert.equal(battery1.owner, owner1, "Battery 1 owner mismatch");
    assert.equal(battery1.capacity, 100, "Battery 1 capacity mismatch");
    assert.equal(battery1.SoC, 80, "Battery 1 SoC mismatch");

    assert.equal(battery2.owner, owner2, "Battery 2 owner mismatch");
    assert.equal(battery2.capacity, 150, "Battery 2 capacity mismatch");
    assert.equal(battery2.SoC, 85, "Battery 2 SoC mismatch");

    assert.equal(battery3.owner, owner3, "Battery 3 owner mismatch");
    assert.equal(battery3.capacity, 120, "Battery 3 capacity mismatch");
    assert.equal(battery3.SoC, 83, "Battery 3 SoC mismatch");

    assert.equal(battery4.owner, owner4, "Battery 4 owner mismatch");
    assert.equal(battery4.capacity, 130, "Battery 4 capacity mismatch");
    assert.equal(battery4.SoC, 88, "Battery 4 SoC mismatch");

    assert.equal(battery5.owner, owner5, "Battery 5 owner mismatch");
    assert.equal(battery5.capacity, 180, "Battery 5 capacity mismatch");
    assert.equal(battery5.SoC, 90, "Battery 5 SoC mismatch");
  });

  it("should open the market for positive reserve", async function () {
    // Apri il mercato con 500 kWh di energia richiesta per la riserva positiva
    const tsoSigner = await ethers.getSigner(tsoAdmin);
    await tsoContract.connect(tsoSigner).openMarket(500, true);
    const marketOpen = await tsoContract.marketOpen();
    assert.equal(marketOpen, true, "Market not open");
  });

  it("should place bids", async function () {
    //const aggregatorSigner = await ethers.getSigner(aggregatorAdmin);
    // Place bids for each battery
    await tsoContract.placeBid(aggregatorAdmin, owner1, 90, 10); // 90 kWh, 10 EUR/MWh, bid_index 1
    await tsoContract.placeBid(aggregatorAdmin, owner2, 130, 10);
    await tsoContract.placeBid(aggregatorAdmin, owner3, 100, 12);
    await tsoContract.placeBid(aggregatorAdmin, owner4, 110, 8);
    await tsoContract.placeBid(aggregatorAdmin, owner5, 160, 11);

    // Verifica che le bid siano state piazzate correttamente
    const bid1 = await tsoContract.bids(0);
    const bid2 = await tsoContract.bids(1);
    const bid3 = await tsoContract.bids(2);
    const bid4 = await tsoContract.bids(3);
    const bid5 = await tsoContract.bids(4);

    assert.equal(bid1.bidder, aggregatorAdmin, "Bid 1 bidder mismatch");
    assert.equal(bid1.batteryOwner, owner1, "Bid 1 owner mismatch");
    assert.equal(bid1.amount, 90, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 10, "Bid 1 price mismatch");

    assert.equal(bid2.bidder, aggregatorAdmin, "Bid 2 bidder mismatch");
    assert.equal(bid2.batteryOwner, owner2, "Bid 2 owner mismatch");
    assert.equal(bid2.amount, 130, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 10, "Bid 2 price mismatch");

    assert.equal(bid3.bidder, aggregatorAdmin, "Bid 3 bidder mismatch");
    assert.equal(bid3.batteryOwner, owner3, "Bid 3 owner mismatch");
    assert.equal(bid3.amount, 100, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 12, "Bid 3 price mismatch");

    assert.equal(bid4.bidder, aggregatorAdmin, "Bid 4 bidder mismatch");
    assert.equal(bid4.batteryOwner, owner4, "Bid 4 owner mismatch");
    assert.equal(bid4.amount, 110, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 8, "Bid 4 price mismatch");

    assert.equal(bid5.bidder, aggregatorAdmin, "Bid 5 bidder mismatch");
    assert.equal(bid5.batteryOwner, owner5, "Bid 5 owner mismatch");
    assert.equal(bid5.amount, 160, "Bid 5 amount mismatch");
    assert.equal(bid5.price, 11, "Bid 5 price mismatch");
  });

  it("should close the market", async function () {
    const tsoSigner = await ethers.getSigner(tsoAdmin);
    // Chiudi il mercato
    await tsoContract.connect(tsoSigner).closeMarket();
    const marketOpen = await tsoContract.marketOpen();
    assert.equal(marketOpen, false, "Market not closed");
  });

  it("should select bids and process payments", async function () {
    const tsoSigner = await ethers.getSigner(tsoAdmin);
    // Seleziona le bid
    await tsoContract.connect(tsoSigner).acceptBid(0, { gasLimit: 1000000 });
    await tsoContract.connect(tsoSigner).acceptBid(1, { gasLimit: 1000000 });
    await tsoContract.connect(tsoSigner).acceptBid(2, { gasLimit: 1000000 });
    await tsoContract.connect(tsoSigner).acceptBid(3, { gasLimit: 1000000 });
    await tsoContract.connect(tsoSigner).acceptBid(4, { gasLimit: 1000000 });

    const bid0 = await tsoContract.bids(0);
    const bid1 = await tsoContract.bids(1);
    const bid2 = await tsoContract.bids(2);
    const bid3 = await tsoContract.bids(3);
    const bid4 = await tsoContract.bids(4);

    assert.equal(bid0.isSelected, true, "Bid 0 not accepted");
    assert.equal(bid1.isSelected, true, "Bid 1 not accepted");
    assert.equal(bid2.isSelected, true, "Bid 2 not accepted");
    assert.equal(bid3.isSelected, true, "Bid 3 not accepted");
    assert.equal(bid4.isSelected, true, "Bid 4 not accepted");
  });

  it("should purchase energy and update the SoC", async () => {
    const tsoSigner = await ethers.getSigner(tsoAdmin);
    const bid0 = await tsoContract.bids(0);
    const bid1 = await tsoContract.bids(1);
    const bid2 = await tsoContract.bids(2);
    const bid3 = await tsoContract.bids(3);
    const bid4 = await tsoContract.bids(4);
    const price0 = bid0.amount * bid0.price;
    const price1 = bid1.amount * bid1.price;
    const price2 = bid2.amount * bid2.price;
    const price3 = bid3.amount * bid3.price;
    const price4 = bid4.amount * bid4.price;

    // Acquista energia e aggiorna il SoC
    await tsoContract
      .connect(tsoSigner)
      .processPayment(0, { value: price0, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .processPayment(1, { value: price1, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .processPayment(2, { value: price2, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .processPayment(3, { value: price3, gasLimit: 1000000 });
    await tsoContract
      .connect(tsoSigner)
      .processPayment(4, { value: price4, gasLimit: 1000000 });

    // Check updated SoC
    battery1 = await aggregatorContract.batteries(owner1);
    battery2 = await aggregatorContract.batteries(owner2);
    battery3 = await aggregatorContract.batteries(owner3);
    battery4 = await aggregatorContract.batteries(owner4);
    battery5 = await aggregatorContract.batteries(owner5);

    assert.equal(
      battery1.SoC.toNumber(),
      70,
      "Battery 1 SoC not updated correctly"
    );
    assert.equal(
      battery2.SoC.toNumber(),
      35,
      "Battery 2 SoC not updated correctly"
    );
    assert.equal(
      battery3.SoC.toNumber(),
      31,
      "Battery 3 SoC not updated correctly"
    );
    assert.equal(
      battery4.SoC.toNumber(),
      38,
      "Battery 4 SoC not updated correctly"
    );
    assert.equal(
      battery5.SoC.toNumber(),
      40,
      "Battery 5 SoC not updated correctly"
    );
  });

  it("should prevent placing bids when market is closed", async function () {
    // Prova a piazzare una bid con il mercato chiuso (dovrebbe fallire)
  });
});
