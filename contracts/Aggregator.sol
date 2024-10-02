// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "hardhat/console.sol";

struct Battery {
    address owner;
    uint capacity; // in kWh
    uint SoC; // State of Charge in percentage
    bool isRegistered;
}

contract Aggregator {
    mapping(address => Battery) public batteries;
    address[] public batteryAddresses;
    uint public commissionRate; // Commission rate in percentage, e.g., 5 for 5%

    constructor(uint _commissionRate) {
        commissionRate = _commissionRate;
    }

    function registerBattery(
        address _owner,
        uint _capacity,
        uint _SoC
    ) external {
        require(!batteries[_owner].isRegistered, "Battery already registered");
        batteries[_owner] = Battery(_owner, _capacity, _SoC, true);
        batteryAddresses.push(_owner);
        console.log(
            "Battery owner:",
            batteries[_owner].owner,
            "registered",
            batteries[_owner].isRegistered
        );
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

    function getBatterySoC(address _batteryOwner) public view returns (uint) {
        require(
            batteries[_batteryOwner].owner != address(0),
            "Battery does not exist"
        );
        return batteries[_batteryOwner].SoC;
    }

    function getBatteryCapacity(
        address _batteryOwner
    ) public view returns (uint) {
        require(
            batteries[_batteryOwner].owner != address(0),
            "Battery does not exist"
        );
        return batteries[_batteryOwner].capacity;
    }
}
