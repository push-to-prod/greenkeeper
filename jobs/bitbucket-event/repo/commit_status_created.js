const bitbucket = require('../../../lib/bitbucket')
const dbs = require('../../../lib/dbs')
const issueDescription = require('../../../content/bitbucket/fail-issue')
const updatePrDescription = require('../../../content/bitbucket/update-pr')

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

  const {branch, dependency, oldVersion, newVersion} = repoDoc

  if (state === 'SUCCESSFUL') {
    if (repoDoc.isVersionBranch) {
      const description = updatePrDescription({newVersion, oldVersion, dependency})
      await bitbucket.pullrequest.create(
        owner, repo_name, 'master', branch, `Greenkeeper: Version ${newVersion} of ${dependency} has been published! 🌴`, description
      )
    } else {
      // scheduling create-initial-pr job
      return {
        data: {
          name: 'bitbucket-event',
          type: 'create-initial-pr',
          commit_status,
          repository
        }
      }
    }
  } else {
    console.log('ISSUE FAILED')
    const diffLink = `https://bitbucket.org/${owner}/${repo_name}/branch/${branch}#diff`
    const description = issueDescription({diffLink, newVersion, oldVersion, dependency})
    if (repoDoc.isVersionBranch) {
      await bitbucket.issue.create(owner, repo_name, 'Greenkeeper: Latest dependency change broke your build 🚨', description)
    } else {
      await bitbucket.issue.create(owner, repo_name, 'Greenkeeper: Initial dependency update broke your build 🚨', description)
    }

  }
}
