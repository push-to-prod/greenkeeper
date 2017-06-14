const build_status = require('./build_status_created')

module.exports = async function(data) {
    return build_status(data)
}
