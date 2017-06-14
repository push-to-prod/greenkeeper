const bitbucket = require('../../../lib/bitbucket')

module.exports = async function (data) {
  const { commit_status, repository } = data

  const { state } = data
  console.log(data)

  if (state === 'SUCCESSFUL' || state === 'INPROGRESS')) return

  const repo = repository.split('/')
  const owner = repo[0]
  const repo_name = repo[1]

  await bitbucket.issue.create(owner, repo, 'Greenkeeper: Build failed', '')
}
