const url = require('url')

const _ = require('lodash')
const Bitbucket = require('../utils')

//const githubHost = {}
//
//if (process.env.GITHUB_HOST) {
//  try {
//    const parsed = url.parse(process.env.GITHUB_HOST)
//    githubHost.protocol = parsed.protocol.replace(':', '')
//    githubHost.host = parsed.host
//    if (parsed.pathname !== '/') githubHost.pathPrefix = parsed.pathname
//  } catch (e) {
//    console.log('error parsing GITHUB_HOST', e)
//  }
//}
//
//module.exports = options => new Github(
//  _.defaultsDeep(options || {}, githubHost, {
//    Promise: require('bluebird'),
//    headers: {
//      'User-Agent': 'Greenkeeper'
//    }
//  })
//)

username = process.env.BITBUCKET_USER
password = process.env.BITBUCKET_PASSWORD


module.export = function () {
    Bitbucket.setAuth(username, password)
    return Bitbucket
}
