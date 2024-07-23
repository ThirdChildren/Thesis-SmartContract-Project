const MarketContract = artifacts.require("MarketContract");
const AggregatorContract = artifacts.require("AggregatorDAMContract");

const { time } = require("@openzeppelin/test-helpers");

contract("Day Ahead Market Test", (accounts) => {
  const [
    admin,
    aggregatorA,
    aggregatorB,
    aggregatorC,
    batteryOwner1,
    batteryOwner2,
    batteryOwner3,
    buyer1,
    buyer2,
  ] = accounts;
  const commissionPercentage = 5; // 5% commission

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
    aggregatorAContract = await AggregatorContract.new(
      market.address,
      commissionPercentage,
      { from: aggregatorA }
    );
    aggregatorBContract = await AggregatorContract.new(
      market.address,
      commissionPercentage,
      { from: aggregatorB }
    );
    aggregatorCContract = await AggregatorContract.new(
      market.address,
      commissionPercentage,
      { from: aggregatorC }
    );
  });

  it("should register batteries", async () => {
    await aggregatorAContract.registerBattery(100, 85, { from: batteryOwner1 });
    await aggregatorBContract.registerBattery(150, 90, { from: batteryOwner2 });
    await aggregatorCContract.registerBattery(120, 80, { from: batteryOwner3 });

    const batteryA = await aggregatorAContract.batteries(batteryOwner1);
    const batteryB = await aggregatorBContract.batteries(batteryOwner2);
    const batteryC = await aggregatorCContract.batteries(batteryOwner3);

    console.log("Battery A owner: ", batteryA.owner);
    console.log("Battery B owner: ", batteryB.owner);
    console.log("Battery C owner: ", batteryC.owner);

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
    await aggregatorAContract.submitBid(50, 10, { from: batteryOwner1 });
    await aggregatorBContract.submitBid(100, 8, { from: batteryOwner2 });
    await aggregatorCContract.submitBid(70, 12, { from: batteryOwner3 });
    await aggregatorAContract.submitBid(30, 9, { from: batteryOwner1 });
    await aggregatorBContract.submitBid(60, 7, { from: batteryOwner2 });

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid2 = await market.bids(2);
    const bid3 = await market.bids(3);
    const bid4 = await market.bids(4);

    assert.equal(bid0.owner, batteryOwner1, "Bid 0 owner mismatch");
    assert.equal(bid0.amount, 50, "Bid 0 amount mismatch");
    assert.equal(bid0.price, 10, "Bid 0 price mismatch");

    assert.equal(bid1.owner, batteryOwner2, "Bid 1 owner mismatch");
    assert.equal(bid1.amount, 100, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 8, "Bid 1 price mismatch");

    assert.equal(bid2.owner, batteryOwner3, "Bid 2 owner mismatch");
    assert.equal(bid2.amount, 70, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 12, "Bid 2 price mismatch");

    assert.equal(bid3.owner, batteryOwner1, "Bid 3 owner mismatch");
    assert.equal(bid3.amount, 30, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 9, "Bid 3 price mismatch");

    assert.equal(bid4.owner, batteryOwner2, "Bid 4 owner mismatch");
    assert.equal(bid4.amount, 60, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 7, "Bid 4 price mismatch");
  });

  it("should accept bids", async () => {
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 3601); // Increase time to market close + 1 second

    await aggregatorAContract.acceptBid(0, { from: buyer1 });
    await aggregatorBContract.acceptBid(1, { from: buyer2 });
    await aggregatorAContract.acceptBid(3, { from: buyer2 });

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid3 = await market.bids(3);

    assert.equal(bid0.isAccepted, true, "Bid 0 not accepted");
    assert.equal(bid1.isAccepted, true, "Bid 1 not accepted");
    assert.equal(bid3.isAccepted, true, "Bid 3 not accepted");

    assert.equal(bid0.acceptedBy, buyer1, "Bid 0 accepted by mismatch");
    assert.equal(bid1.acceptedBy, buyer2, "Bid 1 accepted by mismatch");
    assert.equal(bid3.acceptedBy, buyer2, "Bid 3 accepted by mismatch");
    console.log("Bid 0 owner: ", bid0.owner);
    console.log("Bid 1 owner: ", bid1.owner);
    console.log("Bid 3 owner: ", bid3.owner);
    console.log("Buyer 1: ", buyer1);
    console.log("Buyer 2: ", buyer2);
  });

  it("should purchase energy", async () => {
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 7201); // Increase time to results announcement + 1 second

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid3 = await market.bids(3);
    console.log("Bid 0 owner: ", bid0.owner);
    console.log("Bid 1 owner: ", bid1.owner);
    console.log("Bid 3 owner: ", bid3.owner);

    const price0 = bid0.amount * bid0.price;
    const price1 = bid1.amount * bid1.price;
    const price3 = bid3.amount * bid3.price;

    console.log("Attempting to purchase bid 0 with price: ", price0);
    await aggregatorAContract.purchaseEnergy(0, {
      from: buyer1,
      value: price0,
    });
    console.log("Purchased bid 0");

    console.log("Attempting to purchase bid 1 with price: ", price1);
    await aggregatorBContract.purchaseEnergy(1, {
      from: buyer2,
      value: price1,
    });
    console.log("Purchased bid 1");

    console.log("Attempting to purchase bid 3 with price: ", price3);
    await aggregatorAContract.purchaseEnergy(3, {
      from: buyer2,
      value: price3,
    });
    console.log("Purchased bid 3");

    // Manually update SoC for testing purposes
    await aggregatorAContract.updateBatterySoC(0, { from: aggregatorA });
    await aggregatorBContract.updateBatterySoC(1, { from: aggregatorB });
    await aggregatorAContract.updateBatterySoC(3, { from: aggregatorA });

    const batteryA = await aggregatorAContract.batteries(aggregatorA);
    const batteryB = await aggregatorBContract.batteries(aggregatorB);

    // Calculate new SoC values
    const expectedSoCA = Math.ceil(
      85 - (bid0.amount * 100) / 100 - (bid3.amount * 100) / 100
    );
    const expectedSoCB = Math.ceil(90 - (bid1.amount * 100) / 150);

    assert.equal(
      batteryA.initial_soc.toNumber(),
      expectedSoCA,
      "Aggregator A battery SoC not updated correctly"
    );
    assert.equal(
      batteryB.initial_soc.toNumber(),
      expectedSoCB,
      "Aggregator B battery SoC not updated correctly"
    );
  });
});
