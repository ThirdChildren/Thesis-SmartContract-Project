// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Aggregator.sol";
import "./Payment.sol";

contract Market {
    //Payment public payment;

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
    event PaymentRecorded(
        uint bidId,
        address indexed owner,
        address indexed aggregator,
        uint ownerAmount,
        uint aggregatorAmount
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
    mapping(address => uint) public balances; // maps battery owners addresses to their balances
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

    /* constructor(address payable _payment) {
        payment = Payment(_payment);
    } */
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
        address _batteryOwner,
        uint _amount,
        uint _price
    ) public onlyDuringMarketOpen {
        require(_price > 0, "price must be greater than 0");
        bids[bidCount] = Bid(
            msg.sender,
            _batteryOwner,
            _amount,
            _price,
            false,
            address(0)
        );
        emit BidPlaced(msg.sender, _batteryOwner, _amount, _price);
        bidCount++;
    }

    function depositFunds() public payable {
        // questa funzione permette al buyer di depositare fondi per l'acquisto dal mercato
        balances[msg.sender] += msg.value;
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
        uint amount = bids[_bidId].amount;
        uint price = bids[_bidId].price;

        payable(owner).transfer(msg.value);

        // Update the battery's SoC after the sale
        address aggregatorAddress = aggregators[bids[_bidId].batteryOwner];
        Aggregator aggregator = Aggregator(aggregatorAddress);

        aggregator.updateBatterySoCAfterSale(bids[_bidId].batteryOwner, amount);

        emit PaymentRecorded(_bidId, msg.sender, owner, amount, price);
    }

    /* function confirmPurchase(
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
    } */

    /* function purchaseEnergy(
        uint _bidId,
        address _seller
    ) public payable onlyDuringResultsAnnouncement {
        require(bids[_bidId].isSelected, "Bid not accepted");
        require(
            bids[_bidId].bidder == _seller,
            "Only the bidder can sell the energy"
        );
        address owner = bids[_bidId].bidder;

        address aggregatorAddress = aggregators[_seller];
        require(balances[aggregatorAddress] > 0, "Aggregator balance is 0");
        uint aggregatorBalance = balances[aggregatorAddress];
        balances[aggregatorAddress] = 0; // reset balance before payment to prevent re-entrancy
        payable(aggregatorAddress).transfer(aggregatorBalance);

        require(balances[bids[_bidId].bidder] > 0, "Bidder balance is 0");
        uint bidderBalance = balances[bids[_bidId].bidder];
        balances[bids[_bidId].bidder] = 0; // reset balance before payment to prevent re-entrancy
        payable(owner).transfer(bidderBalance);

        emit PaymentRecorded(
            _bidId,
            owner,
            aggregatorAddress,
            bidderBalance,
            aggregatorBalance
        );
    } */
}
