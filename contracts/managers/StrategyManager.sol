// keep array of strategies (MAX 2)
// strategyX
// strategyY
// the weights are 50/50 by default
// you can have 3 strategies by making y a copy of this
// you can have 4 strategies by making x a copy of this
// you can have 5 strategies by having another layer of copies
// like tree structure where end nodes are actual strategies

// on deposit (50/50 weights)
// if x.balance < y.balance
//  x.deposit()
// else
//  y.deposit()

// on withdraw (50/50 weights)
// first, other = x.balance > y.balance ? (x, y) : (y, x)
// if(first.balance > amount) {
//    first.send(amount);
//    return
// }
// first.send(first.balance)
// other.send(amount - first.balance)

// weights are immutable
// kill() can be called on a contract (node in the tree)
// this kill signal will move down the tree and all the funds will be withdrawn
// the parent is either core or another node
// in case it's another node, it's not useful anymore, and th
// on kill() all funds are withdrawn and send to parent node

// When a node is killed it's parent will do seppuki and his other child will take it's place.
// funds are being move to the other child


// why? as it's hard to keep the weights on deposit + withdraw



// sepuku works like this
// kill() is called by admin
// signal is given to parent (parent checks if child is sender)
// parent(alice) messages his parent(bob) that the other child (alice child 2) is now the child of bob instead of alice herself.

// if parent == core, can't kill. BUT core can withdraw all funds and update.