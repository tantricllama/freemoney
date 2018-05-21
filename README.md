# Free Money

ERC20 token with stealing. Created as a learning exercise.

## Minting

Anyone can mint any number of tokens, if they pay a donation in the form of ETH. There is no minimum donation amount.

## Heists

Heists are a way of increasing your tokens. A heist is instigated by using the *hashTarget* function and passing the result to the *newHeist* function. This will start a **24 hour** timer to give **up to 10** others the chance to join the heist using the *joinHeist* function.

After the **24 hours** are over, the instigator has **12 hours** to rob the target account. The heist will either succeed or fail. If the heist succeeds, then a portion (between 10% and 40%) of the targets tokens are transferred to the instigator, and a smaller fund for the conspirators to claim.

The odds of a heist succeeding are determined using a pseudo-random number generator. The result is compared to an odds variable determined by a number of factors. The odds can be increased by paying a bribe to the owner in ETH when calling the *newHeist* function, or by having conspirators. Conspirators may also bribe the owner.

## Insurance

Insurance protects against loss from heists. An insurance fund is maintained by offering token holders the option to purchase insurance for **1-7** days. If an address has never purchased insurance, then they will receive 1 day free.

When a token holder with insurance is robbed, they are penalized by having the cost insurance increases.

## Future Expansions

* Charge tokens to start/join heists
* Lower bribe amounts
* Change the minting process:
  * Automated hourly drops of tokens
  * A random number of tokens can be claimed
  * Unclaimed tokens are burned