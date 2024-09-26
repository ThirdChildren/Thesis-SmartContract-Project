// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Aggregator {
    struct Battery {
        address owner;
        uint capacity; // in kWh
        uint SoC; // State of Charge in percentage
        bool isRegistered;
    }

    mapping(address => Battery) public batteries;
    address[] public batteryAddresses;
    address public aggregatorAdmin;
    uint public commissionRate; // Commission rate in percentage, e.g., 5 for 5%

    modifier batteryIsNotRegistered() {
        require(
            !batteries[msg.sender].isRegistered,
            "Battery already registered"
        );
        _;
    }
    constructor(address _aggregatorAdmin, uint _commissionRate) {
        aggregatorAdmin = _aggregatorAdmin;
        commissionRate = _commissionRate;
    }

    function registerBattery(
        address _owner,
        uint _capacity,
        uint _SoC,
        bool isRegistered
    ) external batteryIsNotRegistered {
        batteries[_owner] = Battery(_owner, _capacity, _SoC, isRegistered);
        batteryAddresses.push(_owner);
    }

    function updateBatterySoCAfterSale(
        address _owner,
        uint _amountSold,
        bool _isPositiveReserve
    ) external {
        Battery storage battery = batteries[_owner];
        require(battery.owner == _owner, "Battery not found");
        if (_isPositiveReserve) {
            uint newSoc = uint(
                battery.SoC - ((_amountSold * 100) / battery.capacity)
            ); // calculate new SoC
            battery.SoC = newSoc; // update the SoC
        } else {
            uint newSoc = uint(
                battery.SoC + ((_amountSold * 100) / battery.capacity)
            ); // calculate new SoC
            if (newSoc > 100) battery.SoC = 100;
            else battery.SoC = newSoc;
        }
    }

    // Funzione per ottenere il SoC di una batteria
    function getBatterySoC(address _batteryOwner) public view returns (uint) {
        require(
            batteries[_batteryOwner].owner != address(0),
            "Battery does not exist"
        );
        return batteries[_batteryOwner].SoC;
    }

    function getAggregatorAdmin() public view returns (address) {
        return aggregatorAdmin;
    }
}
