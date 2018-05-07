var FreeMoney = artifacts.require("./FreeMoney.sol");

module.exports = function(deployer) {
  deployer.deploy(FreeMoney, 10000);
};
