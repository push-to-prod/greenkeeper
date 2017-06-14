const _ = require('lodash')
const jsonInPlace = require('json-in-place')
const semver = require('semver')

const dbs = require('../../lib/dbs')
const getConfig = require('../../lib/get-config')
const getInfos = require('../../lib/get-infos')
const getRangedVersion = require('../../lib/get-ranged-version')
const createBranch = require('../../lib/bitbucket/create-branch')
const statsd = require('../../lib/statsd')
const env = require('../../lib/env')
const githubQueue = require('../../lib/github-queue')
const upsert = require('../../lib/upsert')
const { getActiveBilling } = require('../../lib/payments')

const prContent = require('../../content/update-pr')

const bitbucket = require('../../lib/bitbucket')
const fs = require('fs')

const tempy = require('tempy')
const trimNewlines = require('trim-newlines')

module.exports = async function (
  {
    dependency,
    accountId,
    repositoryId,
    type,
    distTag,
    distTags,
    oldVersion,
    oldVersionResolved,
    versions
  }
) {
  console.log('!!!!!!!!!!!!!!!!!!!!!! got here!!!!!!!!!')
  console.log('dependency', dependency)
  // TODO: correctly handle beta versions, and hotfixes
  if (distTag !== 'latest') return
  // do not upgrade invalid versions
  if (!semver.validRange(oldVersion)) return

  const version = distTags[distTag]
  const { installations, repositories } = await dbs()
  const installation = await installations.get(accountId)
  const repository = await repositories.get(repositoryId)

  const satisfies = semver.satisfies(version, oldVersion)
    /*
  const lockFiles = ['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock']
  //const hasLockFile = _.some(_.pick(repository.files, lockFiles))
  if (satisfies) return
  */

  //const billing = await getActiveBilling(accountId)

  //if (repository.private && !billing) return

  const [projectName, repoName] = repository.fullName.split('/')
  const config = getConfig(repository)
  if (_.includes(config.ignore, dependency)) return
  const installationId = installation.installation

  const newBranch = `${config.branchPrefix}${dependency}-${version}`

  const openPR = _.get(
    await repositories.query('pr_open_by_dependency', {
      key: [repositoryId, dependency],
      include_docs: true
    }),
    'rows[0].doc'
  )

  const commitMessageScope = !satisfies && type === 'dependencies'
    ? 'fix'
    : 'chore'
  let commitMessage = `${commitMessageScope}(package): update ${dependency} to version ${version}`

  if (!satisfies && openPR) {
    await upsert(repositories, openPR._id, {
      comments: [...(openPR.comments || []), version]
    })

    commitMessage += `\n\nCloses #${openPR.number}`
  }

  try {
    await createBranch({
      ownerId: accountId,
      newBranch,
      oldBranch: 'master',
      repoName,
      projectName,
      message: commitMessage
    })

    const versions = _.keys(_.get(dependency, 'data.versions'))
    const latest = _.reduce(versions, function (current, next) {
      const parsed = semver.parse(next)
      if (!parsed) return current
      if (_.get(parsed, 'prerelease.length', 0) > 0) return current
      if (semver.gtr(next, current)) return next
      return current
    })

    const rawPackage = await bitbucket.file.get(
      projectName, repoName, 'master', 'package.json')

    const parsedPackage = JSON.parse(rawPackage)

    console.log('old parsed package', parsedPackage)

    for (const type of [ 'dependencies', 'devDependencies', 'optionalDependencies' ]) {
      if (parsedPackage[type] && parsedPackage[type][dependency]) {
        parsedPackage[type][dependency] = version
        break;
      }
    }

    console.log('newParsed package', parsedPackage)

    const tempDir = tempy.directory()
    const tempFile = `${tempDir}/package.json`

    // super hack, rip
    //const tempFileLocation = tempy.file({ extension: 'json'})
    fs.writeFileSync(tempFile, JSON.stringify(parsedPackage, null, 2), 'utf8')

    const files = [
      {
        repoLocation: 'package.json',
        localLocation: tempFile
      }
    ]

    const sha = await bitbucket.commit.create({
      tempDir,
      file: tempFile,
      projectName,
      slug: repoName,
      branch: newBranch,
      message: commitMessage,
      files
    })

    console.log('inserting at', `${repository.fullName}:branch:${sha}`)

    // insert repo id
    await upsert(repositories, `${repository.fullName}:branch:${trimNewlines(sha)}`, {
      type: 'branch',
      sha,
      base: 'master',
      branch: newBranch,
      accountId,
      isVersionBranch: true,
      processed: !satisfies
    })
  } catch (err) {
    // no branch created
    console.error(err)
  }
}
