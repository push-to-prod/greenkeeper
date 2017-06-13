const crypto = require('crypto')
const dbs = require('../../../lib/dbs')
const statsd = require('../../../lib/statsd')
const _ = require('lodash')
const upsert = require('../../../lib/upsert')

const { createDocs } = require('../../..//lib/repository-docs')

module.exports = async function (data) {
  if (!data) {
    return
  }

  const { installations, repositories: reposDb } = await dbs()

  statsd.increment('repositories', 1)

  // create repository document
  const repoDocs = await createDocs({
    repositories: [
      {
        id: data.uuid,
        full_name: data.full_name,
        fork: false,
        hasIssues: false
      }
    ],
    accountId: String(data.repository.owner.uuid)
  })

  // hack: also create an "installation"
  await upsert(
    installations,
    docId,
    Object.assign({
      installation: data.repository.owner.uuid,
      login: 'someorg', // todo: Remove
      type: 'User'
    })
  )

  // saving installation repos to db
  await reposDb.bulkDocs(repoDocs)

  // scheduling create-initial-branch jobs
  return _(repoDocs)
    .map(repoDoc => ({
      data: {
        name: 'create-initial-branch',
        repositoryId: repoDoc._id,
        accountId: repoDoc.accountId
      }
    }))
    .value()
}
