// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Aggregator.sol";
import "hardhat/console.sol";

contract TSO {
    struct Bid {
        address bidder; // Address of the aggregator that placed the bid
        address batteryOwner;
        uint amount; // in kWh
        uint price; // in wei per kWh
        bool isSelected;
    }

    //Aggregator public aggregator;
    mapping(address => address) public aggregators; // maps batteries owners addresses to aggregator addresses
    mapping(uint => Bid) public bids;

    bool public marketOpen;
    uint public requiredEnergy; // energy need from TSO
    bool public isPositiveReserve; // True for positive reserve, False for negative reserve
    address public tsoAdmin;
    address public aggregatorOwner;
    uint public bidCount;

    //uint public nextBidIndex; // Indice della prossima bid da selezionare
    //uint public nextPaymentIndex; // Indice del prossimo pagamento da elaborare
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

    /* modifier onlyAggregatorOwner() {
        require(
            msg.sender == aggregator.getAggregatorAdmin(),
            "Only the Aggregator Owner can perform this action"
        );
        _;
    } */

    modifier onlyWhenMarketOpen() {
        require(marketOpen, "Market is not open");
        _;
    }

    constructor(address _tsoAdmin) {
        tsoAdmin = _tsoAdmin;
    }

    function setAggregator(address _owner, address _aggregator) public {
        aggregators[_owner] = _aggregator;
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
        uint _pricePerMWh // Price in EUR/MWh
    ) external onlyWhenMarketOpen {
        address aggregatorAddress = aggregators[_batteryOwner];
        require(
            aggregatorAddress != address(6),
            "Aggregator not found for battery owner"
        );

        Aggregator aggregator = Aggregator(aggregatorAddress);

        uint batterySoC = aggregator.getBatterySoC(_batteryOwner);

        if (isPositiveReserve) {
            require(batterySoC >= 40, "Insufficient SoC to join the market");
        } else {
            require(batterySoC < 100, "Battery is full");
        }

        // Check if price is positive
        require(_pricePerMWh > 0, "Price must be greater than 0");

        // Calculating the price per kWh
        uint _pricePerKWh = (_pricePerMWh * _amountInKWh) / 1000;

        bids[bidCount] = Bid(
            _bidder,
            _batteryOwner,
            _amountInKWh,
            _pricePerKWh,
            false
        );

        console.log("Bid placed by: ", _bidder);
        console.log("Battery owner: ", _batteryOwner);
        console.log("Bid amount: ", _amountInKWh, " kWh");
        console.log("Bid price: ", _pricePerKWh, " EUR/KWh");

        emit BidPlaced(_bidder, _batteryOwner, _amountInKWh, _pricePerKWh);
        bidCount++;
    }

    function closeMarket() external {
        require(marketOpen, "Market is already closed");
        marketOpen = false;
        emit MarketClosed();
    }

    function acceptBid(uint _bidId) external onlyTsoAdmin {
        require(!marketOpen, "Market is still open");
        //require(nextBidIndex < bidCount, "All bids processed");

        uint energySelected = totalSelectedEnergy; // Track total selected energy
        if (energySelected < requiredEnergy) {
            bids[_bidId].isSelected = true;
            energySelected += bids[_bidId].amount;
            totalSelectedEnergy = energySelected; // Update the total selected energy
            emit BidSelected(
                bids[_bidId].batteryOwner,
                bids[_bidId].amount,
                bids[_bidId].price
            );
        } else {
            console.log("Energy selected is greater than required energy");
        }
    }

    function processPayment(uint _bidId) public payable {
        console.log("Processing payment for bid ID:", _bidId);
        console.log("Market status:", marketOpen);
        console.log("Bid selected:", bids[_bidId].isSelected);

        require(bids[_bidId].isSelected, "Bid not accepted");

        uint paymentRequired = bids[_bidId].amount * bids[_bidId].price;
        console.log("Payment sent:", msg.value);
        console.log("Payment required:", paymentRequired);

        require(msg.value == paymentRequired, "Insufficient funds");

        address owner = bids[_bidId].bidder;
        address batteryOwner = bids[_bidId].batteryOwner;
        console.log("Bidder address:", owner);
        console.log("Battery owner address:", batteryOwner);

        address aggregatorAddress = aggregators[batteryOwner];
        Aggregator aggregator = Aggregator(aggregatorAddress);
        console.log("Aggregator address:", aggregatorAddress);

        require(!marketOpen, "Market is still open");

        uint commission = (msg.value * aggregator.commissionRate()) / 100;
        console.log("Commission:", commission);
        console.log("Payment to battery owner:", msg.value - commission);

        // Pay battery owner
        payable(batteryOwner).transfer(msg.value - commission);
        emit PaymentToBatteryOwnerRecorded(
            batteryOwner,
            msg.value - commission
        );

        // Pay aggregator
        console.log("Payment to aggregator:", commission);
        payable(owner).transfer(commission);
        emit PaymentToAggregatorOwnerRecorded(owner, commission);

        // Update battery SoC
        console.log("Updating Battery SoC for battery owner:", batteryOwner);
        aggregator.updateBatterySoCAfterSale(
            bids[_bidId].batteryOwner,
            bids[_bidId].amount,
            isPositiveReserve
        );
        console.log("Payment processing completed.");
    }

    function getBatteryOwner(uint _index) public view returns (address) {
        return bids[_index].batteryOwner;
    }

    function getBidder(uint _index) public view returns (address) {
        return bids[_index].bidder;
    }
}
