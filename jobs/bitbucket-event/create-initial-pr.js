const bitbucket = require('../../lib/bitbucket')

module.exports = async function ({ commit_status, repository }) {
  console.log('handling create initial pr')
  const [owner, repo] = repository.full_name.split('/')

  // Would be better to look up, but should always be the same for initial pr
  const initialGkBranchName = 'greenkeeper/initial'

  await bitbucket.pullrequest.create(
    owner, repo, 'master', initialGkBranchName, 'The hobbits are going to isengard!'
  )
}
