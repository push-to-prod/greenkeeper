const build_status = require('./build_status_created')

module.exports = async function(data) {
    return function () {
              build_status(data)
           }
}
