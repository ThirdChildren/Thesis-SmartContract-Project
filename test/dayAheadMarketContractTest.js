const { ethers } = require("hardhat");
//const { time } = require("@openzeppelin/test-helpers");
const assert = require("assert");

describe("Day Ahead Market Contract", function () {
  const startIndex = 8; // Indice da cui iniziare
  const numSigners = 11; // Numero di signers che vuoi ottenere

  let selectedSigners;
  let adminMarket,
    aggregator1,
    aggregator2,
    aggregator3,
    buyer,
    owner1,
    owner2,
    owner3,
    owner4,
    owner5,
    owner6;
  let aggregatorContract1, aggregatorContract2, aggregatorContract3, market;

  before(async () => {
    try {
      const allSigners = await ethers.getSigners();
      selectedSigners = allSigners.slice(startIndex, startIndex + numSigners);

      [
        adminMarket,
        aggregator1,
        aggregator2,
        aggregator3,
        buyer,
        owner1,
        owner2,
        owner3,
        owner4,
        owner5,
        owner6,
      ] = selectedSigners.map((s) => s.address);

      const Aggregator = await ethers.getContractFactory("Aggregator");
      const Market = await ethers.getContractFactory("Market");

      aggregatorContract1 = await Aggregator.deploy(10);
      await aggregatorContract1.deployed();
      console.log("Aggregator1 deployed at: ", aggregatorContract1.address);

      aggregatorContract2 = await Aggregator.deploy(10);
      await aggregatorContract2.deployed();
      console.log("Aggregator2 deployed at: ", aggregatorContract2.address);

      aggregatorContract3 = await Aggregator.deploy(10);
      await aggregatorContract3.deployed();
      console.log("Aggregator3 deployed at: ", aggregatorContract3.address);

      market = await Market.deploy(adminMarket);
      await market.deployed();
      console.log("Market deployed at: ", market.address);

      // Check if addresses are valid before calling setAggregator
      await market.setAggregator(owner1, aggregatorContract1.address);
      await market.setAggregator(owner2, aggregatorContract1.address);
      await market.setAggregator(owner3, aggregatorContract2.address);
      await market.setAggregator(owner4, aggregatorContract2.address);
      await market.setAggregator(owner5, aggregatorContract3.address);
      await market.setAggregator(owner6, aggregatorContract3.address);
    } catch (error) {
      console.error("Error in before hook:", error);
    }
  });

  it("should register batteries", async () => {
    const owner1Signer = await ethers.getSigner(owner1);
    const owner2Signer = await ethers.getSigner(owner2);
    const owner3Signer = await ethers.getSigner(owner3);
    const owner4Signer = await ethers.getSigner(owner4);
    const owner5Signer = await ethers.getSigner(owner5);
    const owner6Signer = await ethers.getSigner(owner6);

    // Register batteries for Aggregator 1
    await aggregatorContract1.connect(owner1Signer).registerBattery(100, 80);
    await aggregatorContract1.connect(owner2Signer).registerBattery(150, 85);

    // Register batteries for Aggregator 2
    await aggregatorContract2.connect(owner3Signer).registerBattery(120, 70);
    await aggregatorContract2.connect(owner4Signer).registerBattery(130, 75);

    // Register batteries for Aggregator 3
    await aggregatorContract3.connect(owner5Signer).registerBattery(180, 90);
    await aggregatorContract3.connect(owner6Signer).registerBattery(100, 95);

    const battery1 = await aggregatorContract1.batteries(owner1);
    const battery2 = await aggregatorContract1.batteries(owner2);
    const battery3 = await aggregatorContract2.batteries(owner3);
    const battery4 = await aggregatorContract2.batteries(owner4);
    const battery5 = await aggregatorContract3.batteries(owner5);
    const battery6 = await aggregatorContract3.batteries(owner6);

    assert.equal(battery1.capacity, 100, "Battery 1 capacity mismatch");
    assert.equal(battery1.SoC, 80, "Battery 1 SoC mismatch");

    assert.equal(battery2.capacity, 150, "Battery 2 capacity mismatch");
    assert.equal(battery2.SoC, 85, "Battery 2 SoC mismatch");

    assert.equal(battery3.capacity, 120, "Battery 3 capacity mismatch");
    assert.equal(battery3.SoC, 70, "Battery 3 SoC mismatch");

    assert.equal(battery4.capacity, 130, "Battery 4 capacity mismatch");
    assert.equal(battery4.SoC, 75, "Battery 4 SoC mismatch");

    assert.equal(battery5.capacity, 180, "Battery 5 capacity mismatch");
    assert.equal(battery5.SoC, 90, "Battery 5 SoC mismatch");

    assert.equal(battery6.capacity, 100, "Battery 6 capacity mismatch");
    assert.equal(battery6.SoC, 95, "Battery 6 SoC mismatch");
  });

  it("should set market times", async () => {
    const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
    const openTime = currentTime;
    const closeTime = currentTime + 3600; // 1 hour later
    const resultsTime = closeTime + 1800; // 30 minutes after market close

    const adminSigner = await ethers.getSigner(adminMarket);
    await market
      .connect(adminSigner)
      .setMarketTimes(openTime, closeTime, resultsTime, {
        gasLimit: 100000,
      });

    const marketOpenTime = await market.marketOpenTime();
    const marketCloseTime = await market.marketCloseTime();
    const resultsAnnouncementTime = await market.resultsAnnouncementTime();

    assert.equal(
      marketOpenTime.toNumber(),
      openTime,
      "Market open time not set correctly"
    );
    assert.equal(
      marketCloseTime.toNumber(),
      closeTime,
      "Market close time not set correctly"
    );
    assert.equal(
      resultsAnnouncementTime.toNumber(),
      resultsTime,
      "Results announcement time not set correctly"
    );
  });

  it("should place bids during market open", async () => {
    // Increase time to market open
    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine", []); // Avanza il blocco per applicare il cambiamento di tempo
    const aggregator1Signer = await ethers.getSigner(aggregator1);
    const aggregator2Signer = await ethers.getSigner(aggregator2);
    const aggregator3Signer = await ethers.getSigner(aggregator3);

    // Place bids
    await market.connect(aggregator1Signer).placeBid(owner1, 50, 10);
    await market.connect(aggregator1Signer).placeBid(owner2, 75, 12);
    await market.connect(aggregator2Signer).placeBid(owner3, 60, 8);
    await market.connect(aggregator2Signer).placeBid(owner4, 70, 6);
    await market.connect(aggregator3Signer).placeBid(owner5, 80, 15);
    await market.connect(aggregator3Signer).placeBid(owner6, 90, 7);

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid2 = await market.bids(2);
    const bid3 = await market.bids(3);
    const bid4 = await market.bids(4);
    const bid5 = await market.bids(5);

    assert.equal(bid0.batteryOwner, owner1, "Bid 0 battery owner mismatch");
    assert.equal(bid0.amount, 50, "Bid 0 amount mismatch");
    assert.equal(bid0.price, 10, "Bid 0 price mismatch");

    assert.equal(bid1.batteryOwner, owner2, "Bid 1 battery owner mismatch");
    assert.equal(bid1.amount, 75, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 12, "Bid 1 price mismatch");

    assert.equal(bid2.batteryOwner, owner3, "Bid 2 battery owner mismatch");
    assert.equal(bid2.amount, 60, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 8, "Bid 2 price mismatch");

    assert.equal(bid3.batteryOwner, owner4, "Bid 3 battery owner mismatch");
    assert.equal(bid3.amount, 70, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 6, "Bid 3 price mismatch");

    assert.equal(bid4.batteryOwner, owner5, "Bid 4 battery owner mismatch");
    assert.equal(bid4.amount, 80, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 15, "Bid 4 price mismatch");

    assert.equal(bid5.batteryOwner, owner6, "Bid 5 battery owner mismatch");
    assert.equal(bid5.amount, 90, "Bid 5 amount mismatch");
    assert.equal(bid5.price, 7, "Bid 5 price mismatch");
  });

  it("should accept bids", async () => {
    // Increase time to market close + 1 second
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine", []); // Avanza il blocco per applicare il cambiamento di tempo

    // Confirm purchases (some bids)
    const buyerSigner = await ethers.getSigner(buyer);
    await market.connect(buyerSigner).acceptBid(0);
    await market.connect(buyerSigner).acceptBid(3);

    const bid0 = await market.bids(0);
    const bid3 = await market.bids(3);

    assert.equal(bid0.isSelected, true, "Bid 0 not accepted");
    assert.equal(bid3.isSelected, true, "Bid 3 not accepted");

    assert.equal(bid0.acceptedBy, buyer, "Bid 0 accepted by mismatch");
    assert.equal(bid3.acceptedBy, buyer, "Bid 3 accepted by mismatch");
  });

  it("should purchase energy and update the SoC", async () => {
    await ethers.provider.send("evm_increaseTime", [7201]);
    await ethers.provider.send("evm_mine", []);

    const bid0 = await market.bids(0);
    const bid3 = await market.bids(3);

    const price0 = bid0.price;
    const price3 = bid3.price;

    // Check initial SoC
    let battery1 = await aggregatorContract1.batteries(owner1);
    let battery4 = await aggregatorContract2.batteries(owner4);

    assert.equal(battery1.SoC.toNumber(), 80, "Battery 1 initial SoC mismatch");
    assert.equal(battery4.SoC.toNumber(), 75, "Battery 4 initial SoC mismatch");

    // Esegui le transazioni e attendi la conferma
    const tx0 = await market.purchaseEnergy(0, { value: price0 });
    const receipt0 = await tx0.wait(); // Ottieni la receipt della transazione

    const tx3 = await market.purchaseEnergy(3, { value: price3 });
    const receipt3 = await tx3.wait(); // Ottieni la receipt della transazione

    // Check updated SoC
    battery1 = await aggregatorContract1.batteries(owner1);
    battery4 = await aggregatorContract2.batteries(owner4);

    assert.equal(
      battery1.SoC.toNumber(),
      30,
      "Battery 1 SoC not updated correctly"
    );
    assert.equal(
      battery4.SoC.toNumber(),
      22,
      "Battery 4 SoC not updated correctly"
    );

    // Verifica gli eventi nella receipt delle transazioni
    const events0 = receipt0.events;
    const events3 = receipt3.events;

    assert(Array.isArray(events0), "events0 should be an array");
    assert(Array.isArray(events3), "events3 should be an array");

    assert(
      events0.some(
        (e) =>
          e.event === "PaymentToAggregatorOwnerRecorded" &&
          e.args.bidId.toNumber() === 0 &&
          e.args.aggregator === aggregator1
      ),
      "Payment to aggregatorOwner1 not recorded"
    );
    assert(
      events0.some(
        (e) =>
          e.event === "PaymentToBatteryOwnerRecorded" &&
          e.args.bidId.toNumber() === 0 &&
          e.args.batteryOwner === owner1
      ),
      "Payment to batteryOwner1 not recorded"
    );

    assert(
      events3.some(
        (e) =>
          e.event === "PaymentToAggregatorOwnerRecorded" &&
          e.args.bidId.toNumber() === 3 &&
          e.args.aggregator === aggregator2
      ),
      "Payment to aggregatorOwner2 not recorded"
    );
    assert(
      events3.some(
        (e) =>
          e.event === "PaymentToBatteryOwnerRecorded" &&
          e.args.bidId.toNumber() === 3 &&
          e.args.batteryOwner === owner4
      ),
      "Payment to batteryOwner4 not recorded"
    );
  });
});
