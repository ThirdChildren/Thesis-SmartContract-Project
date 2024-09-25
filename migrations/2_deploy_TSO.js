const TSO = artifacts.require("TSO");
module.exports = function (deployer) {
  deployer.deploy(TSO, "0x243431523a071F518A5bEb7304FdeE8E7903FE8D");
};
