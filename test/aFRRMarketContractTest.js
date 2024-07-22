const AggregatorContract = artifacts.require("AggregatorContract");
const TSOContract = artifacts.require("TSOContract");

contract("Energy Market", (accounts) => {
  let aggregatorInstance;
  let tsoInstance;
  const owner = accounts[0];
  const batteryOwner1 = accounts[1];
  const batteryOwner2 = accounts[2];
  const tsoAddress = accounts[3];

  before(async () => {
    aggregatorInstance = await AggregatorContract.new(500); // Commission rate 5%
    tsoInstance = await TSOContract.new(aggregatorInstance.address, {
      from: tsoAddress,
    });
  });

  it("should register batteries", async () => {
    await aggregatorInstance.registerBattery(100, 80, { from: batteryOwner1 });
    await aggregatorInstance.registerBattery(200, 90, { from: batteryOwner2 });

    const battery1 = await aggregatorInstance.batteries(batteryOwner1);
    assert.equal(
      battery1.capacity.toNumber(),
      100,
      "Battery1 capacity is incorrect"
    );
    assert.equal(battery1.soc.toNumber(), 80, "Battery1 SoC is incorrect");

    const battery2 = await aggregatorInstance.batteries(batteryOwner2);
    assert.equal(
      battery2.capacity.toNumber(),
      200,
      "Battery2 capacity is incorrect"
    );
    assert.equal(battery2.soc.toNumber(), 90, "Battery2 SoC is incorrect");
  });

  it("should open and close market", async () => {
    const currentTime = Math.floor(Date.now() / 1000);

    await tsoInstance.updateMarketTimes(currentTime - 10, currentTime + 100, {
      from: tsoAddress,
    });
    assert.equal(
      await tsoInstance.marketOpenTime(),
      currentTime - 10,
      "Market open time is incorrect"
    );
    assert.equal(
      await tsoInstance.marketCloseTime(),
      currentTime + 100,
      "Market close time is incorrect"
    );
  });

  it("should place bids", async () => {
    const amount = 50;
    const price = web3.utils.toWei("1", "ether");
    const isPositive = true;

    await aggregatorInstance.placeBid(amount, price, isPositive, {
      from: batteryOwner1,
    });

    const bid = await aggregatorInstance.bids(0);
    assert.equal(bid.aggregator, batteryOwner1, "Bid aggregator is incorrect");
    assert.equal(bid.amount.toNumber(), amount, "Bid amount is incorrect");
    assert.equal(bid.price.toString(), price, "Bid price is incorrect");
    assert.equal(bid.isPositive, isPositive, "Bid type is incorrect");
  });

  it("should select bid and update SoC", async () => {
    await tsoInstance.selectBid(0, { from: tsoAddress });
    const bid = await aggregatorInstance.bids(0);
    assert(bid.selected, "Bid should be selected");

    const battery1 = await aggregatorInstance.batteries(batteryOwner1);
    assert.equal(battery1.soc.toNumber(), 30, "Battery1 SoC should be updated");
  });

  it("should make payment and distribute correctly", async () => {
    const bidId = 0;
    const payment = web3.utils.toWei("5", "ether");

    const initialBalance = web3.utils.toBN(
      await web3.eth.getBalance(batteryOwner1)
    );
    await tsoInstance.makePayment(bidId, { from: tsoAddress, value: payment });

    const finalBalance = web3.utils.toBN(
      await web3.eth.getBalance(batteryOwner1)
    );
    const commission = web3.utils
      .toBN(payment)
      .mul(web3.utils.toBN(500))
      .div(web3.utils.toBN(10000));
    const expectedPayment = web3.utils.toBN(payment).sub(commission);

    assert(
      finalBalance.sub(initialBalance).eq(expectedPayment),
      "Payment distribution is incorrect"
    );
  });

  it("should handle multiple aggregators", async () => {
    const aggregatorInstance2 = await AggregatorContract.new(500);
    await aggregatorInstance2.registerBattery(150, 75, { from: batteryOwner2 });

    const battery2 = await aggregatorInstance2.batteries(batteryOwner2);
    assert.equal(
      battery2.capacity.toNumber(),
      150,
      "Battery2 capacity in Aggregator2 is incorrect"
    );
    assert.equal(
      battery2.soc.toNumber(),
      75,
      "Battery2 SoC in Aggregator2 is incorrect"
    );
  });

  it("should handle both positive and negative reserves", async () => {
    const currentTime = Math.floor(Date.now() / 1000);
    await tsoInstance.updateMarketTimes(currentTime - 10, currentTime + 100, {
      from: tsoAddress,
    });

    // Positive reserve
    await aggregatorInstance.placeBid(
      50,
      web3.utils.toWei("1", "ether"),
      true,
      { from: batteryOwner1 }
    );
    await tsoInstance.selectBid(1, { from: tsoAddress });
    await tsoInstance.makePayment(1, {
      from: tsoAddress,
      value: web3.utils.toWei("5", "ether"),
    });

    // Negative reserve
    await aggregatorInstance.placeBid(
      50,
      web3.utils.toWei("1", "ether"),
      false,
      { from: batteryOwner2 }
    );
    await tsoInstance.selectBid(2, { from: tsoAddress });
    await tsoInstance.makePayment(2, {
      from: tsoAddress,
      value: web3.utils.toWei("5", "ether"),
    });
  });
});
