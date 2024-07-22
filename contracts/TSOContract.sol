// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TSOContract {
    struct Bid {
        address owner;
        uint amount; // in kWh
        uint price; // in wei per kWh
        bool isSelected;
        address acceptedBy;
    }

    mapping(uint => Bid) public bids;
    uint public bidCount;
    address public tsoAdmin;

    uint public marketOpenTime;
    uint public marketCloseTime;

    event BidPlaced(uint bidId, address indexed owner, uint amount, uint price);
    event BidSelected(uint bidId);
    event PaymentMade(uint bidId, uint amount);
    event ReserveRequested(uint amount, bool isPositive);
    event MarketTimesUpdated(uint marketOpenTime, uint marketCloseTime);
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

    modifier onlyTSO() {
        require(msg.sender == tsoAdmin, "Only TSO can call this function");
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

    constructor(
        address _tsoAdmin,
        uint _marketOpenTime,
        uint _marketCloseTime
    ) {
        tsoAdmin = _tsoAdmin;
        marketOpenTime = _marketOpenTime;
        marketCloseTime = _marketCloseTime;
    }

    function updateMarketTimes(
        uint _marketOpenTime,
        uint _marketCloseTime
    ) public onlyTSO {
        marketOpenTime = _marketOpenTime;
        marketCloseTime = _marketCloseTime;
        emit MarketTimesUpdated(marketOpenTime, marketCloseTime);
    }

    function requestReserve(uint amount, bool isPositive) public onlyTSO {
        emit ReserveRequested(amount, isPositive);
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

    function selectBid(uint _bidId) public onlyTSO onlyDuringMarketOpen {
        require(bids[_bidId].owner != address(0), "Bid does not exist");
        require(!bids[_bidId].isSelected, "Bid already selected");
        bids[_bidId].isSelected = true;
        emit BidSelected(_bidId);
    }

    function makePayment(uint _bidId) public payable onlyTSO {
        require(bids[_bidId].isSelected, "Bid not selected");
        require(msg.value > 0, "Payment must be greater than 0");

        address owner = bids[_bidId].owner;
        uint amount = bids[_bidId].amount;
        uint price = bids[_bidId].price;

        payable(owner).transfer(msg.value);
        emit PaymentRecorded(_bidId, msg.sender, owner, amount, price);
        emit EnergyPurchased(_bidId, msg.sender, owner, amount, price);
    }
}
