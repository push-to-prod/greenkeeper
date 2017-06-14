const crypto = require('crypto')
const dbs = require('../../../lib/dbs')
const statsd = require('../../../lib/statsd')
const _ = require('lodash')
const upsert = require('../../../lib/upsert')

const { createDocs } = require('../../../lib/repository-docs')

const bitbucket = require('../../../lib/bitbucket')

module.exports = async function (data) {
  if (!data) {
    return
  }

  const { installations, repositories: reposDb } = await dbs()

  statsd.increment('repositories', 1)

  const rawPackage = await bitbucket.file.get(
    data.projectName, data.repoName, 'master', 'package.json')

  const parsedPackage = JSON.parse(rawPackage)

  // create repository document
  const repoDocs = await createDocs({
    repositories: [
      Object.assign(
        {
          id: data.uuid,
          full_name: `${data.projectName}/${data.repoName}`,
          source: 'bitbucket',
          fork: false,
          hasIssues: false,
          enabled: true, // for now, treat as enabled
          packages: {
            'package.json': parsedPackage
          }
        },
        data
      )
    ],
    accountId: String(data.repository.owner.uuid)
  })

  console.log(repoDocs)
  console.log(parsedPackage)

  // hack: also create an "installation"
  await upsert(
    installations,
    data.repository.owner.uuid,
    {
      installation: data.repository.owner.uuid,
      login: 'someorg', // todo: Remove
      type: 'User'
    }
  )

  // saving installation repos to db
  await reposDb.bulkDocs(repoDocs)

  // scheduling create-initial-branch jobs
  return _(repoDocs)
    .map(repoDoc => ({
      data: {
        name: 'bitbucket-event',
        type: 'create-initial-branch',
        repositoryId: repoDoc._id,
        accountId: repoDoc.accountId
      }
    }))
    .value()
}
