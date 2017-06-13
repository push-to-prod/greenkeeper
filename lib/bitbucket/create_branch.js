const bitbucket = require('../bitbucket')
const bitbucketQueue = require('../bitbucket-queue)

global.Promise = require('bluebird')

module.exports = async (
    {
        ownerId,
        newBranch,
        oldBranch,
        repoName,
        message,
        packageJson,
        projectName
    }
) => {
    const bbqueue = bitbucketQueue(ownerId)

    await bbqueue.write(bitbucket => bitbucket.branch.create(projectName, repoName,
                                                             oldBranch, newBranch))
}
