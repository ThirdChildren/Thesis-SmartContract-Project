// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Payment {
    event PaymentProcessed(address indexed recipient, uint amount);

    function processPayment(address _recipient, uint _amount) public payable {
        require(
            address(this).balance >= _amount,
            "Insufficient funds in Payment contract"
        );
        payable(_recipient).transfer(_amount);
        emit PaymentProcessed(_recipient, _amount);
    }

    receive() external payable {}
}
