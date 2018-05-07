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
      const instance = await FreeMoney.new(10000);
      const balance = await instance.balanceOf(accounts[0]);

      assert.equal(provider.utils.fromWei(numberToBn(balance), 'ether'), 10000, 'initialSupply was incorrect');
    });
  });

  describe('transfer', function() {
    it('fails to transfer to 0x0', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.transfer(0, provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
        assert.fail('To address was 0');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('fails to transfer insufficient funds', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.transfer(accounts[1], provider.utils.toWei('100000', 'ether'), { from: accounts[0] });
        assert.fail('Transferred insufficient funds');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('fails to transfer overflow', async function() {
      const instance = await FreeMoney.new(numberToBn(2).pow(numberToBn(256)).sub(numberToBn(1)));
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the second account
      await instance.mint(10000, { from: accounts[1], value: web3.utils.toWei('0.01', 'ether') });

      try {
        await instance.transfer(accounts[0], provider.utils.toWei('10000', 'ether'), { from: accounts[1] });
        assert.fail('Wallet balance overflowed');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('transfers to a new token holder', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Transfer();
      const result = await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      const events = eventHandler.get();

      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9000, 'Account #0 balance is not 9000');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 1000, 'Account #1 balance is not 1000');
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[1]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });

    it('transfers to an existing token holder', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Transfer();

      // Transfer the base amount
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      const result = await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      const events = eventHandler.get();

      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 8000, 'Account #0 balance is not 8000');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 2000, 'Account #1 balance is not 2000');
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[1]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });

    it('transfers to another new token holder', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Transfer();

      // Transfer the base amount
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      const result = await instance.transfer(accounts[2], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      const events = eventHandler.get();
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 8000, 'Account #0 balance is not 8000');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[2])), 'ether'), 1000, 'Account #2 balance is not 1000');
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[2]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });

    it('transfers and empties an address', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Transfer();

      // Transfer the base amount
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      await instance.transfer(accounts[2], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });

      // Empty the second account to test the _transfer method in full
      const result = await instance.transfer(accounts[0], provider.utils.toWei('1000', 'ether'), { from: accounts[2] });
      const events = eventHandler.get();
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9000, 'Account #0 balance is not 9000');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[2])), 'ether'), 0, 'Account #2 balance is not 0');
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[2]);
      assert.equal(events[0].args._to, accounts[0]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });
  });

  describe('approve', function() {
    it('approves allowances', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Approval();
      const result = await instance.approve(accounts[0], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });
      const events = eventHandler.get();

      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Approve transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.allowance(accounts[1], accounts[0])), 'ether'), 1000, 'Account #0 allowance for account #1 is not 1000');
      assert.equal(events.length, 1);
      assert.equal(events[0].args._owner, accounts[1]);
      assert.equal(events[0].args._spender, accounts[0]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });
  });

  describe('transferFrom', function() {
    it('prevents overspending of allowance', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      await instance.approve(accounts[0], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });

      try {
        await instance.transferFrom(accounts[1], accounts[2], provider.utils.toWei('10000', 'ether'), { from: accounts[0] });
        assert.fail('Allowance was overspent');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('spends the allowance', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Transfer();

      // Approve an account
      await instance.approve(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      const result = await instance.transferFrom(accounts[0], accounts[2], provider.utils.toWei('1000', 'ether'), { from: accounts[1] });
      const events = eventHandler.get();

      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Transfer From transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 9000, 'Account #0 balance is not 9000');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 0, 'Account #1 balance is not 0');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[2])), 'ether'), 1000, 'Account #2 balance is not 1000');
      assert.equal(events.length, 1);
      assert.equal(events[0].args._from, accounts[0]);
      assert.equal(events[0].args._to, accounts[2]);
      assert.equal(events[0].args._value.eq(provider.utils.toWei('1000', 'ether')), true);
    });
  });

  describe('mint', function() {
    it('mints for the owner for free', async function() {
      const instance = await FreeMoney.new(10000);

      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 10000, 'Account #0 balance is not 10000');

      const result = await instance.mint(1000, { from: accounts[0] });

      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Mint transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 11000, 'Account #0 balance is now 11000');
    });

    it('mints for donors for a price', async function() {
      const instance = await FreeMoney.new(10000);

      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 0, 'Account #1 balance is not 0');

      const result = await instance.mint(1000, { from: accounts[1], value: web3.utils.toWei('0.01', 'ether') });

      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1, 'Mint transaction failed');
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[1])), 'ether'), 1000, 'Account #1 balance is not 1000');
    });

    it('doesnt mint for stingy donors', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[2])), 'ether'), 0, 'Account #2 balance is not 1000');

      try {
        await instance.mint(1000, { from: accounts[1] });
        assert.fail('Tokens minted without donation');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });
  });

  describe('tax', function() {
    it('doesnt let non owners tax', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.tax(100, { from: accounts[1] });
        assert.fail('Taxing allowed by non owner');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('doesnt let owner tax less than 1%', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.tax(0, { from: accounts[0] }); // 0%
        assert.fail('Taxing less than 1% allowed by owner was allowed');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('doesnt let owner tax more than 10%', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      try {
        await instance.tax(10000, { from: accounts[0] }); // 100%
        assert.fail('Taxing greater than 10% allowed by owner');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('taxes all accounts except the owner', async function() {
      const instance = await FreeMoney.new(10000);
      var totalAccounts = accounts.length < 10 ? accounts.length : 10;
      var i;

      // Set preliminary balances
      for (i = 1; i < totalAccounts; i++) {
        await instance.transfer(accounts[i], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
        assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[i])), 'ether'), 1000, 'Account #' + i + ' balance is not 1000');
      }

      // Tax everyone
      const result = await instance.tax(1000, { from: accounts[0] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check updated balances
      assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[0])), 'ether'), 1900);
      for (i = 1; i < totalAccounts; i++) {
        assert.equal(provider.utils.fromWei(numberToBn(await instance.balanceOf(accounts[i])), 'ether'), 900, 'Account #' + i + ' balance is not 900');
      }
    });
  });

  describe('planHeist', function() {
    it('starts a new heist', async function() {
      const instance = await FreeMoney.new(10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      const result = await instance.planHeist(targetHash, { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[0], accounts[2]);
      assert.equal(heist[1].gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(heist[2].gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(heist[3], 0);
      assert.equal(heist[4], false);

      // Check the new heist event
      var events = NewHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._instigator, accounts[2]);
      assert.equal(events[0].args._deadline.eq(heist[1]), true);

      // There should be no joined heist event
      assert.equal(JoinedHeist.get().length, 0);
    });

    it('joins an existing heist', async function() {
      const instance = await FreeMoney.new(10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      await instance.planHeist(targetHash, { from: accounts[2] });
      assert.equal(NewHeist.get().length, 1);

      // Add conspirators
      await instance.planHeist(targetHash, { from: accounts[3] });
      var events = JoinedHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._conspirator, accounts[3]);

      await instance.planHeist(targetHash, { from: accounts[4] });
      events = JoinedHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._conspirator, accounts[4]);

      await instance.planHeist(targetHash, { from: accounts[5] });
      events = JoinedHeist.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._conspirator, accounts[5]);
    });

    it('starts a new heist with a bribe', async function() {
      const instance = await FreeMoney.new(10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1', 'ether') });
      assert.equal(NewHeist.get().length, 1);
      assert.equal(JoinedHeist.get().length, 0);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[0], accounts[2]);
      assert.equal(heist[1].gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(heist[2].gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(heist[3], provider.utils.toWei('1', 'ether'));
      assert.equal(heist[4], false);
    });

    it('adds a bribe to an existing heist', async function() {
      const instance = await FreeMoney.new(10000);
      const NewHeist = instance.NewHeist();
      const JoinedHeist = instance.JoinedHeist();
      const targetHash = provider.utils.sha3(accounts[1], 'test');

      // Start the heist
      await instance.planHeist(targetHash, { from: accounts[2] });
      assert.equal(NewHeist.get().length, 1);

      // Add the bribe
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1', 'ether') });
      assert.equal(NewHeist.get().length, 0);
      assert.equal(JoinedHeist.get().length, 0);

      // Check the heist object
      const heist = await instance.heists(targetHash);
      assert.equal(heist[0], accounts[2]);
      assert.equal(heist[1].gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(heist[2].gt(Math.round((new Date()).getTime() / 1000)), true);
      assert.equal(heist[3], provider.utils.toWei('1', 'ether'));
      assert.equal(heist[4], false);
    });
  });

  describe('hashTarget', function() {
    it('correctly hashes the target and salt', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      assert.equal(targetHash, provider.utils.soliditySha3(accounts[1], 'test'));
    });
  });

  describe('initiateHeist', function() {
    it('initiates a heist', async function() {
      // The initiateHeist method calls internal getHeistOutcome, which uses
      // block.timestamp and block.difficulty to generate a pseudo-random
      // number. Since we have no control over the outcome of the heist, we
      // can retry it a number of times in the hope it succeeds.
      this.retries(5);

      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await instance.planHeist(targetHash, { from: accounts[3] });
      await instance.planHeist(targetHash, { from: accounts[4] });
      await instance.planHeist(targetHash, { from: accounts[5] });
      await increaseTime(86410); // 1 day, 10 seconds

      // Initiate the heist
      const result = await instance.initiateHeist(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Test the Robbed event
      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._instigator, accounts[2]);
      assert.equal(events[0].args._target, accounts[1]);
      assert.equal(events[0].args._value.gt(0), true);
    });

    it('prevents initiating before the deadline', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(10);

      // Check if heist can be initiated before the deadline
      try {
        await instance.initiateHeist(accounts[1], 'test', { from: accounts[2] });
        assert.fail('Heist can be initiated before the deadline');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents non-instigator from initiating the heist', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(86410); // 1 day, 10 seconds

      // Check if a non-instigator can initiate the heist
      try {
        await instance.initiateHeist(accounts[1], 'test', { from: accounts[3] });
        assert.fail('Non-instigator initiated heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents initiating the heist more than once', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(86410); // 1 day, 10 seconds

      // Initiate the heist
      var result = await instance.initiateHeist(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // Test the Robbed event
      const events = eventHandler.get();
      assert.equal(events.length, 1);
      assert.equal(events[0].args._instigator, accounts[2]);
      assert.equal(events[0].args._target, accounts[1]);
      assert.equal(events[0].args._value.gt(0), true);

      // Check if we can initiate the heist again
      try {
        await instance.initiateHeist(accounts[1], 'test', { from: accounts[2] });
        assert.fail('Initiated and already initiated heist');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents initiating after the initiation deadline', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Put some tokens in the target account, start the heist, and move the time forward
      await instance.transfer(accounts[1], provider.utils.toWei('2000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(129610); // 36 hours, 10 seconds

      // Check if we initiate the heist after the initiation deadline
      try {
        await instance.initiateHeist(accounts[1], 'test', { from: accounts[2] });
        assert.fail('Expired heist initiated');
      } catch (e) {
        assert.equal(e.message, errorMsg);
      }
    });

    it('prevents initiating a heist if the target address is poor', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Robbed();
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Start the heist
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('0.01', 'ether') });
      await increaseTime(86410); // 1 day, 10 seconds

      // Initiate the heist
      const result = await instance.initiateHeist(accounts[1], 'test', { from: accounts[2] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);

      // There should be no events
      const events = eventHandler.get();
      assert.equal(events.length, 0);
    });
  });

  describe('getHeistOdds', function() {
    it('no bribe or conspirators', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2] });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 40);
    });

    it('no bribe, 1 conspirator', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2] });
      await instance.planHeist(targetHash, { from: accounts[3] });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 51);
    });

    it('+1 ether bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.1', 'ether') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 80);
    });

    it('+100 finney bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('101', 'finney') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 70);
    });

    it('+10 finney bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('11', 'finney') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 60);
    });

    it('+1 finney bribe, no conspirator', async function() {
      const instance = await FreeMoney.new(10000);
      const targetHash = await instance.hashTarget(accounts[1], 'test');

      // Initiate a heist
      await instance.transfer(accounts[1], provider.utils.toWei('1000', 'ether'), { from: accounts[0] });
      await instance.planHeist(targetHash, { from: accounts[2], value: provider.utils.toWei('1.1', 'finney') });

      const odds = await instance.getHeistOdds(targetHash);
      assert.equal(odds, 50);
    });
  });

  describe('isInsured', function() {
    it('returns false if there is no insurance policy', async function() {
      const instance = await FreeMoney.new(10000);
      assert.equal(await instance.isInsured(accounts[1]), false);
    });

    it('returns true if there is an insurance policy', async function() {
      const instance = await FreeMoney.new(10000);
      const result = await instance.buyInsurance(1, { from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(await instance.isInsured(accounts[1]), true);
    });

    it('returns false if there is an expired insurance policy', async function() {
      const instance = await FreeMoney.new(10000);
      const result = await instance.buyInsurance(1, { from: accounts[1] });
      assert.equal(provider.utils.hexToNumber(result.receipt.status), 1);
      assert.equal(await instance.isInsured(accounts[1]), true);

      // Move the time forward to expire the policy
      await increaseTime(86410); // 1 day, 10 seconds

      assert.equal(await instance.isInsured(accounts[1]), false);
    });
  });

  describe('buyInsurance', function() {
    it('gets 1 day of free insurance', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Insured();

      // Confirm the starting balance is zero
      var balance = await instance.balanceOf(accounts[1]);
      assert.equal(provider.utils.fromWei(numberToBn(balance), 'ether'), 0);

      // Buy insurance
      const result = await instance.buyInsurance(1, { from: accounts[1] });
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

    it('buys insurance', async function() {
      const instance = await FreeMoney.new(10000);
      const eventHandler = instance.Insured();

      // Get the free insurance
      await instance.buyInsurance(1, { from: accounts[1] });
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
      assert.equal(provider.utils.fromWei(numberToBn(fund), 'ether'), 700);

      // Now we have insurance
      assert.equal(await instance.isInsured(accounts[1]), true);
    });

    it('prevents selling to the poor', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Get the free insurance
      await instance.buyInsurance(1, { from: accounts[1] });
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

    it('prevents extending existing policies', async function() {
      const instance = await FreeMoney.new(10000);
      const errorMsg = 'VM Exception while processing transaction: revert';

      // Get the free insurance
      await instance.buyInsurance(1, { from: accounts[1] });
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
      const instance = await FreeMoney.new(10000);
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