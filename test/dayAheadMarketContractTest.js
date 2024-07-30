const Aggregator = artifacts.require("Aggregator");
const Market = artifacts.require("Market");
const Payment = artifacts.require("Payment");
const { time } = require("@openzeppelin/test-helpers");
const assert = require("assert");

contract("Day Ahead Market Contract", (accounts) => {
  const [
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
  ] = accounts;

  let aggregatorContract1;
  let aggregatorContract2;
  let aggregatorContract3;
  let market;

  before(async () => {
    aggregatorContract1 = await Aggregator.new(5, { from: aggregator1 }); // 5% commission rate
    aggregatorContract2 = await Aggregator.new(5, { from: aggregator2 }); // 5% commission rate
    aggregatorContract3 = await Aggregator.new(5, { from: aggregator3 }); // 5% commission rate
    market = await Market.new(adminMarket);
    console.log("Aggregator1: ", aggregatorContract1.address);
    console.log("Aggregator2: ", aggregatorContract2.address);
    console.log("Aggregator3: ", aggregatorContract3.address);
    console.log("Market: ", market.address);
    await market.setAggregator(owner1, aggregatorContract1.address); // Imposta gli aggregatori per i rispettivi owner delle batterie
    await market.setAggregator(owner2, aggregatorContract1.address);
    await market.setAggregator(owner3, aggregatorContract2.address);
    await market.setAggregator(owner4, aggregatorContract2.address);
    await market.setAggregator(owner5, aggregatorContract3.address);
    await market.setAggregator(owner6, aggregatorContract3.address);
  });

  it("should register batteries", async () => {
    // Register batteries for Aggregator 1
    await aggregatorContract1.registerBattery(owner1, 100, 80, true, {
      from: aggregator1,
    });
    await aggregatorContract1.registerBattery(owner2, 150, 85, true, {
      from: aggregator1,
    });

    // Register batteries for Aggregator 2
    await aggregatorContract2.registerBattery(owner3, 120, 70, true, {
      from: aggregator2,
    });
    await aggregatorContract2.registerBattery(owner4, 130, 75, true, {
      from: aggregator2,
    });

    // Register batteries for Aggregator 3
    await aggregatorContract3.registerBattery(owner5, 180, 90, true, {
      from: aggregator3,
    });
    await aggregatorContract3.registerBattery(owner6, 100, 65, true, {
      from: aggregator3,
    });

    const battery1 = await aggregatorContract1.batteries(owner1);
    const battery2 = await aggregatorContract1.batteries(owner2);
    const battery3 = await aggregatorContract2.batteries(owner3);
    const battery4 = await aggregatorContract2.batteries(owner4);
    const battery5 = await aggregatorContract3.batteries(owner5);
    const battery6 = await aggregatorContract3.batteries(owner6);

    assert.equal(battery1.owner, owner1, "Battery 1 owner mismatch");
    assert.equal(battery1.capacity, 100, "Battery 1 capacity mismatch");
    assert.equal(battery1.SoC, 80, "Battery 1 SoC mismatch");

    assert.equal(battery2.owner, owner2, "Battery 2 owner mismatch");
    assert.equal(battery2.capacity, 150, "Battery 2 capacity mismatch");
    assert.equal(battery2.SoC, 85, "Battery 2 SoC mismatch");

    assert.equal(battery3.owner, owner3, "Battery 3 owner mismatch");
    assert.equal(battery3.capacity, 120, "Battery 3 capacity mismatch");
    assert.equal(battery3.SoC, 70, "Battery 3 SoC mismatch");

    assert.equal(battery4.owner, owner4, "Battery 4 owner mismatch");
    assert.equal(battery4.capacity, 130, "Battery 4 capacity mismatch");
    assert.equal(battery4.SoC, 75, "Battery 4 SoC mismatch");

    assert.equal(battery5.owner, owner5, "Battery 5 owner mismatch");
    assert.equal(battery5.capacity, 180, "Battery 5 capacity mismatch");
    assert.equal(battery5.SoC, 90, "Battery 5 SoC mismatch");

    assert.equal(battery6.owner, owner6, "Battery 6 owner mismatch");
    assert.equal(battery6.capacity, 100, "Battery 6 capacity mismatch");
    assert.equal(battery6.SoC, 65, "Battery 6 SoC mismatch");
  });

  it("should set market times", async () => {
    const currentTime = (await web3.eth.getBlock("latest")).timestamp;
    const openTime = currentTime;
    const closeTime = currentTime + 3600; // 1 hour later
    const resultsTime = closeTime + 1800; // 30 minutes after market close

    await market.setMarketTimes(openTime, closeTime, resultsTime);

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
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 61);

    // Place bids
    await market.placeBid(owner1, 50, 10, { from: aggregator1 });
    await market.placeBid(owner2, 75, 12, { from: aggregator1 });
    await market.placeBid(owner3, 60, 8, { from: aggregator2 });
    await market.placeBid(owner4, 70, 6, { from: aggregator2 });
    await market.placeBid(owner5, 80, 15, { from: aggregator3 });
    await market.placeBid(owner6, 90, 7, { from: aggregator3 });

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid2 = await market.bids(2);
    const bid3 = await market.bids(3);
    const bid4 = await market.bids(4);
    const bid5 = await market.bids(5);

    assert.equal(bid0.bidder, aggregator1, "Bid 0 owner mismatch");
    assert.equal(bid0.batteryOwner, owner1, "Bid 0 battery owner mismatch");
    assert.equal(bid0.amount, 50, "Bid 0 amount mismatch");
    assert.equal(bid0.price, 10, "Bid 0 price mismatch");

    assert.equal(bid1.bidder, aggregator1, "Bid 1 owner mismatch");
    assert.equal(bid1.batteryOwner, owner2, "Bid 1 battery owner mismatch");
    assert.equal(bid1.amount, 75, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 12, "Bid 1 price mismatch");

    assert.equal(bid2.bidder, aggregator2, "Bid 2 owner mismatch");
    assert.equal(bid2.batteryOwner, owner3, "Bid 2 battery owner mismatch");
    assert.equal(bid2.amount, 60, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 8, "Bid 2 price mismatch");

    assert.equal(bid3.bidder, aggregator2, "Bid 3 owner mismatch");
    assert.equal(bid3.batteryOwner, owner4, "Bid 3 battery owner mismatch");
    assert.equal(bid3.amount, 70, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 6, "Bid 3 price mismatch");

    assert.equal(bid4.bidder, aggregator3, "Bid 4 owner mismatch");
    assert.equal(bid4.batteryOwner, owner5, "Bid 4 battery owner mismatch");
    assert.equal(bid4.amount, 80, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 15, "Bid 4 price mismatch");

    assert.equal(bid5.bidder, aggregator3, "Bid 5 owner mismatch");
    assert.equal(bid5.batteryOwner, owner6, "Bid 5 battery owner mismatch");
    assert.equal(bid5.amount, 90, "Bid 5 amount mismatch");
    assert.equal(bid5.price, 7, "Bid 5 price mismatch");
  });

  it("should accept bids", async () => {
    // Deposit sufficient funds for the buyer
    /* await market.depositFunds({
      from: buyer,
      value: web3.utils.toWei("2", "ether"),
    }); */
    // Increase time to market close + 1 second
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 3601);

    // Confirm purchases (some bids)
    await market.acceptBid(0, { from: buyer });
    await market.acceptBid(3, { from: buyer });

    const bid0 = await market.bids(0);
    const bid3 = await market.bids(3);

    assert.equal(bid0.isSelected, true, "Bid 0 not accepted");
    assert.equal(bid3.isSelected, true, "Bid 3 not accepted");

    assert.equal(bid0.acceptedBy, buyer, "Bid 0 accepted by mismatch");
    assert.equal(bid3.acceptedBy, buyer, "Bid 3 accepted by mismatch");
    console.log("Bid 0 owner: ", bid0.bidder);
    console.log("Bid 3 owner: ", bid3.bidder);
  });

  it("should purchase energy and update the SoC", async () => {
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 7201); // Increase time to results announcement + 1 second

    const bid0 = await market.bids(0);
    const bid3 = await market.bids(3);

    const price0 = bid0.amount * bid0.price;
    const price3 = bid3.amount * bid3.price;

    // Check initial SoC
    let battery1 = await aggregatorContract1.batteries(owner1);
    let battery4 = await aggregatorContract2.batteries(owner4);

    assert.equal(battery1.SoC.toNumber(), 80, "Battery 1 initial SoC mismatch");
    assert.equal(battery4.SoC.toNumber(), 75, "Battery 4 initial SoC mismatch");

    await market.purchaseEnergy(0, { from: buyer, value: price0 });
    await market.purchaseEnergy(3, { from: buyer, value: price3 });

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
  });
});
