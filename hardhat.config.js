require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.9",
  networks: {
    ganache: {
      url: "http://172.20.208.1:7545", // URL dell'RPC Ganache
      accounts: [
        "0xc6030771d977a5e6d4b3e37c5443a9de758600a0ea3e7b9409ba22398c77cb5c",
        "0xaa9db0187bc6588f2ed737057c1d4ee25dad93535311be85012e524346d741bc",
        "0x31ce19a5caa4fdc2158db910a91b3a03f8a72382fc16f62e42b6b968944ffa83",
        "0x2594f099507575a922e4de424efdfec970c7d1af3473242568da5a719be467e8",
        "0x409a0c1583eb2fa5487a67fab8c5780d17cecbe069df942d9a3bd771c330733c",
        "0xc23ef94f7f77402411e9a6efe0940ff410cb2023a3e53facfe666d24819d81de",
        "0x72635e21dc2cd20fdd572a22000a3908f8103a673d48cbe701848d246862c3b0",
        "0x24c0c350ecf80cb862498e43f93a91a4f7db4a2e6cc7eed91eca42edae7052c9",
        "0xaf539f1224241e6e5c983f299a0bcfeb44662416f5609d783b51155dd54f80ff",
      ],
    },
  },
};
