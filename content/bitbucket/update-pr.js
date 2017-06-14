const _ = require('lodash')
const md = require('../template')

module.exports = ({newVersion, dependency, oldVersion}) => md`
## Version **${newVersion}** of **\`${dependency}\`** just got published and all tests are passing!

I recommend you look into these changes and try to get onto the latest version of ${dependency}.
Given that you have a decent test suite, a passing build is a strong indicator that you can take advantage of these changes by merging the proposed change into your project. Otherwise this branch is a great starting point for you to work on the update.


---

Not sure how things should work exactly?

There is a collection of [frequently asked questions](https://greenkeeper.io/faq.html) and of course you may always [ask my humans](https://github.com/greenkeeperio/greenkeeper/issues/new).

---

Your [Greenkeeper](https://greenkeeper.io) Bot :palm_tree:

`
