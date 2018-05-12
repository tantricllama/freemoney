var FreeMoney = artifacts.require("./FreeMoney.sol");
var SafeMath = artifacts.require('SafeMath');

module.exports = function(deployer) {
  deployer.deploy(SafeMath);
  deployer.link(SafeMath, FreeMoney);
  deployer.deploy(FreeMoney, 10000, 10000);
};