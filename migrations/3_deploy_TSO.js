const TSO = artifacts.require("TSO");
module.exports = function (deployer) {
  deployer.deploy(TSO, "0xEdD7209c8c3411944d274F6eA02e71cC97f5189e");
};
