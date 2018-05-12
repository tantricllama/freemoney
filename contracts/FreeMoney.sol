pragma solidity ^0.4.23;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

/// @title Free Money
/// @author Brendan Smith
/// @notice Everyone deserves to be rich ;)
contract FreeMoney is Ownable {
    using SafeMath for uint256;

    string public name = 'Free Money';
    string public symbol = 'FMY';
    uint256 public decimals = 18;
    uint256 public totalSupply;
    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    /// @notice Token holder tracking for tax purposes
    address[] public tokenHolders;
    event Taxed(uint256 _amount);

    /// @notice Heists can be instigated by any token holder
    struct Heist {
        address instigator;
        address[] conspirators;
        uint256 deadline;
        uint256 initiateDeadline;
        uint256 bribe;
        bool initiated;
    }
    uint256 maxConspirators = 10;
    mapping (bytes32 => Heist) public heists;
    event NewHeist(address indexed _instigator, uint256 _deadline);
    event JoinedHeist(address indexed _conspirator);
    event Robbed(address indexed _target, address indexed _instigator, uint256 _value);

    /// @notice Insurance protects against loss from heists
    struct InsurancePolicy {
        uint256 value;
        uint256 expiry;
    }
    uint256 public insuranceFund = 0;
    uint256 public maxPolicyLength = 7; // days
    uint256 public insuranceCost = 100 * (10 ** decimals);
    uint256 public insuranceMultiplier = 2;
    mapping (address => InsurancePolicy) public insurancePolicies;
    event Insured(address indexed _policyHolder, uint256 _expiry, uint8 _type);

    /// @notice Instantiates the contract and gives the initial tokens to the sender
    /// @param _initialSupply Number of initial tokens
    /// @param _insuranceFund Insurance fund initial balance
    constructor(uint256 _initialSupply, uint256 _insuranceFund) public {
        balanceOf[msg.sender] = _initialSupply.mul(10 ** decimals);
        insuranceFund = _insuranceFund.mul(10 ** decimals);
        totalSupply = balanceOf[msg.sender].add(insuranceFund);
    }

    /// @notice Transfers tokens between two addresses
    /// @param _from Sending address
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    function _transfer(address _from, address _to, uint256 _value) internal returns (bool) {
        require(_to != 0x0); // To address cannot be 0
        require(balanceOf[_from] >= _value);

        // Check if the recipient is a token holder already
        if (balanceOf[_to] == 0) {
            tokenHolders.push(_to);
        }

        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);

        // Remove the sender from the token holders list
        if (balanceOf[_from] == 0 && _from != owner) {
            for (uint256 i = 0; i < tokenHolders.length; i++) {
                if (tokenHolders[i] == _from) {
                    delete tokenHolders[i];
                    break;
                }
            }
        }

        emit Transfer(_from, _to, _value);

        return true;
    }

    /// @notice Transfers tokens from the sender
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    /// @return true If the tranfer succeeds
    function transfer(address _to, uint256 _value) public returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    /// @notice Spends the senders allowance from the _from address
    /// @param _from Sending address
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    /// @return true If the tranfer succeeds
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        require(_value <= allowance[_from][msg.sender]);

        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_value);

        return _transfer(_from, _to, _value);
    }

    /// @notice Approves an address to spend an allowance of tokens from the sender address
    /// @param _spender The address to approve for spending the senders tokens
    /// @param _value Number tokens the spender can send
    /// @return true If the approval succeeds
    function approve(address _spender, uint256 _value) public returns (bool) {
        allowance[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);

        return true;
    }

    /// @notice Mints a number of new coins for a donation of ETH
    /// @dev Free for the owner
    /// @param _value Number of tokens to mint
    function mint(uint256 _value) public payable {
        require(msg.sender == owner || msg.value > 0);

        uint256 newAmount = _value.mul(10 ** decimals);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(newAmount);
        totalSupply = totalSupply.add(newAmount);

        emit Transfer(0, owner, _value);

        if (msg.sender != owner) {
            tokenHolders.push(msg.sender);

            emit Transfer(owner, msg.sender, _value);
        }
    }

    /// @notice Taxes each token holder and transfers the tokens to the owner
    /// @dev This method will likely have a high gas cost
    /// @param _amount The amount to tax, range is 1-10%
    function tax(uint256 _amount) public onlyOwner {
        // Tax amount must be between 1% and 10%
        require(_amount >= 100 && _amount <= 1000);

        for (uint256 i = 0; i < tokenHolders.length; i++) {
            _transfer(tokenHolders[i], owner, (balanceOf[tokenHolders[i]].div(10000).mul(_amount)));
        }

        emit Taxed(_amount);
    }

    /// @dev Hash the target address for a heist
    /// @param _target The target address for a heist
    /// @param _salt A random value to ensure secrecy of the target
    /// @return The hash of the target address
    function hashTarget(address _target, string _salt) pure public returns (bytes32) {
        return keccak256(_target, _salt);
    }

    /// @notice Starts a heist or joins an existing heist
    /// @param _targetHash A hashed target, created by the hashTarget function
    function planHeist(bytes32 _targetHash) public payable {
        Heist storage heist = heists[_targetHash];

        if (heist.instigator == 0) {
            // New heist, set the 24 hour deadline
            heist.instigator = msg.sender;
            heist.deadline = now.add(24 hours);
            heist.initiateDeadline = now.add(36 hours);

            heist.bribe = msg.value;
            heist.initiated = false;

            emit NewHeist(msg.sender, heist.deadline);
        } else {
            heist.bribe = heist.bribe.add(msg.value);

            // Existing heist, add the sender to the conspirators
            if (heist.instigator != msg.sender) {
                require(heist.conspirators.length < maxConspirators);

                heist.conspirators.push(msg.sender);

                emit JoinedHeist(msg.sender);
            }
        }

        // Bribes are always helpful
        if (msg.value > 0) {
            owner.transfer(msg.value);
        }
    }

    /// @notice Reveals the heist target and robs the address
    /// @dev This is called by the instigator between the deadline and initiateDeadline
    /// @param _target The target address for a heist
    /// @param _salt A random value to ensure secrecy of the target
    function initiateHeist(address _target, string _salt) public {
        Heist storage heist = heists[hashTarget(_target, _salt)];

        // Prevent double dipping!
        require(!heist.initiated);

        // Within the allowed timeframe
        require(now >= heist.deadline);
        require(now <= heist.initiateDeadline);

        // Only the instigator can initiate the heist
        require(heist.instigator == msg.sender);

        heist.initiated = true;

        // Target should have at least 5% of the available coins
        uint256 threshold = totalSupply.sub(balanceOf[owner]).div(100).mul(5);

        /// @dev If threshold is zero, and balance is greater than or
        // equal to threshold then empty accounts could be robbed

        if (getHeistOutcome(_target, _salt) && balanceOf[_target] > threshold) {
            bytes32 hash = keccak256(block.timestamp, block.difficulty, msg.sender, _target, _salt);
            uint256 percentage = (uint256(hash) % 4).add(1).mul(10);
            uint256 amount = balanceOf[_target].div(100).mul(percentage);
            uint256 originalBalance = balanceOf[_target];

            payoutHeist(heist, _target, amount);

            emit Robbed(_target, msg.sender, amount);

            if (isInsured(_target)) {
                uint256 claimAmount = originalBalance.sub(balanceOf[_target]);

                balanceOf[_target] = balanceOf[_target].add(claimAmount);
                insuranceFund = insuranceFund.sub(claimAmount);
            }
        }
    }

    /// @notice Transfers heisted tokens to those involved in the heist
    /// @param _heist An initiated heist
    /// @param _target The target address for a heist
    /// @param _amount The percentage portion of the targets tokens to steal
    function payoutHeist(Heist _heist, address _target, uint256 _amount) internal {
        uint256 toOwner = _amount.div(100); // 1%
        uint256 toInstigator = _amount.div(100).mul(80); // 80%
        uint256 remainder = _amount.sub(toOwner.add(toInstigator));

        _transfer(_target, owner, toOwner);

        // Give each of the conspirators 10% of the remainder
        uint256 share;
        for (uint256 i = 0; i < _heist.conspirators.length; i++) {
            share = remainder.div(100).mul(10);
            remainder -= share;

            _transfer(_target, _heist.conspirators[i], share);
        }

        _transfer(_target, msg.sender, toInstigator.add(remainder));
    }

    /// @notice Use a pseudo-random number to determine if the heist succeeds
    /// @dev This method will likely have a high gas cost
    /// @param _target The target address for a heist
    /// @param _salt A random value to ensure secrecy of the target
    /// @return true If the heist is succeessful
    function getHeistOutcome(address _target, string _salt) internal view returns (bool) {
        bytes32 targetHash = hashTarget(_target, _salt);
        bytes32 random = keccak256(block.timestamp, block.difficulty, msg.sender, _target, _salt);

        Heist memory heist = heists[targetHash];

        for (uint256 i = 0; i < heist.conspirators.length; i++) {
            random = keccak256(random, i, heist.conspirators.length, heist.conspirators[i]);
        }

        uint256 odds = getHeistOdds(targetHash);
        uint256 outcome = uint256(random) % 100;

        return outcome <= odds;
    }

    /// @notice Calculate the odds of the heist succeeding
    /// @param _targetHash A hashed target, created by the hashTarget function
    /// @return uint256 The odds of the heist succeeding
    function getHeistOdds(bytes32 _targetHash) public view returns (uint256) {
        Heist memory heist = heists[_targetHash];

        uint256 odds = 50; // 50% chance of the heist succeeding

        if (heist.bribe > 1 ether) {
            odds = 90;
        } else if (heist.bribe > 100 finney) {
            odds = 80;
        } else if (heist.bribe > 10 finney) {
            odds = 70;
        } else if (heist.bribe > 1 finney) {
            odds = 60;
        }

        if (heist.conspirators.length == 0) {
            odds = odds.sub(10);
        } else {
            odds = odds.add(heist.conspirators.length % 10);
        }

        return odds;
    }

    /// @notice Checks if an address has an insurance policy
    /// @param _address The address to check for an insurance policy
    /// @return true If the address has insurance
    function isInsured(address _address) public view returns (bool) {
        InsurancePolicy memory policy = insurancePolicies[_address];

        if (policy.expiry > 0) {
            return policy.expiry >= now;
        }

        return false;
    }

    /// @notice Buys an insurance policy for an address 
    /// @dev If the address has never been insured, it gets 1 day free
    /// @param _days The desired length of the insurance policy in days
    function buyInsurance(uint256 _days) public {
        require(!isInsured(msg.sender));
        require(_days >= 1 && _days <= maxPolicyLength);

        InsurancePolicy storage policy = insurancePolicies[msg.sender];

        if (policy.value == 0) {
            // If the address has never bought insurance then _days are ignored and the first day is free.
            policy.expiry = now.add(1 days);

            // Set the price of the next policy
            policy.value = insuranceCost;

            emit Insured(msg.sender, policy.expiry, 1);
        } else {
            // Expired
            uint256 cost = policy.value.mul(_days);

            require(balanceOf[msg.sender] >= cost);

            // Pay into the insurance fund
            balanceOf[msg.sender] = balanceOf[msg.sender].sub(cost);
            insuranceFund = insuranceFund.add(cost);

            // The cost of insurance doubles after each purchase
            policy.expiry = now.add(_days * 1 days);

            emit Insured(msg.sender, policy.expiry, 2);
        }
    }
}