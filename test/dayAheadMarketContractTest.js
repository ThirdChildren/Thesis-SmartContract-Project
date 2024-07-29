const Aggregator = artifacts.require("Aggregator");
const Market = artifacts.require("Market");
const Payment = artifacts.require("Payment");
const { time } = require("@openzeppelin/test-helpers");

contract("Day Ahead Market Contract", (accounts) => {
  const [buyer, owner1, owner2, owner3, owner4, owner5, owner6] = accounts;

  let aggregatorContract1;
  let aggregatorContract2;
  let aggregatorContract3;
  let market;
  let payment;

  before(async () => {
    payment = await Payment.new();
    aggregatorContract1 = await Aggregator.new(5); // 5% commission rate
    aggregatorContract2 = await Aggregator.new(5); // 5% commission rate
    aggregatorContract3 = await Aggregator.new(5); // 5% commission rate
    market = await Market.new(payment.address);

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
      from: owner1,
    });
    await aggregatorContract1.registerBattery(owner2, 150, 85, true, {
      from: owner2,
    });

    // Register batteries for Aggregator 2
    await aggregatorContract2.registerBattery(owner3, 120, 70, true, {
      from: owner3,
    });
    await aggregatorContract2.registerBattery(owner4, 130, 75, true, {
      from: owner4,
    });

    // Register batteries for Aggregator 3
    await aggregatorContract3.registerBattery(owner5, 180, 90, true, {
      from: owner5,
    });
    await aggregatorContract3.registerBattery(owner6, 100, 65, true, {
      from: owner6,
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
    await market.placeBid(50, 10, { from: owner1 });
    await market.placeBid(75, 12, { from: owner2 });
    await market.placeBid(60, 8, { from: owner3 });
    await market.placeBid(70, 6, { from: owner4 });
    await market.placeBid(80, 15, { from: owner5 });
    await market.placeBid(90, 7, { from: owner6 });

    const bid0 = await market.bids(0);
    const bid1 = await market.bids(1);
    const bid2 = await market.bids(2);
    const bid3 = await market.bids(3);
    const bid4 = await market.bids(4);
    const bid5 = await market.bids(5);

    assert.equal(bid0.bidder, owner1, "Bid 0 owner mismatch");
    assert.equal(bid0.amount, 50, "Bid 0 amount mismatch");
    assert.equal(bid0.price, 10, "Bid 0 price mismatch");

    assert.equal(bid1.bidder, owner2, "Bid 1 owner mismatch");
    assert.equal(bid1.amount, 75, "Bid 1 amount mismatch");
    assert.equal(bid1.price, 12, "Bid 1 price mismatch");

    assert.equal(bid2.bidder, owner3, "Bid 2 owner mismatch");
    assert.equal(bid2.amount, 60, "Bid 2 amount mismatch");
    assert.equal(bid2.price, 8, "Bid 2 price mismatch");

    assert.equal(bid3.bidder, owner4, "Bid 3 owner mismatch");
    assert.equal(bid3.amount, 70, "Bid 3 amount mismatch");
    assert.equal(bid3.price, 6, "Bid 3 price mismatch");

    assert.equal(bid4.bidder, owner5, "Bid 4 owner mismatch");
    assert.equal(bid4.amount, 80, "Bid 4 amount mismatch");
    assert.equal(bid4.price, 15, "Bid 4 price mismatch");

    assert.equal(bid5.bidder, owner6, "Bid 5 owner mismatch");
    assert.equal(bid5.amount, 90, "Bid 5 amount mismatch");
    assert.equal(bid5.price, 7, "Bid 5 price mismatch");
  });

  it("should confirm some purchases and deduct commission", async () => {
    // Deposit sufficient funds for the buyer
    await market.depositFunds({
      from: buyer,
      value: web3.utils.toWei("2", "ether"),
    });
    // Increase time to market close + 1 second
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 3601);

    // Confirm purchases (some bids)
    await market.confirmPurchase(buyer, owner1, 50, 10, { from: buyer });
    await market.confirmPurchase(buyer, owner4, 70, 6, { from: buyer });

    const balanceOwner1 = await market.balances(owner1);
    const balanceOwner4 = await market.balances(owner4);
    const balanceAggregator1 = await market.balances(
      aggregatorContract1.address
    );
    const balanceAggregator2 = await market.balances(
      aggregatorContract2.address
    );

    assert.equal(
      balanceOwner1.toString(),
      "475",
      "Owner1 balance incorrect after commission"
    );
    assert.equal(
      balanceOwner4.toString(),
      "399",
      "Owner4 balance incorrect after commission"
    );
    assert.equal(
      balanceAggregator1.toString(),
      "25",
      "Aggregator1 balance incorrect after commission"
    );
    assert.equal(
      balanceAggregator2.toString(),
      "21",
      "Aggregator2 balance incorrect after commission"
    );
  });

  /* it("should settle payments during results announcement", async () => {
    // Deposit sufficient funds to the market contract for payments
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: market.address,
      value: web3.utils.toWei("10", "ether"),
    });

    // Increase time to results announcement + 1 second
    await time.increaseTo((await web3.eth.getBlock("latest")).timestamp + 61);

    await market.settlePayments({ from: accounts[0] });

    // Check that the balances are reset and payments are processed
    const balanceOwner1 = await market.balances(owner1);
    const balanceOwner4 = await market.balances(owner4);
    const balanceAggregator1 = await market.balances(aggregatorContract1.address);
    const balanceAggregator2 = await market.balances(aggregatorContract2.address);

    assert.equal(balanceOwner1.toString(), "0", "Owner1 balance should be 0 after payment");
    assert.equal(balanceOwner4.toString(), "0", "Owner4 balance should be 0 after payment");
    assert.equal(balanceAggregator1.toString(), "0", "Aggregator1 balance should be 0 after payment");
    assert.equal(balanceAggregator2.toString(), "0", "Aggregator2 balance should be 0 after payment");
  }); */
});
