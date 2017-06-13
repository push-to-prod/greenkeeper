const dbs = require('../../lib/dbs')
const bitbucket = require('../../lib/bitbucket')

module.exports = async function ({ repositoryId, fromBranchName }) {
  console.log('handling create initial pr')

  const { installations, repositories } = await dbs()

  const repodoc = await repositories.get(repositoryId)
  const accountId = repodoc.accountId
  const installation = await installations.get(accountId)
  const installationId = installation.installation

  const [owner, repo] = repodoc.fullName.split('/')

  await bitbucket.pullrequest.create(
    owner, repo, 'master', fromBranchName, 'The hobbits are going to isengard!'
  )
}
