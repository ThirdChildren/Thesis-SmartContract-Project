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
        if (isPositiveReserve) {
            uint batterySoC = aggregator.getBatterySoC(msg.sender);
            require(batterySoC >= 50, "Insufficient SoC to join the market");
        }

        require(_price > 0, "price must be greater than 0");

        // Ottieni l'indirizzo del contratto dell'aggregator associato
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

    function selectBids() external onlyTsoAdmin {
        require(!marketOpen, "Market is still open");
        uint energySelected = 0;
        for (uint i = 0; i < bidCount; i++) {
            if (energySelected < requiredEnergy) {
                bids[i].isSelected = true;
                energySelected += bids[i].amount;
                emit BidSelected(
                    bids[i].batteryOwner,
                    bids[i].amount,
                    bids[i].price
                );
            }
        }
    }

    function processPayments() external {
        require(!marketOpen, "Market is still open");

        for (uint i = 0; i < bidCount; i++) {
            if (bids[i].isSelected) {
                uint payment = bids[i].amount * bids[i].price;
                uint commission = (payment * aggregator.commissionRate()) / 100;

                // Paga il proprietario della batteria
                payable(bids[i].batteryOwner).transfer(payment - commission);
                emit PaymentToBatteryOwnerRecorded(
                    bids[i].batteryOwner,
                    payment - commission
                ); // Log payment to battery owner

                // Paga l'aggregatore
                payable(address(aggregator)).transfer(commission);
                emit PaymentToAggregatorOwnerRecorded(
                    bids[i].bidder,
                    commission
                ); // Log payment to aggregator owner

                // Aggiorna il SoC della batteria
                aggregator.updateBatterySoCAfterSale(
                    bids[i].batteryOwner,
                    bids[i].amount,
                    isPositiveReserve
                );
            }
        }
    }
}
