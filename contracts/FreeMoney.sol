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

    uint256 public mintStart;
    uint256 public mintCount = 0;
    uint256 public mintPerDay = 100000 * (10 ** decimals);

    /// @notice Heists can be instigated by any token holder
    struct Heist {
        address instigator;
        address target;
        address[] conspirators;
        address[] claims;
        uint256 start;
        uint256 bribe;
        uint256 amount;
    }
    uint256 maxConspirators = 10;
    uint256 heistDeadline = 24 hours;
    uint256 heistInitationDeadline = 36 hours;
    mapping (bytes32 => Heist) public heists;
    event NewHeist(address indexed _instigator, uint256 _deadline);
    event JoinedHeist(address indexed _conspirator);
    event Robbed(address indexed _target, address indexed _instigator, uint256 _value);
    event RobberyFailed(address indexed _target, address indexed _instigator, string _reason);

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

    modifier validDestination(address _to) {
        require(_to != address(0x0));
        require(_to != address(this));
        _;
    }

    /// @notice Instantiates the contract and gives the initial tokens to the sender
    /// @param _initialSupply Number of initial tokens
    /// @param _insuranceFund Insurance fund initial balance
    constructor(uint256 _initialSupply, uint256 _insuranceFund) public {
        balanceOf[msg.sender] = _initialSupply.mul(10 ** decimals);
        insuranceFund = _insuranceFund.mul(10 ** decimals);
        totalSupply = balanceOf[msg.sender].add(insuranceFund);
        mintStart = now;
    }

    /// @notice Transfers tokens between two addresses
    /// @param _from Sending address
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    function _transfer(address _from, address _to, uint256 _value) internal returns (bool) {
        require(balanceOf[_from] >= _value);

        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);

        emit Transfer(_from, _to, _value);

        return true;
    }

    /// @notice Transfers tokens from the sender
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    /// @return true If the tranfer succeeds
    function transfer(address _to, uint256 _value) public validDestination(_to) returns (bool) {
        return _transfer(msg.sender, _to, _value);
    }

    /// @notice Spends the senders allowance from the _from address
    /// @param _from Sending address
    /// @param _to Receiving address
    /// @param _value Number tokens to send
    /// @return true If the tranfer succeeds
    function transferFrom(address _from, address _to, uint256 _value) public validDestination(_to) returns (bool) {
        require(_value <= allowance[_from][msg.sender]);

        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_value);

        return _transfer(_from, _to, _value);
    }

    /// @notice Approves an address to spend an allowance of tokens from the sender address
    /// @param _spender The address to approve for spending the senders tokens
    /// @param _value Number tokens the spender can send
    /// @return true If the approval succeeds
    function approve(address _spender, uint256 _value) public returns (bool) {
        // To change the approve amount you first have to reduce the addresses`
        //  allowance to zero by calling `approve(_spender,0)` if it is not
        //  already 0 to mitigate the race condition described here:
        //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
        require((_value == 0) || (allowance[msg.sender][_spender] == 0));

        allowance[msg.sender][_spender] = _value;

        emit Approval(msg.sender, _spender, _value);

        return true;
    }

    /// @notice Sends ETH from the contract to the owner.
    /// @param _amount Amount of ETH to send
    /// @return true Once the ETH has been sent
    function withdraw(uint _amount) public onlyOwner returns (bool) {
        require(_amount <= address(this).balance);

        owner.transfer(_amount);

        return true;
    }

    /// @notice Sets the maximum amount of tokens to mint each day
    /// @param _amount The amount of tokens
    function setMintPerDay(uint256 _amount) public onlyOwner {
        mintPerDay = _amount;
    }

    /// @notice Mints up to 100 tokens for the sender.
    function claimTokens() public {
        if (mintStart < now.sub(1 days)) {
            mintStart = now;
            mintCount = 0;
        }

        require(mintCount < mintPerDay);

        // 1-100
        uint256 toMint = (uint256(keccak256(msg.sender, now, mintStart, mintCount)) % 100).add(1).mul(10 ** decimals);

        if (mintCount.add(toMint) > mintPerDay) {
            toMint = mintPerDay.sub(mintCount);
        }

        mintCount = mintCount.add(toMint);
        balanceOf[msg.sender] = balanceOf[msg.sender].add(toMint);
        totalSupply = totalSupply.add(toMint);

        emit Transfer(address(this), msg.sender, toMint);
    }

    /// @dev Hash the target address for a heist
    /// @param _target The target address for a heist
    /// @param _salt A random value to ensure secrecy of the target
    /// @return The hash of the target address
    function hashTarget(address _target, string _salt) public pure returns (bytes32) {
        return keccak256(_target, _salt);
    }

    /// @notice Starts a heist
    /// @param _targetHash A hashed target, created by the hashTarget function
    function newHeist(bytes32 _targetHash) public payable {
        Heist storage heist = heists[_targetHash];

        require(heist.instigator == 0);

        heist.instigator = msg.sender;
        heist.start = now;

        if (msg.value > 0) {
            heist.bribe = msg.value;
        }

        emit NewHeist(msg.sender, now + heistDeadline);

    }

    /// @notice Joins an existing heist
    /// @param _targetHash A hashed target, created by the hashTarget function
    function joinHeist(bytes32 _targetHash) public payable {
        Heist storage heist = heists[_targetHash];

        require(heist.instigator != 0);

        if (heist.instigator != msg.sender) {
            require(heist.conspirators.length < maxConspirators);

            heist.conspirators.push(msg.sender);

            emit JoinedHeist(msg.sender);
        }

        if (msg.value > 0) {
            heist.bribe = heist.bribe.add(msg.value);
        }
    }

    /// @notice Reveals the heist target and robs the address
    /// @dev This is called by the instigator between the deadline and initiateDeadline
    /// @param _target The target address for a heist
    /// @param _salt A random value to ensure secrecy of the target
    function robTarget(address _target, string _salt) public {
        Heist storage heist = heists[hashTarget(_target, _salt)];

        // Prevent double dipping!
        require(heist.target == 0);

        // Within the allowed timeframe
        require(now >= heist.start + heistDeadline);
        require(now <= heist.start + heistInitationDeadline);

        // Only the instigator can initiate the heist
        require(heist.instigator == msg.sender);

        // Reveal the target
        heist.target = _target;

        // Target should have at least 5% of the available coins
        uint256 threshold = totalSupply.sub(balanceOf[owner]).div(100).mul(5);

        if (balanceOf[_target] > threshold) {
            if (_getHeistOutcome(_target, _salt)) {
                uint256 hashInt = uint256(keccak256(block.timestamp, block.difficulty, msg.sender, _target, _salt)) % 4;
                uint256 percentage = hashInt.add(1).mul(10); // 10-40%
                uint256 amount = balanceOf[_target].div(100).mul(percentage);

                heist.amount = amount.sub(amount % 100); // make it divisible by 100

                balanceOf[_target] = balanceOf[_target].sub(heist.amount);

                emit Robbed(_target, msg.sender, amount);
            } else {
                emit RobberyFailed(_target, msg.sender, 'Odds');
            }
        } else {
            emit RobberyFailed(_target, msg.sender, 'Balance');
        }
    }

    /// @notice Transfers a portion of the heist funds to the instigator or conspirator, depending on who calls the function
    /// @param _targetHash A hashed target, created by the hashTarget function
    function claimHeistFunds(bytes32 _targetHash) public {
        Heist storage heist = heists[_targetHash];

        require(heist.amount > 0);

        uint256 i;

        for (i = 0; i < heist.claims.length; i++) {
            require(heist.claims[i] != msg.sender);
        }

        uint256 share;

        if (heist.instigator == msg.sender) {
            share = 70 + (3 * (maxConspirators - heist.conspirators.length));
        } else {
            bool found = false;

            for (i = 0; i < heist.conspirators.length; i++) {
                if (heist.conspirators[i] == msg.sender) {
                    found = true;
                    break;
                }
            }

            require(found);

            share = 3;
        }

        heist.claims.push(msg.sender);

        _transfer(heist.target, msg.sender, heist.amount.div(100).mul(share));
    }

    /// @notice Use a pseudo-random number to determine if the heist succeeds
    /// @dev This method will likely have a high gas cost
    /// @param _target The target address for a heist
    /// @param _salt A random value to ensure secrecy of the target
    /// @return true If the heist is succeessful
    function _getHeistOutcome(address _target, string _salt) internal view returns (bool) {
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

        // TODO: Add a function to set these thresholds
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
            odds = odds.add(heist.conspirators.length);
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

    /// @notice Applied a single day of free insurance to an address 
    function getFreeInsurance() public {
        InsurancePolicy storage policy = insurancePolicies[msg.sender];

        require(policy.value == 0);

        // If the address has never bought insurance then _days are ignored and the first day is free.
        policy.expiry = now.add(1 days);

        // Set the price of the next policy
        policy.value = insuranceCost;

        emit Insured(msg.sender, policy.expiry, 1);
    }

    /// @notice Buys an insurance policy for an address
    /// @param _days The desired length of the insurance policy in days
    function buyInsurance(uint256 _days) public {
        require(!isInsured(msg.sender));
        require(_days >= 1 && _days <= maxPolicyLength);

        InsurancePolicy storage policy = insurancePolicies[msg.sender];

        require(policy.value > 0);

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