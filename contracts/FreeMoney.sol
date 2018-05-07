pragma solidity ^0.4.21;

import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

/// @title Free Money
/// @author Brendan Smith
/// @notice Everyone deserves to be rich ;)
contract FreeMoney is Ownable {
    string public name = 'Free Money';
    string public symbol = 'FMY';
    uint public decimals = 18;
    uint public totalSupply;
    mapping (address => uint) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    /// @notice Token holder tracking for tax purposes
    address[] public tokenHolders;

    /// @notice Heists can be instigated by any token holder
    struct Heist {
        address instigator;
        address[] conspirators;
        uint deadline;
        uint initiateDeadline;
        uint bribe;
        bool initiated;
    }
    mapping (bytes32 => Heist) public heists;
    event NewHeist(address indexed _instigator, uint256 _deadline);
    event JoinedHeist(address indexed _conspirator);
    event Robbed(address indexed _target, address indexed _instigator, uint256 _value);

    /// @notice Insurance protects against loss from heists
    struct InsurancePolicy {
        uint value;
        uint expiry;
    }
    uint public insuranceFund = 0;
    uint public maxPolicyLength = 7; // days
    mapping (address => InsurancePolicy) public insurancePolicies;
    event Insured(address indexed _policyHolder, uint256 _expiry, uint8 _type);

    /// @notice Instantiates the contract and gives the initial tokens to the sender
    /// @param _initialSupply Number of initial tokens
    function FreeMoney(uint _initialSupply) public {
        totalSupply = _initialSupply * (10 ** decimals);
        balanceOf[msg.sender] = totalSupply;
    }

    /// @notice Transfers tokens between two addresses
    /// @param _from Sending address
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    function _transfer(address _from, address _to, uint _value) internal returns (bool) {
        require(_to != 0x0); // To address cannot be 0
        require(balanceOf[_from] >= _value);
        require(balanceOf[_to] + _value >= balanceOf[_to]);

        // Check if the recipient is a token holder already
        if (balanceOf[_to] == 0) {
            tokenHolders.push(_to);
        }

        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;

        // Remove the sender from the token holders list
        if (balanceOf[_from] == 0 && _from != owner) {
            for (uint i = 0; i < tokenHolders.length; i++) {
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
    function transfer(address _to, uint _value) public returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    /// @notice Spends the senders allowance from the _from address
    /// @param _from Sending address
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    /// @return true If the tranfer succeeds
    function transferFrom(address _from, address _to, uint _value) public returns (bool) {
        require(_value <= allowance[_from][msg.sender]);

        allowance[_from][msg.sender] -= _value;

        return _transfer(_from, _to, _value);
    }

    /// @notice Approves an address to spend an allowance of tokens from the sender address
    /// @param _spender The address to approve for spending the senders tokens
    /// @param _value Number tokens the spender can send
    /// @return true If the approval succeeds
    function approve(address _spender, uint _value) public returns (bool) {
        allowance[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);

        return true;
    }

    /// @notice Mints a number of new coins for a donation of ETH
    /// @dev Free for the owner
    /// @param _value Number of tokens to mint
    function mint(uint _value) public payable {
        require(msg.sender == owner || msg.value > 0);

        uint newAmount = _value * (10 ** decimals);
        balanceOf[msg.sender] += newAmount;
        totalSupply += newAmount;

        emit Transfer(0, owner, _value);

        if (msg.sender != owner) {
            tokenHolders.push(msg.sender);

            emit Transfer(owner, msg.sender, _value);
        }
    }

    /// @notice Taxes each token holder and transfers the tokens to the owner
    /// @dev This method will likely have a high gas cost
    /// @param _amount The amount to tax, range is 1-10%
    function tax(uint _amount) public onlyOwner {
        // Tax amount must be between 1% and 10%
        require(_amount >= 100 && _amount <= 1000);

        for (uint i = 0; i < tokenHolders.length; i++) {
            // TODO: Tax thresholds
            _transfer(tokenHolders[i], owner, (balanceOf[tokenHolders[i]] / 10000 * _amount));
        }

        // TODO: Tax event
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

        // Bribes are always helpful
        if (msg.value > 0) {
            owner.transfer(msg.value);
        }

        if (heist.instigator == 0) {
            // New heist, set the 24 hour deadline
            heist.instigator = msg.sender;
            heist.deadline = now + 24 hours;
            heist.initiateDeadline = now + 36 hours;
            heist.bribe = msg.value;
            heist.initiated = false;

            emit NewHeist(msg.sender, heist.deadline);
        } else {
            heist.bribe += msg.value;

            // Existing heist, add the sender to the conspirators
            if (heist.instigator != msg.sender) {
                heist.conspirators.push(msg.sender);

                emit JoinedHeist(msg.sender);
            }
        }
    }

    /// @notice Reveals the heist target and robs the address
    /// @dev This is called by the instigator between the deadline and initiateDeadline
    /// @param _target The target address for a heist
    /// @param _salt A random value to ensure secrecy of the target
    function initiateHeist(address _target, string _salt) public returns (bool) {
        bytes32 targetHash = hashTarget(_target, _salt);

        Heist storage heist = heists[targetHash];

        // Prevent double dipping!
        require(!heist.initiated);

        // Within the allowed timeframe
        require(now >= heist.deadline);
        require(now <= heist.initiateDeadline);

        // Only the instigator can initiate the heist
        require(heist.instigator == msg.sender);

        heist.initiated = true;

        // Target should have at least 5% of the available coins
        uint availableCoins = totalSupply - balanceOf[owner];
        uint threshold = availableCoins / 100 * 5;

        /// @dev If threshold is zero, and balance is greater than or
        // equal to threshold then empty accounts could be robbed

        if (getHeistOutcome(_target, _salt) && balanceOf[_target] > threshold) {
            // TODO: Pay the instigator and lock the conspirator funds from the account

            emit Robbed(_target, msg.sender, 1 * (10 ** decimals));

            return true;
        }

        return false;
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

        for (uint i = 0; i < heist.conspirators.length; i++) {
            random = keccak256(random, i, heist.conspirators.length, heist.conspirators[i]);
        }

        uint odds = getHeistOdds(targetHash);
        uint outcome = uint256(random) % 100;

        return outcome <= odds;
    }

    /// @notice Calculate the odds of the heist succeeding
    /// @param _targetHash A hashed target, created by the hashTarget function
    /// @return uint The odds of the heist succeeding
    function getHeistOdds(bytes32 _targetHash) public view returns (uint) {
        Heist memory heist = heists[_targetHash];

        uint odds = 50; // 50% chance of the heist succeeding

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
            odds -= 10;
        } else {
            odds += heist.conspirators.length % 10;
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
    function buyInsurance(uint _days) public {
        require(!isInsured(msg.sender));
        require(_days >= 1 && _days <= maxPolicyLength);

        InsurancePolicy storage policy = insurancePolicies[msg.sender];

        if (policy.value == 0) {
            // If the address has never bought insurance then _days are ignored and the first day is free.
            policy.expiry = now + 1 days;

            // Set the price of the next policy
            policy.value = 100 * (10 ** decimals);

            emit Insured(msg.sender, policy.expiry, 1);
        } else {
            // Expired
            uint cost = policy.value * _days;

            require(balanceOf[msg.sender] >= cost);

            // Pay into the insurance fund
            balanceOf[msg.sender] -= cost;
            insuranceFund += cost;

            // The cost of insurance doubles after each purchase
            policy.expiry = now + (_days * 1 days);

            emit Insured(msg.sender, policy.expiry, 2);
        }
    }
}