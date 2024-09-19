const Market = artifacts.require("Market");
module.exports = function (deployer) {
  deployer.deploy(Market, "0x674F324F05626E3F05c81Dc62eEc07CC3Ff777E5");
};
