// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Aggregator.sol";
import "./Payment.sol";

contract Market {
    Payment public payment;

    uint public marketOpenTime;
    uint public marketCloseTime;
    uint public resultsAnnouncementTime;

    event MarketTimesUpdated(uint openTime, uint closeTime, uint resultsTime);
    event BidPlaced(address indexed bidder, uint amount, uint price);
    event PurchaseConfirmed(
        address indexed buyer,
        address indexed seller,
        uint bidId
    );
    event CommissionPaid(address indexed aggregator, uint amount);

    struct Bid {
        address bidder;
        uint amount; // in kWh
        uint price; // in wei per kWh
        bool isSelected;
    }

    mapping(uint => Bid) public bids;
    uint public bidCount;
    mapping(address => uint) public balances; // maps battery owners addresses to their balances
    mapping(address => address) public aggregators; // maps batteries owners addresses to aggregator addresses

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

    constructor(address payable _payment) {
        payment = Payment(_payment);
    }

    function setAggregator(address _owner, address _aggregator) public {
        aggregators[_owner] = _aggregator;
    }

    function setMarketTimes(
        uint _openTime,
        uint _closeTime,
        uint _resultsTime
    ) public {
        marketOpenTime = _openTime;
        marketCloseTime = _closeTime;
        resultsAnnouncementTime = _resultsTime;
        emit MarketTimesUpdated(_openTime, _closeTime, _resultsTime);
    }

    function placeBid(uint _amount, uint _price) public onlyDuringMarketOpen {
        require(_price > 0, "price must be greater than 0");
        bids[bidCount] = Bid(msg.sender, _amount, _price, false);
        emit BidPlaced(msg.sender, _amount, _price);
        bidCount++;
    }

    function depositFunds() public payable {
        // questa funzione permette al buyer di depositare fondi per l'acquisto dal mercato
        balances[msg.sender] += msg.value;
    }

    function confirmPurchase(
        address _buyer,
        address _seller,
        uint _bidId
    ) public onlyDuringAcceptancePeriod {
        Bid storage bid = bids[_bidId];
        require(!bid.isSelected, "Bid is already selected");
        bid.isSelected = true;
        (uint _amount, uint _price) = (bid.amount, bid.price);
        uint totalCost = _amount * _price;
        address aggregatorAddress = aggregators[_seller];
        Aggregator aggregator = Aggregator(aggregatorAddress);

        uint commission = (totalCost * aggregator.commissionRate()) / 100;
        uint amountAfterCommission = totalCost - commission;

        require(balances[_buyer] >= totalCost, "Insufficient funds for buyer");

        balances[_seller] += amountAfterCommission;
        balances[aggregatorAddress] += commission;
        balances[_buyer] -= totalCost;

        // Update the battery's SoC after the sale
        aggregator.updateBatterySoCAfterSale(_seller, _amount);

        emit PurchaseConfirmed(_buyer, _seller, _bidId);
        emit CommissionPaid(aggregatorAddress, commission);
    }

    function settlePayments() public payable onlyDuringResultsAnnouncement {
        for (uint i = 0; i < bidCount; i++) {
            Bid memory bid = bids[i];
            if (bid.isSelected) {
                address aggregatorAddress = aggregators[bid.bidder];
                require(
                    balances[aggregatorAddress] > 0,
                    "Aggregator balance is 0"
                );
                uint aggregatorBalance = balances[aggregatorAddress];
                balances[aggregatorAddress] = 0; // reset balance before payment to prevent re-entrancy
                payment.processPayment(aggregatorAddress, aggregatorBalance);

                require(balances[bid.bidder] > 0, "Bidder balance is 0");
                uint bidderBalance = balances[bid.bidder];
                balances[bid.bidder] = 0; // reset balance before payment to prevent re-entrancy
                payment.processPayment(bid.bidder, bidderBalance);
            }
        }
    }
}
