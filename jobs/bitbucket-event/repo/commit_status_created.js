const bitbucket = require('../../../lib/bitbucket')
const dbs = require('../../../lib/dbs')
const issueDescription = require('../../../content/bitbucket/fail-issue')

const handled = {}

module.exports = async function (data) {
  const { repositories } = await dbs()
  const { commit_status, repository } = data

  const state = commit_status.state
  console.log(data)

  if (state === 'INPROGRESS') return

  const owner = repository.owner.username
  const repo_name = repository.name

  const { hash } = JSON.parse(await bitbucket.request.get(commit_status.links.commit.href))
  console.log('hash', hash)
  const id = `${owner}/${repo_name}:branch:${hash}`
  if (handled[id]) return
  handled[id] = true

  console.log('getting repo by id', id)
  const repoDoc = await repositories.get(id)

  console.log(repoDoc)

  if (!repoDoc) {
    console.error('NO REPODOC')
    return
  }

  if (state === 'SUCCESSFUL') {
    if (repoDoc.isVersionBranch) {
      // scheduling create-initial-pr job
      await bitbucket.pullrequest.create(
        owner, repo_name, 'master', repoDoc.branch, 'The hobbits are going to isengard!'
      )
    } else {
      await bitbucket.pullrequest.create(
        owner, repo_name, 'master', repoDoc.branch, 'initial pr'
      )
    }
  } else {
    console.log('ISSUE FAILED')
    const diffLink = `https://bitbucket.org/${owner}/${repo_name}/branch/${repoDoc.branch}#diff`
    await bitbucket.issue.create(owner, repo_name, 'Greenkeeper: Latest dependency change broke your build 🚨', issueDescription({diffLink}))
  }
}
