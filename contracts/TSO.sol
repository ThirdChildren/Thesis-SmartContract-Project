// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Aggregator.sol";

contract TSO {
    struct Bid {
        address bidder;
        address batteryOwner;
        uint amount; // in kWh
        uint price; // in wei per kWh
        bool isSelected;
    }

    Aggregator public aggregator;
    mapping(address => address) public aggregators; // maps batteries owners addresses to aggregator addresses
    mapping(uint => Bid) public bids;
    uint public bidCount;
    bool public marketOpen;
    uint public requiredEnergy; // energy need from TSO
    bool public isPositiveReserve; // True for positive reserve, False for negative reserve
    address public tsoAdmin;

    uint public nextBidIndex; // Indice della prossima bid da selezionare
    uint public nextPaymentIndex; // Indice del prossimo pagamento da elaborare
    uint public totalSelectedEnergy; // Energia totale selezionata

    event MarketOpened(uint requiredEnergy, bool isPositiveReserve);
    event BidPlaced(
        address indexed bidder,
        address batteryOwner,
        uint amount,
        uint price
    );
    event MarketClosed();
    event BidSelected(address indexed batteryOwner, uint amount, uint price);
    event PaymentToAggregatorOwnerRecorded(
        address indexed bidder,
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

    constructor(address _tsoAdmin) {
        tsoAdmin = _tsoAdmin;
    }

    function openMarket(
        uint _requiredEnergy,
        bool _isPositiveReserve
    ) external onlyTsoAdmin {
        requiredEnergy = _requiredEnergy;
        isPositiveReserve = _isPositiveReserve;
        marketOpen = true;
        emit MarketOpened(requiredEnergy, isPositiveReserve);
    }

    function placeBid(
        address _bidder,
        address _batteryOwner,
        uint _amount,
        uint _price
    ) external onlyWhenMarketOpen {
        uint batterySoC = aggregator.getBatterySoC(msg.sender);
        if (isPositiveReserve) {
            require(batterySoC >= 50, "Insufficient SoC to join the market");
        } else {
            require(batterySoC < 100, "Battery is full");
        }

        require(_price > 0, "price must be greater than 0");

        address aggregatorAddress = aggregators[_batteryOwner];
        require(
            aggregatorAddress != address(0),
            "Aggregator not found for battery owner"
        );

        bids[bidCount] = Bid(_bidder, _batteryOwner, _amount, _price, false);
        emit BidPlaced(_bidder, _batteryOwner, _amount, _price);
        bidCount++;
    }

    function closeMarket() external {
        require(marketOpen, "Market is already closed");
        marketOpen = false;
        emit MarketClosed();
    }

    function selectNextBid() external onlyTsoAdmin {
        require(!marketOpen, "Market is still open");
        require(nextBidIndex < bidCount, "All bids processed");

        uint energySelected = totalSelectedEnergy; // Track total selected energy
        if (energySelected < requiredEnergy) {
            bids[nextBidIndex].isSelected = true;
            energySelected += bids[nextBidIndex].amount;
            totalSelectedEnergy = energySelected; // Update the total selected energy
            emit BidSelected(
                bids[nextBidIndex].batteryOwner,
                bids[nextBidIndex].amount,
                bids[nextBidIndex].price
            );
        }
        nextBidIndex++; // Move to the next bid
    }

    function processNextPayment() external {
        require(!marketOpen, "Market is still open");
        require(nextPaymentIndex < bidCount, "All payments processed");

        Bid storage bid = bids[nextPaymentIndex];
        if (bid.isSelected) {
            uint payment = bid.amount * bid.price;
            uint commission = (payment * aggregator.commissionRate()) / 100;

            // Pay battery owner
            payable(bid.batteryOwner).transfer(payment - commission);
            emit PaymentToBatteryOwnerRecorded(
                bid.batteryOwner,
                payment - commission
            );

            // Pay aggregator
            payable(address(aggregator)).transfer(commission);
            emit PaymentToAggregatorOwnerRecorded(bid.bidder, commission);

            // Update battery SoC only if positive reserve
            // Update battery SoC
            aggregator.updateBatterySoCAfterSale(
                bid.batteryOwner,
                bid.amount,
                isPositiveReserve
            );
        }

        nextPaymentIndex++; // Move to the next payment
    }
}
