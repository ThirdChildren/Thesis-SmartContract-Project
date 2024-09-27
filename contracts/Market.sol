// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Aggregator.sol";

contract Market {
    uint public marketOpenTime;
    uint public marketCloseTime;
    uint public resultsAnnouncementTime;
    address public marketAdmin;

    event MarketTimesUpdated(uint openTime, uint closeTime, uint resultsTime);
    event BidPlaced(
        address indexed bidder,
        address batteryOwner,
        uint amount,
        uint price
    );
    event PurchaseConfirmed(
        address indexed buyer,
        address indexed seller,
        uint bidId
    );
    event BidAccepted(uint bidId, address indexed buyer);
    event CommissionPaid(address indexed aggregator, uint amount);
    event PaymentToBatteryOwnerRecorded(
        uint bidId,
        address indexed batteryOwner,
        address indexed buyer,
        uint amount
    );
    event PaymentToAggregatorOwnerRecorded(
        uint bidId,
        address indexed aggregator,
        address indexed buyer,
        uint commission
    );

    struct Bid {
        address bidder;
        address batteryOwner;
        uint amount; // in kWh
        uint price; // in wei per kWh
        bool isSelected;
        address acceptedBy;
    }

    mapping(uint => Bid) public bids;
    uint public bidCount;
    mapping(address => address) public aggregators; // maps batteries owners addresses to aggregator addresses

    modifier onlyMarketAdmin() {
        require(
            msg.sender == marketAdmin,
            "Only the Market Admin can perform this action"
        );
        _;
    }

    modifier onlyDuringMarketOpen() {
        require(
            block.timestamp >= marketOpenTime &&
                block.timestamp <= marketCloseTime,
            "Market is not open"
        );
        _;
    }

    modifier onlyDuringAcceptancePeriod() {
        require(
            block.timestamp > marketCloseTime &&
                block.timestamp < resultsAnnouncementTime,
            "Acceptance period is not open"
        );
        _;
    }

    modifier onlyDuringResultsAnnouncement() {
        require(
            block.timestamp >= resultsAnnouncementTime,
            "Results announcement period is not open"
        );
        _;
    }

    constructor(address _marketAdmin) {
        marketAdmin = _marketAdmin;
    }

    function setAggregator(address _owner, address _aggregator) public {
        aggregators[_owner] = _aggregator;
    }

    function setMarketTimes(
        uint _openTime,
        uint _closeTime,
        uint _resultsTime
    ) public onlyMarketAdmin {
        marketOpenTime = _openTime;
        marketCloseTime = _closeTime;
        resultsAnnouncementTime = _resultsTime;
        emit MarketTimesUpdated(_openTime, _closeTime, _resultsTime);
    }

    function placeBid(
        address _bidder,
        address _batteryOwner,
        uint _amount,
        uint _price
    ) public onlyDuringMarketOpen {
        require(_price > 0, "price must be greater than 0");

        address aggregatorAddress = aggregators[_batteryOwner];
        require(
            aggregatorAddress != address(0),
            "Aggregator not found for battery owner"
        );

        Aggregator aggregator = Aggregator(aggregatorAddress);
        // Verify that the battery's SoC is greater than 50%
        uint batterySoC = aggregator.getBatterySoC(_batteryOwner);
        uint batteryCapacity = aggregator.getBatteryCapacity(_batteryOwner);
        require(
            _amount * 100 <= batterySoC * batteryCapacity,
            "Amount placed exceeds battery capacity or SoC"
        );

        bids[bidCount] = Bid(
            _bidder,
            _batteryOwner,
            _amount,
            _price,
            false,
            address(0)
        );
        emit BidPlaced(_bidder, _batteryOwner, _amount, _price);
        bidCount++;
    }

    function acceptBid(uint _bidId) public onlyDuringAcceptancePeriod {
        require(bids[_bidId].bidder != address(0), "Bid does not exist");
        require(!bids[_bidId].isSelected, "Bid already selected");
        bids[_bidId].isSelected = true;
        bids[_bidId].acceptedBy = msg.sender;
        emit BidAccepted(_bidId, msg.sender);
    }

    function purchaseEnergy(
        uint _bidId
    ) public payable onlyDuringResultsAnnouncement {
        require(bids[_bidId].isSelected, "Bid not accepted");
        require(
            bids[_bidId].acceptedBy == msg.sender,
            "Only accepted buyer can purchase"
        );
        require(
            msg.value == bids[_bidId].amount * bids[_bidId].price,
            "Insufficient funds"
        );

        address owner = bids[_bidId].bidder;
        address batteryOwner = bids[_bidId].batteryOwner;

        address aggregatorAddress = aggregators[bids[_bidId].batteryOwner];
        Aggregator aggregator = Aggregator(aggregatorAddress);

        // commission calculation
        uint commission = (msg.value * aggregator.commissionRate()) / 100;

        payable(owner).transfer(commission);
        emit PaymentToAggregatorOwnerRecorded(
            _bidId,
            owner,
            msg.sender,
            commission
        ); // Log payment to aggregator owner

        payable(batteryOwner).transfer(msg.value - commission);
        emit PaymentToBatteryOwnerRecorded(
            _bidId,
            batteryOwner,
            msg.sender,
            msg.value - commission
        ); // Log payment to battery owner

        // Update the battery's SoC after the sale
        aggregator.updateBatterySoCAfterSale(
            bids[_bidId].batteryOwner,
            bids[_bidId].amount,
            true
        );
    }
}
