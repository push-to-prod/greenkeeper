const crypto = require('crypto')
const { extname } = require('path')

const _ = require('lodash')
const jsonInPlace = require('json-in-place')
const { promisify } = require('bluebird')
const semver = require('semver')
const badger = require('readme-badger')
const yaml = require('js-yaml')
const yamlInPlace = require('yml-in-place')
const escapeRegex = require('escape-string-regexp')

const RegClient = require('../../lib/npm-registry-client')
const env = require('../../lib/env')
const getRangedVersion = require('../../lib/get-ranged-version')
const dbs = require('../../lib/dbs')
const getConfig = require('../../lib/get-config')
const statsd = require('../../lib/statsd')
const { updateRepoDoc } = require('../../lib/repository-docs')
const githubQueue = require('../../lib/github-queue')
const { maybeUpdatePaymentsJob } = require('../../lib/payments')
const upsert = require('../../lib/upsert')

const registryUrl = env.NPM_REGISTRY

const bitbucket = require('../../lib/bitbucket')

const createBranch = require('../../lib/bitbucket/create-branch')

const fs = require('fs')
const tempy = require('tempy')

module.exports = async function ({ repositoryId }) {
  console.log('handling create branch!')

  const { installations, repositories } = await dbs()
  const repoDoc = await repositories.get(repositoryId)

  const accountId = repoDoc.accountId
  const installation = await installations.get(accountId)

  const installationId = installation.installation

  if (repoDoc.fork && !repoDoc.hasIssues) return

  //await updateRepoDoc(installationId, repoDoc)
  if (!_.get(repoDoc, ['packages', 'package.json'])) return
  //await upsert(repositories, repoDoc._id, repoDoc)

  const config = getConfig(repoDoc)
  if (config.disabled) return
  const pkg = _.get(repoDoc, ['packages', 'package.json'])
  if (!pkg) return

  const [projectName, repoName] = repoDoc.fullName.split('/')

  //await createDefaultLabel({ installationId, owner, repo, name: config.label })

  const registry = RegClient()
  const registryGet = promisify(registry.get.bind(registry))
  const dependencyMeta = _.flatten(
    ['dependencies', 'devDependencies', 'optionalDependencies'].map(type => {
      return _.map(pkg[type], (version, name) => ({ name, version, type }))
    })
  )
  let dependencies = await Promise.mapSeries(dependencyMeta, async dep => {
    try {
      dep.data = await registryGet(registryUrl + dep.name.replace('/', '%2F'), {
      })
      return dep
    } catch (err) {}
  })

  dependencies = _(dependencies)
    .filter(Boolean)
    .map(dependency => {
      let latest = _.get(dependency, 'data.dist-tags.latest')
      if (_.includes(config.ignore, dependency.name)) return
      // neither version nor range, so it's something weird (git url)
      // better not touch it
      if (!semver.validRange(dependency.version)) return
      // new version is prerelease
      const oldIsPrerelease = _.get(
        semver.parse(dependency.version),
        'prerelease.length'
      ) > 0
      const prereleaseDiff = oldIsPrerelease &&
        semver.diff(dependency.version, latest) === 'prerelease'
      if (
        !prereleaseDiff &&
        _.get(semver.parse(latest), 'prerelease.length', 0) > 0
      ) {
        const versions = _.keys(_.get(dependency, 'data.versions'))
        latest = _.reduce(versions, function (current, next) {
          const parsed = semver.parse(next)
          if (!parsed) return current
          if (_.get(parsed, 'prerelease.length', 0) > 0) return current
          if (semver.gtr(next, current)) return next
          return current
        })
      }
      // no to need change anything :)
      if (semver.satisfies(latest, dependency.version)) return
      // no downgrades
      if (semver.ltr(latest, dependency.version)) return
      dependency.newVersion = getRangedVersion(latest, dependency.version)
      return dependency
    })
    .filter(Boolean)
    .value()

  await createBranch({
    ownerId: accountId,
    newBranch: 'greenkeeper/initial',
    oldBranch: 'master',
    packageJson: pkg,
    message: 'Hi Mabry',
    repoName,
    projectName
  })

  // super hack, rip
  const tempFileLocation = tempy.file({ extension: 'json'})
  fs.writeFileSync(tempFileLocation, JSON.stringify(pkg, null, 2), 'utf8')

  const files = [
    {
      repoLocation: 'package.json',
      localLocation: tempFileLocation
    }
  ]

  await bitbucket.commit.create({
    projectName,
    slug: repoName,
    branch: 'greenkeeper/initial',
    files
  })
}
