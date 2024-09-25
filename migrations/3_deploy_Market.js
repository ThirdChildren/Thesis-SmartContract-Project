const Market = artifacts.require("Market");
module.exports = function (deployer) {
  deployer.deploy(Market, "0x7Ef26803E637Ca327ABE6a8cb675bB66659fe904");
};
