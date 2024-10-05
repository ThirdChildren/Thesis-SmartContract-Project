// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;
import "hardhat/console.sol";

struct Battery {
    uint capacity; // in kWh
    uint SoC; // State of Charge in percentage
    bool isRegistered;
}

contract Aggregator {
    mapping(address => Battery) public batteries;
    address public owner;
    uint public commissionRate; // Commission rate in percentage, e.g., 5 for 5%

    constructor(uint _commissionRate) {
        owner = msg.sender;
        commissionRate = _commissionRate;
    }

    event BatteryRegistered(address indexed owner, uint capacity, uint SoC);

    function registerBattery(uint _capacity, uint _SoC) external {
        require(
            batteries[msg.sender].isRegistered == false,
            "Battery already registered"
        );
        batteries[msg.sender] = Battery(_capacity, _SoC, true);
        console.log(
            "Battery owner:",
            msg.sender,
            "registered",
            batteries[msg.sender].isRegistered
        );
        emit BatteryRegistered(msg.sender, _capacity, _SoC);
    }

    function updateBatterySoCAfterSale(
        address _owner,
        uint _amountSold,
        bool _isPositiveReserve
    ) external {
        Battery storage battery = batteries[_owner];
        //require(battery.owner == _owner, "Battery not found");
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
        return batteries[_batteryOwner].SoC;
    }

    function getBatteryCapacity(
        address _batteryOwner
    ) public view returns (uint) {
        return batteries[_batteryOwner].capacity;
    }
}
