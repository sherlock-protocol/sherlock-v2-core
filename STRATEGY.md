# Tree Strategy

A modular way for our core capital pool (core) to deploy funds into multiple yield protocols.

![An example of a tree structure](https://cdn.programiz.com/sites/tutorial2program/files/nodes-edges_0.png)

Every node is it's own smart contract, the edges are bi-directional references. A node at the bottom only has one edge to the node above. `4` has a parent reference to `2`, `2` has a child reference to `4`.

The nodes at the bottom are the strategies, the smart contracts that interact with other protocols (e.g. Aave). Letters are used to indicate them in this document (e.g. `x`, `y`, `z`)

The other nodes (not at the bottom) always have 1 parent and 2 childs (3 edges). These contracts are called splitters and numbers are used to indicate them in this document (e.g. `1`, `2`, `3`). The purpose of these contracts is to define rules how to deposit into and withdraw from the nodes below them.

At the root of the tree there is the `MasterStrategy`, this unique node only has a single child. It's indicated by `m` in this document.

```
     m
     |
     1
     |
    / \
  2    x
 /\
y  z
```

Example of a tree strategy in this document

- A Strategy **MUST HAVE** zero childs
- A Strategy **SHOULD** hold funds
- A Strategy **MUST** return the current value it's holding using `balanceOf()`
- A Strategy **MUST** transfer tokens to core on withdraw
- A Splitter **MUST** have two childs
- A Splitter **SHOULD NOT** hold funds
- A Splitter **MUST** return the sum of the child `balanceOf()` values
- In the system the are `N` splitters, `N+1` strategies, `1` master and a total of `2N+2` nodes

## Implementation

The code in a single contract is basically split into two parts.

The first part takes care of the tree structure modularity, settings the references, allowing references to changes. This is all admin protected functionality.

The second part is the operational logic, how does the USDC flow into different strategies, how is the USDC pulled from these strategies.

## Current implementations

Withdraws are always right to left. Liquidation in order

We have 3 different deposit implementations

## Code risks

- Admin functions that are not admin protected
- `BalanceOf()` calls can revert

TODO

- Add actual code logic

TODO

- [ ] Write about the concept of the tree
- [ ] Describe how the `base` contracts are formatted (and cdouble check implementation)

## Tests

**BaseTreeStrategy.js** - Unit testing all base tree structure related code (`/strategy/base`)

**BaseTreeStrategyIntegration.js** - Integration testing of all the base tree structure related code (`/strategy/base`)

TODO

- [ ] Splitter tests `/strategy/splitters`
- [ ] e2e mainnet fork tests with 5 strategies

TODO

- [ ] Unit test both cache function on accessability. https://github.com/sherlock-protocol/sherlock-v2-core/pull/25/files
