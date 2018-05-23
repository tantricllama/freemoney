const assert = require('assert');
const fs = require('fs');
const Web3 = require('web3');
const httpProvider = new Web3.providers.HttpProvider('http://127.0.0.1:9545/');
const web3 = new Web3(httpProvider);

const increaseTime = function(duration) {
  const id = Date.now()

  return new Promise(function(resolve, reject) {
    httpProvider.send({
      jsonrpc: '2.0', 
      method: 'evm_increaseTime', 
      params: [duration], 
      id: id
    }, function(error, response) {
      if (error) return reject(error);

      httpProvider.send({
        jsonrpc: '2.0', 
        method: 'evm_mine', 
        params: [], 
        id: id + 1
      }, function(error, response) {
        if (error) return reject(error);

        resolve();
      });
    });
  });
}

// Sorts in DESCENDING order
const compare = function(a, b) {
  if (a.gas > b.gas) {
    return -1;
  }

  if (a.gas < b.gas) {
    return 1;
  }

  return 0;
}

web3.eth.getAccounts().then(function(accounts) {
  const contractOwner = accounts.shift();
  const contractAddress = accounts.shift();
  const contractABI = JSON.parse(fs.readFileSync('./build/contracts/FreeMoney.json', 'utf8'));
  const contract = new web3.eth.Contract(contractABI.abi, contractAddress, {
    data: contractABI.bytecode
  }).deploy({
    data: contractABI.bytecode,
    arguments: [10000, 10000]
  }).send({
    from: contractOwner,
    gas: 4712388,
    gasPrice: 100000000000
  }).then(async function(freeMoney) {
    console.log('');
    console.log('===================');
    console.log('ESTIMATED GAS COSTS');
    console.log('===================');

    function output(label, results) {
      console.log('');
      console.log(label + ':');

      results.sort(compare);

      var length = 0;

      results.forEach(function(result) {
        if (result.name.length > length) {
          length = result.name.length;
        }
      });

      length += 2;

      results.forEach(function(result) {
        console.log(' - ' + result.name.padEnd(length, '.') + result.gas);
      });
    }

    function uniqId() {
      const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      var text = "";

      for (var i = 0; i < 8; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
      }

      return text;
    }

    function testTokens() {
      return new Promise(function(resolve, reject) {
        const recipient = accounts[0];
        const amount = web3.utils.toWei('1000', 'ether');
        const results = [];
        const tests = 9;

        freeMoney.methods.name().estimateGas().then(function(gasAmount) {
          results.push({ name: 'name', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.totalSupply().estimateGas().then(function(gasAmount) {
          results.push({ name: 'totalSupply', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.decimals().estimateGas().then(function(gasAmount) {
          results.push({ name: 'decimals', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.balanceOf(contractOwner).estimateGas().then(function(gasAmount) {
          results.push({ name: 'balanceOf', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.symbol().estimateGas().then(function(gasAmount) {
          results.push({ name: 'symbol', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.transfer(recipient, amount).estimateGas({ from: contractOwner }).then(function(gasAmount) {
          results.push({ name: 'transfer', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });
        
        freeMoney.methods.approve(recipient, amount).estimateGas({ from: contractOwner }).then(function(gasAmount) {
          results.push({ name: 'approve', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.allowance(contractOwner, recipient).estimateGas({ from: contractOwner }).then(function(gasAmount) {
          results.push({ name: 'allowance', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });
        
        freeMoney.methods.approve(recipient, amount).send({ from: contractOwner }).then(function() {
          freeMoney.methods.transferFrom(contractOwner, accounts[1], amount).estimateGas({ from: recipient }).then(function(gasAmount) {
            results.push({ name: 'transferFrom', gas: gasAmount });
            if (results.length == tests) resolve(results);
          });
        });
      });
    }

    function testInsurance() {
      return new Promise(function(resolve, reject) {
        const account = accounts[0];
        const results = [];
        const tests = 9;

        freeMoney.methods.maxPolicyLength().estimateGas().then(function(gasAmount) {
          results.push({ name: 'maxPolicyLength', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.insurancePolicies(contractOwner).estimateGas().then(function(gasAmount) {
          results.push({ name: 'insurancePolicies', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.insuranceFund().estimateGas().then(function(gasAmount) {
          results.push({ name: 'insuranceFund', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.insuranceMultiplier().estimateGas().then(function(gasAmount) {
          results.push({ name: 'insuranceMultiplier', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.insuranceCost().estimateGas().then(function(gasAmount) {
          results.push({ name: 'insuranceCost', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.isInsured(account).estimateGas().then(function(gasAmount) {
          results.push({ name: 'isInsured(new)', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.getFreeInsurance().estimateGas({ from: account }).then(function(gasAmount) {
          results.push({ name: 'getFreeInsurance', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });

        freeMoney.methods.getFreeInsurance().send({ from: account }).then(async function(result) {
          // Move the time forward
          await increaseTime(86410);
          await freeMoney.methods.transfer(account, web3.utils.toWei('1000', 'ether')).send({ from: contractOwner });

          freeMoney.methods.buyInsurance(1).estimateGas({ from: account }).then(async function(gasAmount) {
            results.push({ name: 'buyInsurance', gas: gasAmount });
            if (results.length == tests) resolve(results);

            await freeMoney.methods.buyInsurance(1).estimateGas({ from: account });

            freeMoney.methods.isInsured(account).estimateGas().then(function(gasAmount) {
              results.push({ name: 'isInsured(existing)', gas: gasAmount });
              if (results.length == tests) resolve(results);
            });
          });
        });
      });
    }

    function testHeists() {
      return new Promise(async function(resolve, reject) {
        const poorTarget = accounts[0];
        const failTarget = accounts[1];
        const succeedTarget = accounts[2];
        const instigator = accounts[3];
        const conspirator = accounts[4];
        const results = [];
        const tests = 12;

        // Try to rob a poor target
        const robPoorTarget = async function(iteration) {
          const salt = uniqId();
          const hashPoorTarget = await freeMoney.methods.hashTarget(poorTarget, salt).call();

          await freeMoney.methods.newHeist(hashPoorTarget).send({ from: instigator });
          await increaseTime(86410);
          
          const receipt = await freeMoney.methods.robTarget(poorTarget, salt).send({ from: instigator });
          const heist = await freeMoney.methods.heists(hashPoorTarget).call();

          if (heist.amount == 0) {
            results.push({ name: 'robTarget poor target', gas: receipt.gasUsed });
            if (results.length == tests) resolve(results);
          } else {
            iteration = (iteration || 0);
            iteration++;

            if (iteration > 5) {
              return reject('Heist did not fail after 5 retries');
            }

            await robPoorTarget(iteration);
          }
        };

        // Try to rob a target
        const robTargetFail = async function(iteration) {
          const salt = uniqId();
          const hashFailTarget = await freeMoney.methods.hashTarget(failTarget, salt).call();

          await freeMoney.methods.transfer(failTarget, web3.utils.toWei('1000', 'ether')).send({ from: contractOwner });
          await freeMoney.methods.newHeist(hashFailTarget).send({ from: instigator });
          await increaseTime(86410);

          const receipt = await freeMoney.methods.robTarget(failTarget, salt).send({ from: instigator });
          const heist = await freeMoney.methods.heists(hashFailTarget).call();

          if (heist.amount == 0) {
            results.push({ name: 'robTarget fail', gas: receipt.gasUsed });
            if (results.length == tests) resolve(results);
          } else {
            iteration = (iteration || 0);
            iteration++;

            if (iteration > 5) {
              return reject('Heist did not fail after 5 retries');
            }

            await robTargetFail(iteration);
          }
        };

        // Rob a target
        const robTargetSucceed = async function(iteration) {
          const salt = uniqId();
          const hashSucceedTarget = await freeMoney.methods.hashTarget(succeedTarget, salt).call();

          await freeMoney.methods.transfer(succeedTarget, web3.utils.toWei('1000', 'ether')).send({ from: contractOwner });
          await freeMoney.methods.newHeist(hashSucceedTarget).send({ from: instigator, value: web3.utils.toWei('1.01', 'ether') });

          for (var i = 5; i < 15; i++) {
            await freeMoney.methods.joinHeist(hashSucceedTarget).send({ from: accounts[i] });
          }

          await increaseTime(86410);

          const receipt = await freeMoney.methods.robTarget(succeedTarget, salt).send({ from: instigator });
          const heist = await freeMoney.methods.heists(hashSucceedTarget).call();

          if (heist.amount > 0) {
            results.push({ name: 'robTarget succeed', gas: receipt.gasUsed });

            freeMoney.methods.claimHeistFunds(hashSucceedTarget).estimateGas({ from: instigator }).then(function(gasAmount) {
              results.push({ name: 'claimHeistFunds', gas: gasAmount });
              if (results.length == tests) resolve(results);
            });
          } else {
            iteration = (iteration || 0);
            iteration++;

            if (iteration > 5) {
              return reject('Heist did not succeed after 5 retries');
            }

            await robTargetSucceed(iteration);
          }
        };

        await robPoorTarget();
        await robTargetFail();
        await robTargetSucceed();

        freeMoney.methods.hashTarget(succeedTarget, 'salt').estimateGas().then(function(gasAmount) {
          results.push({ name: 'hashTarget', gas: gasAmount });
          if (results.length == tests) resolve(results);

          freeMoney.methods.hashTarget(succeedTarget, 'salt').call().then(function(targetHash) {
            freeMoney.methods.heists(targetHash).estimateGas().then(function(gasAmount) {
              results.push({ name: 'heists', gas: gasAmount });
              if (results.length == tests) resolve(results);
            });

             freeMoney.methods.newHeist(targetHash).estimateGas({ from: instigator }).then(function(gasAmount) {
              results.push({ name: 'newHeist no bribe', gas: gasAmount });
              if (results.length == tests) resolve(results);
            });

            freeMoney.methods.newHeist(targetHash).estimateGas({ from: instigator, value: web3.utils.toWei('0.01', 'ether') }).then(function(gasAmount) {
              results.push({ name: 'newHeist bribe', gas: gasAmount });
              if (results.length == tests) resolve(results);
            });

            freeMoney.methods.newHeist(targetHash).send({ from: instigator }).then(async function() {
              freeMoney.methods.getHeistOdds(targetHash).estimateGas().then(function(gasAmount) {
                results.push({ name: 'getHeistOdds', gas: gasAmount });
                if (results.length == tests) resolve(results);
              });

              freeMoney.methods.joinHeist(targetHash).estimateGas({ from: conspirator }).then(function(gasAmount) {
                results.push({ name: 'joinHeist no bribe', gas: gasAmount });
                if (results.length == tests) resolve(results);
              });

              freeMoney.methods.joinHeist(targetHash).estimateGas({ from: conspirator, value: web3.utils.toWei('0.01', 'ether') }).then(function(gasAmount) {
                results.push({ name: 'joinHeist bribe', gas: gasAmount });
                if (results.length == tests) resolve(results);
              });

              freeMoney.methods.joinHeist(targetHash).estimateGas({ from: instigator, value: web3.utils.toWei('0.01', 'ether') }).then(function(gasAmount) {
                results.push({ name: 'joinHeist as instigator', gas: gasAmount });
                if (results.length == tests) resolve(results);
              });
            });
          });
        });
      });
    }

    function testMinting() {
      return new Promise(function(resolve, reject) {
        const results = [];
        const tests = 1;

        freeMoney.methods.claimTokens().estimateGas({ from: accounts[0] }).then(function(gasAmount) {
          results.push({ name: 'claimTokens', gas: gasAmount });
          if (results.length == tests) resolve(results);
        });
      });
    }

    output('Tokens', await testTokens());
    output('Insurance', await testInsurance());
    output('Heists', await testHeists());
    output('Minting', await testMinting());
  });
});