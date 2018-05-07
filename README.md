# Free Money

ERC20 token with taxing, stealing, and other quirks.

## Minting

Anyone can mint any number of tokens, if they pay a donation in the form of ETH. There is no minimum donation amount.

## Taxation

The contract owner can tax a portion of every token holders balance. The portion is a percentage between **1-10%**. There is no protection against taxation.

## Heists

Heists are a way of increasing your tokens. Any address may instigate a heist by hashing  the target address with a salt using the *hashTarget* method. Calling the *planHeist* method with the target hash will start a **24 hour** timer to give other addresses the chance to join the heist as conspirators. Addresses may also purchase insurance to protect against loss.

After the **24 hours** are over, the instigator has **12 hours** to initiate the heist and rob the account. The heist will either succeed or fail. If the heist succeeds, then a portion of the targets tokens are transferred to the owner, instigator, and a small fund for the conspirators to claim. Unclaimed tokens are burnt after **12 hours**.

The odds of a heist succeeding are determined using a pseudo-random number generator. The result is compared to an odds variable determined by a number of factors. The odds can be increased by paying a bribe to the owner in ETH when calling the *planHeist* method, or by having conspirators. Conspirators may also bribe the owner.

Following through and initiating a heist could become unfeasible with too many conspirators. Since the target address is hidden, all token holders are incentivized to join heists.

## Insurance

Insurance protects against loss from heists. An insurance fund is maintained by offering token holders the option to purchase insurance for **1-7** days. If an address has never purchased insurance, then they will receive 1 day free.

When a token holder with insurance is robbed, they are penalized by having the cost insurance increases.

## Future Expansions

* Change the minting process:
  * Automated hourly drops of tokens
  * A random number of tokens can be claimed
  * Unclaimed tokens are burned
* Tax thresholds:
  * Tax the largest 5% of token holders