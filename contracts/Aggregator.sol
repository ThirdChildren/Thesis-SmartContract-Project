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
    uint public commissionRate; // Commission rate in percentage, e.g., 5 for 5%

    modifier batteryIsNotRegistered() {
        require(
            !batteries[msg.sender].isRegistered,
            "Battery already registered"
        );
        _;
    }
    constructor(uint _commissionRate) {
        commissionRate = _commissionRate;
    }
    function registerBattery(
        address _owner,
        uint _capacity,
        uint _SoC,
        bool isRegistered
    ) external batteryIsNotRegistered {
        require(_SoC >= 60, "SoC must be >= 60%");
        batteries[_owner] = Battery(_owner, _capacity, _SoC, isRegistered);
        batteryAddresses.push(_owner);
    }

    function updateBatterySoC(address _owner, uint _newSoC) public {
        require(batteries[_owner].owner == _owner, "Battery not found");
        batteries[_owner].SoC = _newSoC;
    }
}
