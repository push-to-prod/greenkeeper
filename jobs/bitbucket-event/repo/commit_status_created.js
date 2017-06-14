const bitbucket = require('../../../lib/bitbucket')

module.exports = async function (data) {
  const { commit_status, repository } = data

  const state = commit_status.state
  console.log(data)

  if (state === 'INPROGRESS') return

  const owner = repository.owner.username
  const repo_name = repository.name

  if (state === 'SUCCESSFUL') {
    // scheduling create-initial-pr job
    return {
      data: {
        name: 'bitbucket-event',
        type: 'create-initial-pr',
        commit_status,
        repository
      }
    }
  } else {
    await bitbucket.issue.create(owner, repo_name, 'Greenkeeper: Build failed', '')
  }
}
