var PlonkVerifier = artifacts.require("PlonkVerifier");

module.exports = function(deployer) {
  deployer.deploy(PlonkVerifier);
};