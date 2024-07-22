const MarketContract = artifacts.require("MarketContract");
const AggregatorContract = artifacts.require("AggregatorContract");

const { time } = require("@openzeppelin/test-helpers");

contract("Day Ahead Market Test", (accounts) => {
  const [admin, aggregatorA, aggregatorB, aggregatorC, buyer1, buyer2] =
    accounts;

  let market;
  let aggregatorAContract;
  let aggregatorBContract;
  let aggregatorCContract;

  before(async () => {
    const currentTime = (await web3.eth.getBlock("latest")).timestamp;
    const marketOpenTime = currentTime;
    const marketCloseTime = currentTime + 3600; // 1 hour later
    const resultsAnnouncementTime = currentTime + 7200; // 2 hours later

    market = await MarketContract.new(
      admin,
      marketOpenTime,
      marketCloseTime,
      resultsAnnouncementTime
    );
    aggregatorAContract = await AggregatorContract.new(market.address, {
      from: aggregatorA,
    });
    aggregatorBContract = await AggregatorContract.new(market.address, {
      from: aggregatorB,
    });
    aggregatorCContract = await AggregatorContract.new(market.address, {
      from: aggregatorC,
    });
  });

  it("should register batteries", async () => {
    await aggregatorAContract.registerBattery(100, 85, { from: aggregatorA });
    await aggregatorBContract.registerBattery(150, 90, { from: aggregatorB });
    await aggregatorCContract.registerBattery(120, 80, { from: aggregatorC });

    const batteryA = await aggregatorAContract.batteries(aggregatorA);
    const batteryB = await aggregatorBContract.batteries(aggregatorB);
    const batteryC = await aggregatorCContract.batteries(aggregatorC);

    assert.equal(
      batteryA.capacity,
      100,
      "Aggregator A battery capacity mismatch"
    );
    assert.equal(batteryA.initial_soc, 85, "Aggregator A battery SoC mismatch");

    assert.equal(
      batteryB.capacity,
      150,
      "Aggregator B battery capacity mismatch"
    );
    assert.equal(batteryB.initial_soc, 90, "Aggregator B battery SoC mismatch");

    assert.equal(
      batteryC.capacity,
      120,
      "Aggregator C battery capacity mismatch"
    );
    assert.equal(batteryC.initial_soc, 80, "Aggregator C battery SoC mismatch");
  });

  it("should submit bids", async () => {
    await aggregatorAContract.submitBid(50, 10, { from: aggregatorA });
    await aggregatorBContract.submitBid(100, 8, { from: aggregatorB });
    await aggregatorCContract.submitBid(70, 12, { from: aggregatorC });
    await aggregatorAContract.submitBid(30, 9, { from: aggregatorA });
    await aggregatorBContract.submitBid(60, 7, { from: aggregatorB });

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid2 = await market.bids(2);
    const bid3 = await market.bids(3);
    const bid4 = await market.bids(4);

    assert.equal(bid0.owner, aggregatorA, "Bid 0 owner mismatch");
    assert.equal(bid0.amount, 50, "Bid 0 amount mismatch");
    assert.equal(bid0.price, 10, "Bid 0 price mismatch");

    assert.equal(bid1.owner, aggregatorB, "Bid 1 owner mismatch");
    assert.equal(bid1.amount, 100, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 8, "Bid 1 price mismatch");

    assert.equal(bid2.owner, aggregatorC, "Bid 2 owner mismatch");
    assert.equal(bid2.amount, 70, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 12, "Bid 2 price mismatch");

    assert.equal(bid3.owner, aggregatorA, "Bid 3 owner mismatch");
    assert.equal(bid3.amount, 30, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 9, "Bid 3 price mismatch");

    assert.equal(bid4.owner, aggregatorB, "Bid 4 owner mismatch");
    assert.equal(bid4.amount, 60, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 7, "Bid 4 price mismatch");
  });

  it("should accept bids", async () => {
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 3601); // Increase time to market close + 1 second

    await market.acceptBid(0, { from: buyer1 });
    await market.acceptBid(1, { from: buyer2 });
    await market.acceptBid(3, { from: buyer2 });

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid3 = await market.bids(3);

    assert.equal(bid0.isAccepted, true, "Bid 0 not accepted");
    assert.equal(bid1.isAccepted, true, "Bid 1 not accepted");
    assert.equal(bid3.isAccepted, true, "Bid 3 not accepted");
  });

  it("should purchase energy", async () => {
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 7201); // Increase time to results announcement + 1 second

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid3 = await market.bids(3);

    const price0 = bid0.amount * bid0.price;
    const price1 = bid1.amount * bid1.price;
    const price3 = bid3.amount * bid3.price;

    await market.purchaseEnergy(0, { from: buyer1, value: price0 });
    await market.purchaseEnergy(1, { from: buyer2, value: price1 });
    await market.purchaseEnergy(3, { from: buyer2, value: price3 });

    // Manually update SoC for testing purposes
    await aggregatorAContract.updateBatterySoC(0, { from: aggregatorA });
    await aggregatorBContract.updateBatterySoC(1, { from: aggregatorB });
    await aggregatorAContract.updateBatterySoC(3, { from: aggregatorA });

    const batteryA = await aggregatorAContract.batteries(aggregatorA);
    const batteryB = await aggregatorBContract.batteries(aggregatorB);

    assert.equal(
      batteryA.initial_soc.toNumber(),
      5,
      "Aggregator A battery SoC not updated correctly"
    );
    assert.equal(
      batteryB.initial_soc.toNumber(),
      24,
      "Aggregator B battery SoC not updated correctly"
    );
  });
});
