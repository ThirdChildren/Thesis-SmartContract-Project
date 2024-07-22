// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract MarketContract {
    struct Bid {
        address owner;
        uint amount; // in kWh
        uint price; // in wei per kWh
        bool isAccepted;
        address acceptedBy;
    }

    mapping(uint => Bid) public bids;
    uint public bidCount;
    address public marketAdmin;

    uint public marketOpenTime;
    uint public marketCloseTime;
    uint public resultsAnnouncementTime;

    event BidPlaced(uint bidId, address indexed owner, uint amount, uint price);
    event BidAccepted(uint bidId, address indexed buyer);
    event MarketTimesUpdated(uint openTime, uint closeTime, uint resultsTime);
    event EnergyPurchased(
        uint bidId,
        address indexed buyer,
        address owner,
        uint amount,
        uint price
    );
    event PaymentRecorded(
        uint bidId,
        address indexed buyer,
        address indexed owner,
        uint amount,
        uint price
    );

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

    constructor(
        address _marketAdmin,
        uint _marketOpenTime,
        uint _marketCloseTime,
        uint _resultsAnnouncementTime
    ) {
        marketAdmin = _marketAdmin;
        marketOpenTime = _marketOpenTime;
        marketCloseTime = _marketCloseTime;
        resultsAnnouncementTime = _resultsAnnouncementTime;
    }

    function updateMarketTimes(
        uint _marketOpenTime,
        uint _marketCloseTime,
        uint _resultsAnnouncementTime
    ) public onlyMarketAdmin {
        marketOpenTime = _marketOpenTime;
        marketCloseTime = _marketCloseTime;
        resultsAnnouncementTime = _resultsAnnouncementTime;
        emit MarketTimesUpdated(
            marketOpenTime,
            marketCloseTime,
            resultsAnnouncementTime
        );
    }

    function placeBid(
        uint _amount,
        uint _price,
        address _owner
    ) public onlyDuringMarketOpen {
        bids[bidCount] = Bid(_owner, _amount, _price, false, address(0));
        emit BidPlaced(bidCount, _owner, _amount, _price);
        bidCount++;
    }

    function acceptBid(uint _bidId) public onlyDuringAcceptancePeriod {
        require(bids[_bidId].owner != address(0), "Bid does not exist");
        require(!bids[_bidId].isAccepted, "Bid already accepted");
        bids[_bidId].isAccepted = true;
        bids[_bidId].acceptedBy = msg.sender;
        emit BidAccepted(_bidId, msg.sender);
    }

    function purchaseEnergy(
        uint _bidId
    ) public payable onlyDuringResultsAnnouncement {
        require(bids[_bidId].isAccepted, "Bid not accepted");
        require(
            bids[_bidId].acceptedBy == msg.sender,
            "Only accepted buyer can purchase"
        );
        require(
            msg.value >= bids[_bidId].amount * bids[_bidId].price,
            "Insufficient funds"
        );

        address owner = bids[_bidId].owner;
        uint amount = bids[_bidId].amount;
        uint price = bids[_bidId].price;

        payable(owner).transfer(msg.value);
        emit PaymentRecorded(_bidId, msg.sender, owner, amount, price);
        emit EnergyPurchased(_bidId, msg.sender, owner, amount, price);
    }
}
