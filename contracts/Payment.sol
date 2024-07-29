// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Payment {
    event PaymentProcessed(
        address indexed payer,
        address indexed recipient,
        uint amount
    );

    function processPayment(
        address _payer,
        address _recipient,
        uint _amount
    ) public payable {
        require(_amount > 0, "Amount must be greater than 0");
        require(
            payable(_payer).balance >= _amount,
            "Insufficient balance for payment"
        );
        (bool sent, ) = payable(_recipient).call{value: _amount}("");
        require(sent, "Failed to send Ether");
        emit PaymentProcessed(_payer, _recipient, _amount);
    }
}
