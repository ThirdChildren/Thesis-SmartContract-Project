const Aggregator = artifacts.require("Aggregator");
module.exports = function (deployer) {
  deployer.deploy(Aggregator, 10);
};
