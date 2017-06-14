const commit_status = require('./commit_status_created')

module.exports = async function(data) {
    return commit_status(data)
}
