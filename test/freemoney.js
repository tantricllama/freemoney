const web3 = require('web3');
const numberToBn = require('number-to-bn');
const FreeMoney = artifacts.require('FreeMoney');
const httpProvider = new web3.providers.HttpProvider('http://127.0.0.1:9545/');
const provider = new web3(httpProvider);

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

contract('FreeMoney', async function(accounts) {
  describe('constructor', function() {
    it('creates correct initialSupply', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const balance = await instance.balanceOf(accounts[0]);

      assert.equal(provider.utils.fromWei(numberToBn(balance), 'ether'), 10000, 'initialSupply was incorrect');
    });
  });

  describe('transfer', function() {
    it('fails to transfer to 0x0', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.transfer(0, provider.utils.toWei('1', 'ether'), { from: accounts[0] });
        assert.fail('To address was 0');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('fails to transfer to the contract', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.transfer(instance.address, provider.utils.toWei('1', 'ether'), { from: accounts[0] });
        assert.fail('To address was the contract');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('fails to transfer insufficient funds', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.transfer(accounts[1], provider.utils.toWei('10001', 'ether'), { from: accounts[0] });
        assert.fail('Transferred insufficient funds');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('transfers to a new token holder', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Transfer();

      const result = await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9999);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 1);

      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[1]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1', 'ether')), true);
    });

    it('transfers to an existing token holder', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Transfer();

      // Transfer the base amount
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });

      const result = await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9998);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 2);

      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[1]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1', 'ether')), true);
    });

    it('transfers to another new token holder', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Transfer();

      // Transfer the base amount
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });

      const result = await instance.transfer(accounts[2], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9998);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[2])), 'ether'), 1);

      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[2]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1', 'ether')), true);
    });

    it('transfers and empties an address', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Transfer();

      // Transfer the base amount
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      await instance.transfer(accounts[2], provider.utils.toWei('1', 'ether'), { from: accounts[0] });

      // Empty the second account to test the _transfer method in full
      const result = await instance.transfer(accounts[0], provider.utils.toWei('1', 'ether'), { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9999);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[2])), 'ether'), 0);
      
      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[2]);
      assert.equal(events[0].args._to, accounts[0]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1', 'ether')), true);
    });
  });

  describe('approve', function() {
    it('approves allowances', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Approval();

      const result = await instance.approve(accounts[0], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.allowance(accounts[1], accounts[0])), 'ether'), 1000);

      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._owner, accounts[1]);
      assert.equal(events[0].args._spender, accounts[0]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });

    it('prevents increasing or decreasing when allowance is not zero', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      await instance.approve(accounts[0], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });

      try {
        await instance.approve(accounts[0], provider.utils.toWei('2000', 'ether'), { from: accounts[1] });
        assert.fail('Allowance was increased from 1000 to 2000');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('changes the allowance', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Approval();

      await instance.approve(accounts[0], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });
      await instance.approve(accounts[0], provider.utils.toWei('0', 'ether'), { from: accounts[1] });

      const result = await instance.approve(accounts[0], provider.utils.toWei('2000', 'ether'), { from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.allowance(accounts[1], accounts[0])), 'ether'), 2000);

      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._owner, accounts[1]);
      assert.equal(events[0].args._spender, accounts[0]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('2000', 'ether')), true);
    });
  });

  describe('transferFrom', function() {
    it('prevents overspending of allowance', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      await instance.approve(accounts[0], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });

      try {
        await instance.transferFrom(accounts[1], accounts[2], provider.utils.toWei('1001', 'ether'), { from: accounts[0] });
        assert.fail('Allowance was overspent');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('spends the allowance', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Transfer();

      // Approve an account
      await instance.approve(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });

      const result = await instance.transferFrom(accounts[0], accounts[2], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer From transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9000);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 0);
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[2])), 'ether'), 1000);

      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[2]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });
  });

  describe('withdraw', function() {
    it('prevents withdrawing more than the balance', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.withdraw(provider.utils.toWei('1', 'ether'), { from: accounts[0] });
        assert.fail('Withdrew more then the balance');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('withdraws from the contract', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start a heist and pay a bribe
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1', 'ether') });

      // Get the current account balance of the contract owner
      const oldBalance = provider.utils.toBN(await provider.eth.getBalance(accounts[0]));

      // Withdraw the bribe
      const result = await instance.withdraw(provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check the balance the current account balance of the contract owner
      const newBalance = provider.utils.toBN(await provider.eth.getBalance(accounts[0]));
      assert.equal(newBalance.gt(oldBalance), true);
    });
  });

  describe('setMintPerDay', function() {
    it('sets the property', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const oldAmount = await instance.mintPerDay();

      await instance.setMintPerDay(provider.utils.toWei('1', 'ether'));

      const newAmount = await instance.mintPerDay();

      assert.equal(oldAmount.eq(newAmount), false);
      assert.equal(newAmount.eq(provider.utils.toWei('1', 'ether')), true);
    });
  });

  describe('claimTokens', function() {
    it('mints up to 100 tokens', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Transfer();
      var oldBalance, newBalance, diff, result, events;

      for (var i = 1; i < 11; i++) {
        // Get the balance
        oldBalance = await instance.balanceOf(accounts[i]);

        // Claim some tokens
        result = await instance.claimTokens({ from: accounts[i] });
        assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

        // Get the updated balance
        newBalance = await instance.balanceOf(accounts[i]);

        // Make sure the difference is between 1 and 100
        diff = newBalance.sub(oldBalance);
        assert.equal(diff.gte(provider.utils.toWei('1', 'ether')), true);
        assert.equal(diff.lte(provider.utils.toWei('100', 'ether')), true);

        events = eventHandler.get();
        assert.equal(events.length, 1);
        assert.equal(events[0].args._from, instance.address);
        assert.equal(events[0].args._to, accounts[i]);
        assert.equal(events[0].args._value.eq(diff), true);
      }
    });

    it('prevents minting more than the limit', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';
      const mintPerDay = provider.utils.toWei('200', 'ether');

      // Lower the amount of token to mint per day
      await instance.setMintPerDay(mintPerDay);

      // Check if heist can be started again
      try {
        var i = 1, oldBalance, newBalance, claimed, diff,
          total = 0;

        while (true) {
          oldBalance = await instance.balanceOf(accounts[i]);
          await instance.claimTokens({ from: accounts[i] });
          newBalance = await instance.balanceOf(accounts[i]);
          diff = newBalance.sub(oldBalance);
          total = diff.add(total);

          if (total.gt(mintPerDay)) {
            break;
          }

          i++;
        }

        assert.fail('Started an existing heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('resets the number of minted tokens each day', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const mintPerDay = provider.utils.toWei('200', 'ether');

      // Lower the amount of token to mint per day
      await instance.setMintPerDay(mintPerDay);

      assert.equal(await instance.mintCount(), 0);

      // Check if heist can be started again
      try {
        var i = 1;

        while (true) {
          await instance.claimTokens({ from: accounts[i++] });
        }
      } catch (e) {}

      assert.equal(await instance.mintCount(), mintPerDay);

      // Move the time forward and claim more tokens
      await increaseTime(86410);
      await instance.claimTokens({ from: accounts[1] });

      assert.equal((await instance.mintCount()).gt(0), true);
      assert.equal((await instance.mintCount()).lt(mintPerDay), true);
    });
  });

  describe('hashTarget', function() {
    it('correctly hashes the target and salt', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      assert.equal(targetHash, provider.utils.soliditySha3(accounts[1], 'test'));
    });
  });

  describe('newHeist', function() {
    it('starts a new heist', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      const result = await instance.newHeist(targetHash, { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[0], accounts[2]);
      assert.equal(heist[1], 0);
      // Created in the last 5 seconds
      assert.equal(heist[2].gt(Math.round((new Date()).getTime() / 1000) - 5), true);
      assert.equal(heist[3], 0);
      assert.equal(heist[4], 0);

      // Check the new heist event
      var events = NewHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._instigator, accounts[2]);
      assert.equal(events[0].args._deadline.eq(heist[2].add(86400)), true);

      // There should be no joined heist event
      assert.equal(JoinedHeist.get().length, 0);
    });

    it('starts a new heist with a bribe', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1', 'ether') });
      assert.equal(NewHeist.get().length, 1);
      assert.equal(JoinedHeist.get().length, 0);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[0], accounts[2]);
      assert.equal(heist[1], 0);
      // Created in the last 5 seconds
      assert.equal(heist[2].gt(Math.round((new Date()).getTime() / 1000) - 5), true);
      assert.equal(heist[3], provider.utils.toWei('1', 'ether'));
      assert.equal(heist[4], 0);
    });

    it('prevents starting an existing heist', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = provider.utils.sha3(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Start the heist
      await instance.newHeist(targetHash, { from: accounts[2] });

      // Check if heist can be started again
      try {
        await instance.newHeist(targetHash, { from: accounts[3] });
        assert.fail('Started an existing heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });
  });

  describe('joinHeist', function() {
    it('joins an existing heist', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      await instance.newHeist(targetHash, { from: accounts[2] });
      assert.equal(NewHeist.get().length, 1);

      // Add conspirators
      await instance.joinHeist(targetHash, { from: accounts[3] });
      var events = JoinedHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._conspirator, accounts[3]);

      await instance.joinHeist(targetHash, { from: accounts[4] });
      events = JoinedHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._conspirator, accounts[4]);

      await instance.joinHeist(targetHash, { from: accounts[5] });
      events = JoinedHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._conspirator, accounts[5]);
    });

    it('adds a bribe to an existing heist', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      await instance.newHeist(targetHash, { from: accounts[2] });
      assert.equal(NewHeist.get().length, 1);

      // Add the bribe
      await instance.joinHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1', 'ether') });
      assert.equal(NewHeist.get().length, 0);
      assert.equal(JoinedHeist.get().length, 0);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[0], accounts[2]);
      assert.equal(heist[1], 0);
      // Created in the last 5 seconds
      assert.equal(heist[2].gt(Math.round((new Date()).getTime() / 1000) - 5), true);
      assert.equal(heist[3], provider.utils.toWei('1', 'ether'));
      assert.equal(heist[4], 0);
    });

    it('prevents joining a non-existent heist', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = provider.utils.sha3(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Check if heist can be started again
      try {
        await instance.joinHeist(targetHash, { from: accounts[3] });
        assert.fail('Joined a non-existent heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents allowing too many conspirators', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = provider.utils.sha3(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target and instigator accounts, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });

      // Start the heist
      await instance.newHeist(targetHash, { from: accounts[2] });

      // Add the maximum conspirators (10)
      await instance.joinHeist(targetHash, { from: accounts[3] });
      await instance.joinHeist(targetHash, { from: accounts[4] });
      await instance.joinHeist(targetHash, { from: accounts[5] });
      await instance.joinHeist(targetHash, { from: accounts[6] });
      await instance.joinHeist(targetHash, { from: accounts[7] });
      await instance.joinHeist(targetHash, { from: accounts[8] });
      await instance.joinHeist(targetHash, { from: accounts[9] });
      await instance.joinHeist(targetHash, { from: accounts[10] });
      await instance.joinHeist(targetHash, { from: accounts[11] });
      await instance.joinHeist(targetHash, { from: accounts[12] });

      // Check if heist can be initiated before the deadline
      try {
        await instance.joinHeist(targetHash, { from: accounts[13] });
        assert.fail('Added too many conspirators');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });
  });

  describe('robTarget', function() {
    it('robs the target', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it succeeds.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('10', 'ether') });
      await instance.joinHeist(targetHash, { from: accounts[3] });
      await instance.joinHeist(targetHash, { from: accounts[4] });
      await instance.joinHeist(targetHash, { from: accounts[5] });
      await instance.joinHeist(targetHash, { from: accounts[6] });
      await instance.joinHeist(targetHash, { from: accounts[7] });
      await instance.joinHeist(targetHash, { from: accounts[8] });
      await instance.joinHeist(targetHash, { from: accounts[9] });
      await instance.joinHeist(targetHash, { from: accounts[10] });
      await instance.joinHeist(targetHash, { from: accounts[11] });
      await increaseTime(86410); // 1 day, 10 seconds

      // Initiate the heist
      const result = await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[1], accounts[1]);
      assert.equal(heist[4].gt(provider.utils.toBN(0)), true);

      // Check the targets balance has gone down
      const balance = await instance.balanceOf(accounts[1]);
      assert.equal(balance.lt(provider.utils.toWei('2000', 'ether')), true);

      // Test the Robbed event
      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._instigator, accounts[2]);
      assert.equal(events[0].args._target, accounts[1]);
      assert.equal(events[0].args._value.gt(0), true);
    });

    it('fails to rob a target', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it fails.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.RobberyFailed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2] });
      await increaseTime(86410); // 1 day, 10 seconds

      // Rob the target
      const result = await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[1], accounts[1]);
      assert.equal(heist[4], 0);

      // Check the targets balance has not changed gone down
      const balance = await instance.balanceOf(accounts[1]);
      assert.equal(balance.eq(provider.utils.toWei('2000', 'ether')), true);

      // Test the Robbed event
      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._instigator, accounts[2]);
      assert.equal(events[0].args._target, accounts[1]);
      assert.equal(events[0].args._reason, 'Odds');
    });

    it('fails to rob a poor target', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it fails.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.RobberyFailed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const oldBalance = await instance.balanceOf(accounts[1]);

      // Start the heist and move the time forward
      await instance.newHeist(targetHash, { from: accounts[2] });
      await increaseTime(86410); // 1 day, 10 seconds

      // Rob the target
      const result = await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[1], accounts[1]);
      assert.equal(heist[4], 0);

      // Check the targets balance has not changed gone down
      const newBalance = await instance.balanceOf(accounts[1]);
      assert.equal(oldBalance.eq(newBalance), true);

      // Test the Robbed event
      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._instigator, accounts[2]);
      assert.equal(events[0].args._target, accounts[1]);
      assert.equal(events[0].args._reason, 'Balance');
    });

    it('prevents initiating before the deadline', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(10);

      // Check if heist can be initiated before the deadline
      try {
        await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
        assert.fail('Heist can be initiated before the deadline');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents non-instigator from initiating the heist', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(86410); // 1 day, 10 seconds

      // Check if a non-instigator can initiate the heist
      try {
        await instance.robTarget(accounts[1], 'test', { from: accounts[3] });
        assert.fail('Non-instigator initiated heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents initiating the heist more than once', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(86410); // 1 day, 10 seconds

      // Initiate the heist
      var result = await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check if we can initiate the heist again
      try {
        await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
        assert.fail('Initiated and already initiated heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents initiating after the initiation deadline', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(129610); // 36 hours, 10 seconds

      // Check if we initiate the heist after the initiation deadline
      try {
        await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
        assert.fail('Expired heist initiated');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents initiating a heist if the target address is poor', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Start the heist
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(86410); // 1 day, 10 seconds

      // Initiate the heist
      const result = await instance.robTarget(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // There should be no events
      const events = eventHandler.get();
      assert.equal(events.length, 0);
    });
  });

  describe('claimHeistFunds', function() {
    it('claims funds for the instigator', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it succeeds.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Put some tokens in the target and instigator accounts, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.01', 'ether') });
      
      for (var i = 3; i <= 12; i++) {
        await instance.joinHeist(targetHash, { from: accounts[i] });
      }

      await increaseTime(86410); // 1 day, 10 seconds
      await instance.robTarget(accounts[1], 'test', { from: accounts[2] });

      // Check the heist object to make sure the heist succeeded
      const heist = await instance.heists(targetHash);
      assert.equal(heist[4].gt(provider.utils.toBN(0)), true);

      // Check the targets balance has gone down
      const oldBalance = await instance.balanceOf(accounts[2]);
      assert.equal(oldBalance.eq(0), true);

      // Initiate the heist
      const result = await instance.claimHeistFunds(targetHash, { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check the balance
      const newBalance = await instance.balanceOf(accounts[2]);
      assert.equal(newBalance.eq(heist[4].mul(0.7)), true);
    });

    it('claims funds for a conspirator', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it succeeds.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      var i, result, heist, balance;

      // Put some tokens in the target and instigator accounts, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.01', 'ether') });

      for (i = 3; i <= 12; i++) {
        await instance.joinHeist(targetHash, { from: accounts[i] });
      }

      await increaseTime(86410); // 1 day, 10 seconds
      await instance.robTarget(accounts[1], 'test', { from: accounts[2] });

      // Check the heist object to make sure the heist succeeded
      heist = await instance.heists(targetHash);
      assert.equal(heist[4].gt(provider.utils.toBN(0)), true);

      for (i = 3; i <= 12; i++) {

        // Check the targets balance has gone down
        balance = await instance.balanceOf(accounts[i]);
        assert.equal(balance.eq(0), true);

        // Initiate the heist
        result = await instance.claimHeistFunds(targetHash, { from: accounts[i] });
        assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

        // Check the balance
        balance = await instance.balanceOf(accounts[i]);
        assert.equal(balance.eq(heist[4].mul(0.03)), true);
      }
    });

    it('prevents claiming from failed heists', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it fails.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.RobberyFailed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target and instigator accounts, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2] });
      await increaseTime(86410); // 1 day, 10 seconds
      await instance.robTarget(accounts[1], 'test', { from: accounts[2] });

      // Check the event
      const events = eventHandler.get();
      assert.equal(events.length, 1);

      try {
        await instance.claimHeistFunds(targetHash, { from: accounts[2] });
        assert.fail('Claimed tokens from a failed heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents claiming once all funds are gone', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it succeeds.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target and instigator accounts, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.01', 'ether') });
      await increaseTime(86410); // 1 day, 10 seconds
      await instance.robTarget(accounts[1], 'test', { from: accounts[2] });

      // Check the event
      const events = eventHandler.get();
      assert.equal(events.length, 1);

      try {
        await instance.claimHeistFunds(targetHash, { from: accounts[2] });
        await instance.claimHeistFunds(targetHash, { from: accounts[2] });
        assert.fail('Claimed tokens after they had all been claimed');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents double dipping', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it succeeds.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target and instigator accounts, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.01', 'ether') });

      for (i = 3; i <= 12; i++) {
        await instance.joinHeist(targetHash, { from: accounts[i] });
      }

      await increaseTime(86410); // 1 day, 10 seconds
      await instance.robTarget(accounts[1], 'test', { from: accounts[2] });

      // Check the heist object to make sure the heist succeeded
      const events = eventHandler.get();
      assert.equal(events.length, 1);

      try {
        await instance.claimHeistFunds(targetHash, { from: accounts[3] });
        await instance.claimHeistFunds(targetHash, { from: accounts[3] });
        assert.fail('Claimed tokens after claiming tokens already');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents paying anyone who was not involved', async function() {
      // The robTarget method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it succeeds.
      this.retries(5);

      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target and instigator accounts, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.01', 'ether') });

      for (i = 3; i <= 12; i++) {
        await instance.joinHeist(targetHash, { from: accounts[i] });
      }

      await increaseTime(86410); // 1 day, 10 seconds
      await instance.robTarget(accounts[1], 'test', { from: accounts[2] });

      // Check the heist object to make sure the heist succeeded
      const events = eventHandler.get();
      assert.equal(events.length, 1);

      try {
        await instance.claimHeistFunds(targetHash, { from: accounts[13] });
        assert.fail('Tokens claimed by someone not involved');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });
  });

  describe('getHeistOdds', function() {
    it('no bribe or conspirators', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2] });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 40);
    });

    it('no bribe, 1 conspirator', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2] });
      await instance.joinHeist(targetHash, { from: accounts[3] });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 51);
    });

    it('+1 ether bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.1', 'ether') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 80);
    });

    it('+100 finney bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('101', 'finney') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 70);
    });

    it('+10 finney bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('11', 'finney') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 60);
    });

    it('+1 finney bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1', 'ether'), { from: accounts[0] });
      await instance.newHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.1', 'finney') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 50);
    });
  });

  describe('isInsured', function() {
    it('returns false if there is no insurance policy', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      assert.equal(await instance.isInsured(accounts[1]), false);
    });

    it('returns true if there is an insurance policy', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const result = await instance.getFreeInsurance({ from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(await instance.isInsured(accounts[1]), true);
    });

    it('returns false if there is an expired insurance policy', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const result = await instance.getFreeInsurance({ from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Move the time forward to expire the policy
      await increaseTime(86410); // 1 day, 10 seconds

      assert.equal(await instance.isInsured(accounts[1]), false);
    });
  });

  describe('getFreeInsurance', function() {
    it('gets 1 day of free insurance', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Insured();

      // Confirm the starting balance is zero
      var balance = await instance.balanceOf(accounts[1]);
      assert.equal(provider.utils.fromWei(numberToBn(balance), 'ether'), 0);

      // Buy insurance
      const result = await instance.getFreeInsurance({ from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Check the event to see if the result is correct
      const events = eventHandler.get();
      assert.equal(events[0].args._policyHolder, accounts[1]);
      assert.equal(events[0].args._expiry.gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(events[0].args._type.eq(1), true); // New policy

      // Check the insurance policy object
      const policy = await instance.insurancePolicies(accounts[1]);
      assert.equal(policy[0].eq(provider.utils.toWei('100', 'ether')), true);
      assert.equal(policy[1].gt(Math.round((new Date()).getTime() / 1000)), true);

      // The balance should not have changed
      balance = await instance.balanceOf(accounts[1]);
      assert.equal(provider.utils.fromWei(numberToBn(balance), 'ether'), 0);
    });

    it('prevents getting free insurance more than once', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Get the free insurance
      await instance.getFreeInsurance({ from: accounts[1] });
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Move the time forward
      await increaseTime(86410); // 1 day, 10 minutes
      assert.equal(await instance.isInsured(accounts[1]), false);

      // Try to buy insurance
      try {
        await instance.getFreeInsurance({ from: accounts[1] });
        assert.fail('Got free insurance twice');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });
  });

  describe('buyInsurance', function() {
    it('buys insurance', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const eventHandler = instance.Insured();

      // Get the free insurance
      await instance.getFreeInsurance({ from: accounts[1] });
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Move the time forward
      await increaseTime(86410); // 1 day, 10 minutes
      assert.equal(await instance.isInsured(accounts[1]), false);

      // Put some tokens in the account, 700 for 100 * 7 days
      await instance.transfer(accounts[1], provider.utils.toWei('700', 'ether'), { from: accounts[0] });

      // Buy insurance for 7 days
      const result = await instance.buyInsurance(7, { from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Check the event to see if the result is correct
      var events = eventHandler.get();
      assert.equal(events[0].args._policyHolder, accounts[1]);
      assert.equal(events[0].args._expiry.gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(events[0].args._type.eq(2), true); // Renewed policy

      // Check the insurance policy object
      const policy = await instance.insurancePolicies(accounts[1]);
      assert.equal(policy[0].eq(provider.utils.toWei('100', 'ether')), true);
      assert.equal(policy[1].gt(Math.round((new Date()).getTime() / 1000)), true);

      // The balance should have changed
      const balance = await instance.balanceOf(accounts[1]);
      assert.equal(provider.utils.fromWei(numberToBn(balance), 'ether'), 0);

      // The insurance fund should have increased
      const fund = await instance.insuranceFund();
      assert.equal(provider.utils.fromWei(numberToBn(fund), 'ether'), 10700);

      // Now we have insurance
      assert.equal(await instance.isInsured(accounts[1]), true);
    });

    it('prevents selling to the poor', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Get the free insurance
      await instance.getFreeInsurance({ from: accounts[1] });
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Move the time forward
      await increaseTime(86410); // 1 day, 10 minutes
      assert.equal(await instance.isInsured(accounts[1]), false);

      // Try to buy insurance
      try {
        await instance.buyInsurance(1, { from: accounts[1] });
        assert.fail('Purchased insurance without money');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents buying insurance if there has been no free trial', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Try to buy insurance
      try {
        await instance.buyInsurance(1, { from: accounts[1] });
        assert.fail('Purchased insurance when already insured');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents extending existing policies', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Get the free insurance
      await instance.getFreeInsurance({ from: accounts[1] });
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Try to buy insurance again
      try {
        await instance.buyInsurance(1, { from: accounts[1] });
        assert.fail('Purchased insurance when already insured');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents buying insurance for less than 1 day or more than 7', async function() {
      const instance = await FreeMoney.new(10000, 10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Cant buy for less than 1 day
      try {
        await instance.buyInsurance(0, { from: accounts[2] });
        assert.fail('Purchased insurance for less than 1 day');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }

      // Cant buy for more than 7 days
      try {
        await instance.buyInsurance(8, { from: accounts[2] });
        assert.fail('Purchased insurance for more than 7 days');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });
  });
});