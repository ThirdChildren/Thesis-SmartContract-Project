// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Aggregator.sol";

contract TSO {
    struct Bid {
        address bidder; // Address of the aggregator that placed the bid
        address batteryOwner;
        uint amount; // in kWh
        uint price; // in wei per kWh
        uint bidIndex;
        bool isSelected;
    }

    Aggregator public aggregator;
    mapping(address => address) public aggregators; // maps batteries owners addresses to aggregator addresses
    mapping(uint => Bid) public bids;

    bool public marketOpen;
    uint public requiredEnergy; // energy need from TSO
    bool public isPositiveReserve; // True for positive reserve, False for negative reserve
    address public tsoAdmin;
    address public aggregatorOwner;

    //uint public nextBidIndex; // Indice della prossima bid da selezionare
    //uint public nextPaymentIndex; // Indice del prossimo pagamento da elaborare
    uint public totalSelectedEnergy; // Energia totale selezionata

    event MarketOpened(uint requiredEnergy, bool isPositiveReserve);
    event BidPlaced(
        address indexed bidder,
        address batteryOwner,
        uint amount,
        uint price,
        uint bidIndex
    );
    event MarketClosed();
    event BidSelected(
        address indexed batteryOwner,
        uint amount,
        uint price,
        uint bidIndex
    );
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

    modifier onlyAggregatorOwner() {
        require(
            msg.sender == aggregator.aggregatorAdmin(),
            "Only the Aggregator Owner can perform this action"
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
        uint _amountInKWh, // Volume in kWh
        uint _pricePerMWh, // Price in EUR/MWh
        uint _bidIndex
    ) external onlyWhenMarketOpen {
        uint batterySoC = aggregator.getBatterySoC(_batteryOwner);

        if (isPositiveReserve) {
            require(batterySoC >= 40, "Insufficient SoC to join the market");
        } else {
            require(batterySoC < 100, "Battery is full");
        }

        // Check if price is positive
        require(_pricePerMWh > 0, "Price must be greater than 0");

        address aggregatorAddress = aggregators[_batteryOwner];
        require(
            aggregatorAddress != address(0),
            "Aggregator not found for battery owner"
        );

        // Calculating the price per kWh
        //uint _pricePerKWh = (_pricePerMWh * _amountInKWh) / 1000;

        bids[_bidIndex] = Bid(
            _bidder,
            _batteryOwner,
            _amountInKWh,
            _pricePerMWh,
            _bidIndex,
            false
        );

        emit BidPlaced(
            _bidder,
            _batteryOwner,
            _amountInKWh,
            _pricePerMWh,
            _bidIndex
        );
    }

    function closeMarket() external {
        require(marketOpen, "Market is already closed");
        marketOpen = false;
        emit MarketClosed();
    }

    function selectNextBid(uint nextBidIndex) external onlyTsoAdmin {
        require(!marketOpen, "Market is still open");
        //require(nextBidIndex < bidCount, "All bids processed");

        uint energySelected = totalSelectedEnergy; // Track total selected energy
        if (energySelected < requiredEnergy) {
            bids[nextBidIndex].isSelected = true;
            energySelected += bids[nextBidIndex].amount;
            totalSelectedEnergy = energySelected; // Update the total selected energy
            emit BidSelected(
                bids[nextBidIndex].batteryOwner,
                bids[nextBidIndex].amount,
                bids[nextBidIndex].price,
                bids[nextBidIndex].bidIndex
            );
        }
        //nextBidIndex++; // Move to the next bid
    }

    function processNextPayment(uint nextPaymentIndex) external onlyTsoAdmin {
        require(!marketOpen, "Market is still open");
        //require(nextPaymentIndex < bidCount, "All payments processed");

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

            // Update battery SoC
            aggregator.updateBatterySoCAfterSale(
                bid.batteryOwner,
                bid.amount,
                isPositiveReserve
            );
        }
    }

    function getBidIndex(uint _index) public view returns (uint) {
        return bids[_index].bidIndex;
    }

    function getBatteryOwner(uint _index) public view returns (address) {
        return bids[_index].batteryOwner;
    }

    function getBidder(uint _index) public view returns (address) {
        return bids[_index].bidder;
    }
}
