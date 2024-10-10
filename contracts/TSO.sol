// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Aggregator.sol";
import "hardhat/console.sol";

contract TSO {
    struct Bid {
        address batteryOwner;
        uint amount; // in kWh
        uint price; // in wei per kWh
        bool isSelected;
    }

    mapping(uint => Bid) public bids; // Mapping of bids with bidId as key
    bool public marketOpen;
    uint public requiredEnergy; // Energy need from TSO
    bool public isPositiveReserve; // True for positive reserve, False for negative reserve
    address public tsoAdmin; // Admin address, initialized to msg.sender
    uint public bidCount;
    uint public totalSelectedEnergy; // Total selected energy

    Aggregator public aggregator; // Single aggregator contract reference

    event MarketOpened(uint requiredEnergy, bool isPositiveReserve);
    event BidPlaced(address batteryOwner, uint amount, uint price);
    event MarketClosed();
    event BidSelected(address indexed batteryOwner, uint amount, uint price);
    event PaymentToAggregatorOwnerRecorded(
        address indexed aggregatorOwner,
        uint commission
    );
    event PaymentToBatteryOwnerRecorded(
        address indexed batteryOwner,
        uint payment
    );

    modifier onlyTsoAdmin() {
        require(
            msg.sender == tsoAdmin,
            "Only the TSO Admin can perform this action"
        );
        _;
    }

    modifier onlyWhenMarketOpen() {
        require(marketOpen, "Market is not open");
        _;
    }

    constructor(address _aggregatorAddress) {
        tsoAdmin = msg.sender;
        aggregator = Aggregator(_aggregatorAddress); // Initialize the aggregator contract
    }

    function openMarket(
        uint _requiredEnergy,
        bool _isPositiveReserve
    ) external {
        require(marketOpen == false, "Market is already open");
        requiredEnergy = _requiredEnergy;
        isPositiveReserve = _isPositiveReserve;
        marketOpen = true;
        emit MarketOpened(requiredEnergy, isPositiveReserve);
    }

    function placeBid(
        address _batteryOwner,
        uint _amountInKWh, // Volume in kWh
        uint _pricePerMWh // Price in EUR/MWh
    ) external onlyWhenMarketOpen {
        /* require(
            msg.sender == aggregatorAdmin,
            "Only the aggregator can place the bid"
        ); */

        uint batterySoC = aggregator.getBatterySoC(_batteryOwner);
        uint batteryCapacity = aggregator.getBatteryCapacity(_batteryOwner);

        if (isPositiveReserve) {
            require(
                _amountInKWh * 100 <= batterySoC * batteryCapacity,
                "Amount placed exceeds battery capacity or SoC"
            );
        } else {
            require(batterySoC < 100, "Battery is full");
        }

        // Ensure the price is positive
        require(_pricePerMWh > 0, "Price must be greater than 0");

        // Convert price per MWh to price per kWh
        uint _totalPrice = (_pricePerMWh * _amountInKWh) / 1000;

        bids[bidCount] = Bid(_batteryOwner, _amountInKWh, _totalPrice, false);

        emit BidPlaced(_batteryOwner, _amountInKWh, _totalPrice);
        bidCount++;
    }

    function closeMarket() external {
        require(marketOpen, "Market is already closed");
        marketOpen = false;
        emit MarketClosed();
    }

    function acceptBid(uint _bidId) external payable {
        require(!marketOpen, "Market is still open");
        uint energySelected = totalSelectedEnergy;
        require(
            energySelected < requiredEnergy,
            "Required energy already selected"
        );

        bids[_bidId].isSelected = true;
        energySelected += bids[_bidId].amount;
        totalSelectedEnergy = energySelected;
        emit BidSelected(
            bids[_bidId].batteryOwner,
            bids[_bidId].amount,
            bids[_bidId].price
        );

        this.processPayment{value: msg.value}(_bidId);
    }

    function processPayment(uint _bidId) public payable {
        require(bids[_bidId].isSelected, "Bid not accepted");
        //require(msg.value == bids[_bidId].price, "Insufficient funds");

        uint commission = (msg.value * aggregator.commissionRate()) / 100;
        uint batteryOwnerPayment = msg.value - commission;

        // Pay the battery owner
        payable(bids[_bidId].batteryOwner).transfer(batteryOwnerPayment);
        emit PaymentToBatteryOwnerRecorded(
            bids[_bidId].batteryOwner,
            batteryOwnerPayment
        );

        // Pay the aggregator (owner of the aggregator contract)
        payable(aggregator.owner()).transfer(commission);
        emit PaymentToAggregatorOwnerRecorded(aggregator.owner(), commission);

        // Update the battery SoC after sale
        aggregator.updateBatterySoCAfterSale(
            bids[_bidId].batteryOwner,
            bids[_bidId].amount,
            isPositiveReserve
        );
    }
}
