// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./Aggregator.sol";

contract TSO {
    struct Bid {
        address batteryOwner;
        uint amount; // energia in kWh
        uint price; // prezzo in wei per kWh
        bool isSelected;
    }

    Aggregator public aggregator;
    uint public thresholdSoC; // SoC minimo richiesto per partecipare al mercato
    Bid[] public bids;
    bool public marketOpen;
    uint public requiredEnergy; // fabbisogno energetico richiesto dal TSO
    bool public isPositiveReserve; // True per riserva positiva, False per riserva negativa

    event MarketOpened(uint requiredEnergy, bool isPositiveReserve);
    event BidPlaced(address indexed batteryOwner, uint amount, uint price);
    event MarketClosed();
    event BidSelected(address indexed batteryOwner, uint amount, uint price);
    event PaymentsProcessed();

    modifier onlyWhenMarketOpen() {
        require(marketOpen, "Market is not open");
        _;
    }

    constructor(address _aggregator, uint _thresholdSoC) {
        aggregator = Aggregator(_aggregator);
        thresholdSoC = _thresholdSoC;
    }

    function openMarket(
        uint _requiredEnergy,
        bool _isPositiveReserve
    ) external {
        requiredEnergy = _requiredEnergy;
        isPositiveReserve = _isPositiveReserve;
        marketOpen = true;
        emit MarketOpened(requiredEnergy, isPositiveReserve);
    }

    function placeBid(uint _amount, uint _price) external onlyWhenMarketOpen {
        if (isPositiveReserve) {
            uint batterySoC = aggregator.getBatterySoC(msg.sender);
            require(
                batterySoC >= thresholdSoC,
                "SoC insufficiente per partecipare al mercato"
            );
        }

        bids.push(
            Bid({
                batteryOwner: msg.sender,
                amount: _amount,
                price: _price,
                isSelected: false
            })
        );

        emit BidPlaced(msg.sender, _amount, _price);
    }

    function closeMarket() external {
        require(marketOpen, "Market is already closed");
        marketOpen = false;
        emit MarketClosed();
    }

    function selectBids() external {
        require(!marketOpen, "Market is still open");

        uint energySelected = 0;
        for (uint i = 0; i < bids.length; i++) {
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

        for (uint i = 0; i < bids.length; i++) {
            if (bids[i].isSelected) {
                uint payment = bids[i].amount * bids[i].price;
                uint commission = (payment * aggregator.commissionRate()) / 100;

                // Paga il proprietario della batteria
                payable(bids[i].batteryOwner).transfer(payment - commission);

                // Paga l'aggregatore
                payable(address(aggregator)).transfer(commission);

                // Aggiorna il SoC della batteria
                aggregator.updateBatterySoCAfterSale(
                    bids[i].batteryOwner,
                    bids[i].amount,
                    isPositiveReserve
                );
            }
        }

        emit PaymentsProcessed();
    }
}
