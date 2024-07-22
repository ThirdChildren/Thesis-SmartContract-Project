// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "./TSOContract.sol";

contract AggregatorAfrrContract {
    struct Battery {
        address owner;
        uint capacity; // in kWh
        uint initial_soc;
        bool isRegistered;
    }
    uint8 public commissionRate; // in basis points (e.g., 500 means 5%)
    mapping(address => Battery) public batteries;
    TSOContract public tso;

    event BatteryRegistered(address indexed owner, uint capacity, uint soc);
    event BidSubmitted(address indexed owner, uint amount, uint price);
    event PaymentReceived(uint bidId, uint amount);
    event BatteryUpdated(address indexed owner, uint newSoc);

    constructor(address _tsoAddress, uint _commissionRate) {
        tso = TSOContract(_tsoAddress);
        commissionRate = uint8(_commissionRate);
    }

    modifier batteryIsRegistered() {
        require(
            batteries[msg.sender].isRegistered,
            "Battery is not registered yet"
        );
        _;
    }

    modifier batteryIsNotRegistered() {
        require(
            !batteries[msg.sender].isRegistered,
            "Battery already registered"
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
        tso.placeBid(_amount, _price, msg.sender);
        emit BidSubmitted(msg.sender, _amount, _price);
    }

    function updateBatterySoC(
        uint8 _bidId,
        bool isCharging
    ) external batteryIsRegistered {
        (address owner, uint amount, , , ) = tso.bids(_bidId);
        Battery storage battery = batteries[owner];
        uint8 newSoc = 0;
        if (isCharging) {
            newSoc = uint8(
                battery.initial_soc + ((amount * 100) / battery.capacity)
            );
        } else {
            newSoc = uint8(
                battery.initial_soc - ((amount * 100) / battery.capacity)
            );
        }

        battery.initial_soc = newSoc; // update the SoC

        emit BatteryUpdated(msg.sender, newSoc);
    }

    /* function receivePayment(uint bidId) public payable {
        require(bids[bidId].selected, "Bid not selected");

        uint commission = (msg.value * commissionRate) / 10000;
        uint payment = msg.value - commission;

        // Send the payment to the battery owner
        payable(bids[bidId].aggregator).transfer(payment);
        emit PaymentReceived(bidId, payment);

        // Send the commission to the aggregator owner
        payable(owner).transfer(commission);
    } */
}
