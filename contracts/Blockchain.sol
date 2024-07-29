// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Blockchain {
    event BidRegistered(address indexed bidder, uint amount, uint capacity);
    event BatteryRegistered(address indexed owner, uint capacity, uint SoC);
    event PaymentValidated(address indexed recipient, uint amount);

    function registerBid(address _bidder, uint _amount, uint _capacity) public {
        emit BidRegistered(_bidder, _amount, _capacity);
    }

    function registerBattery(address _owner, uint _capacity, uint _SoC) public {
        emit BatteryRegistered(_owner, _capacity, _SoC);
    }

    function validatePayment(address _recipient, uint _amount) public {
        emit PaymentValidated(_recipient, _amount);
    }
}
