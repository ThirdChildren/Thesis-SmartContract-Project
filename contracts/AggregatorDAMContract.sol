// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./MarketContract.sol";

contract AggregatorDAMContract {
    struct Battery {
        address owner;
        uint8 capacity; // in kWh
        uint8 initial_soc;
        bool isRegistered;
    }

    mapping(address => Battery) public batteries;
    MarketContract public market;

    event BatteryRegistered(address indexed owner, uint8 capacity, uint8 SoC);
    event BidSubmitted(address indexed owner, uint8 amount, uint8 price);
    event EnergyPurchasedFromMarket(
        address indexed buyer,
        uint bidId,
        uint amount,
        uint price
    );
    event BatterySoCUpdated(address indexed owner, uint8 newSoC);

    modifier batteryIsNotRegistered() {
        require(
            !batteries[msg.sender].isRegistered,
            "Battery already registered"
        );
        _;
    }
    modifier batteryIsRegistered() {
        require(
            batteries[msg.sender].isRegistered,
            "Battery is not registered yet"
        );
        _;
    }
    modifier checkSoC(uint8 _SoC) {
        require(_SoC >= 50, "Value of SoC is not enough to sell energy.");
        _;
    }
    modifier batteryCapacity(uint8 _amount) {
        require(
            _amount <= batteries[msg.sender].capacity,
            "Insufficient capacity"
        );
        _;
    }

    constructor(address _marketAddress) {
        market = MarketContract(_marketAddress);
    }

    function registerBattery(
        uint8 _capacity,
        uint8 _SoC
    ) external batteryIsNotRegistered checkSoC(_SoC) {
        batteries[msg.sender] = Battery(msg.sender, _capacity, _SoC, true);
        emit BatteryRegistered(msg.sender, _capacity, _SoC);
    }

    function submitBid(
        uint8 _amount,
        uint8 _price
    ) external batteryIsRegistered batteryCapacity(_amount) {
        // Pass the battery owner's address to the market contract
        market.placeBid(_amount, _price, msg.sender);
        emit BidSubmitted(msg.sender, _amount, _price);
    }

    function acceptBid(uint8 _bidId) public {
        market.acceptBid(_bidId);
    }

    function purchaseEnergy(uint _bidId) public payable {
        market.purchaseEnergy{value: msg.value}(_bidId);
        (, uint amount, uint price, , ) = market.bids(_bidId);
        emit EnergyPurchasedFromMarket(msg.sender, _bidId, amount, price);
    }

    function updateBatterySoC(uint8 _bidId) external batteryIsRegistered {
        // Decrease the SoC of the battery based on the energy sold
        (address owner, uint amount, , , ) = market.bids(_bidId);
        Battery storage battery = batteries[owner];
        uint8 newSoc = uint8(
            battery.initial_soc - ((amount * 100) / battery.capacity)
        ); // calculate new SoC
        battery.initial_soc = newSoc; // update the SoC
        emit BatterySoCUpdated(msg.sender, newSoc);
    }
}
