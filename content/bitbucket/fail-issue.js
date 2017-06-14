const _ = require('lodash')
const md = require('../template')

const notDevDependency = ({dependency}) => md`
${dependency} is a direct dependency of this project **this is very likely breaking your project right now**. If other packages depend on you it’s very likely also breaking them.
I recommend you give this issue a very high priority. I’m sure you can resolve this :muscle:
`

const devDependency = ({dependency, dependencyType}) => md`
As ${dependency} is “only” a ${dependencyType.replace(/ies$/, 'y')} of this project it **might not break production or downstream projects**, but “only” your build or test tools – **preventing new deploys or publishes**.

I recommend you give this issue a high priority. I’m sure you can resolve this :muscle:
`

const ciStatuses = ({statuses}) => md`
<details>
<summary>Status Details</summary>

${statuses.map(status => `- ${status.state === 'success' ? '✅' : '❌'} **${status.context}** ${status.description} [Details](${status.target_url})`)}
</details>
`

module.exports = ({newVersion, oldVersion, dependency, diffLink}) => {
  let result = ''
  if (newVersion || oldVersion) {
    result += md`**${dependency}** just published version **${newVersion}** (was ${oldVersion})`
  }
  result += md`

After updating your dependency(ies) to their latest version(s), **the build failed**. '❌'

Check out the dependencies that were changed here: ${diffLink}

---

Not sure how things should work exactly?

There is a collection of [frequently asked questions](https://greenkeeper.io/faq.html) and of course you may always [ask my humans](https://github.com/greenkeeperio/greenkeeper/issues/new).

---


Your [Greenkeeper](https://greenkeeper.io) Bot :palm_tree:
`
  return result
}
