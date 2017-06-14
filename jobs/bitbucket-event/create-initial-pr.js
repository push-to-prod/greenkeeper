const bitbucket = require('../../lib/bitbucket')
const prDescription = require('../../content/bitbucket/initial-pr')

module.exports = async function ({ commit_status, repository }) {
  console.log('handling create initial pr')
  const [owner, repo] = repository.full_name.split('/')

  // Would be better to look up, but should always be the same for initial pr
  const initialGkBranchName = 'greenkeeper/initial'
  const initialGkDescription = prDescription({ ghRepo: repo, newBranch: initialGkBranchName })

  await bitbucket.pullrequest.create(
    owner,
    repo,
    'master',
    initialGkBranchName,
    'Greenkeeper: Latest dependencies have been updated and tests pass! 🌴',
    initialGkDescription
  )
}
