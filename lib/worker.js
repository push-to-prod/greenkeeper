const { resolve } = require('path')

const _ = require('lodash')
const Promise = require('bluebird')

const env = require('./env')
const rollbar = require('./rollbar')
const statsd = require('./statsd')

const dev = env.NODE_ENV === 'development'
if (dev) {
  rollbar.error = (err, data) => {
    if (err) console.error(err)
    if (data) console.log(data)
  }
}

module.exports = async function worker (scheduleJob, channel, job) {
  const data = JSON.parse(job.content.toString())
  if (dev) console.log(data.name, data.type, data.action)

  const errorPayload = {
    level: _.get(job, 'fields.redelivered') ? 'warning' : 'error',
    context: _.compact([
      data.name,
      data.type,
      data.action,
      _.get(job, 'fields.redelivered') && 'retried'
    ])
      .join('.'),
    custom: data
  }

  const rollbarRequest = {
    user_id: Number(data.accountId) ||
      _.get(data, 'repository.owner.id') ||
      _.get(data, 'installation.account.id') ||
      _.get(data, 'organization.id') ||
      _.get(data, 'repository.owner.uuid') // bitbucket
  }

  try {
    var jobWorker = require(resolve(__dirname, '../jobs', data.name))
    statsd.increment(
      _.compact([
        `job.${data.name}`,
        data.type && `job.${data.name}.${data.type}`,
        data.type &&
          data.action &&
          `job.${data.name}.${data.type}.${data.action}`
      ])
    )
  } catch (err) {
    errorPayload.level = 'debug'
    rollbar.error(err, errorPayload, rollbarRequest)

    // job not implemented, reported so throwing away
    return channel.nack(job, false, false)
  }

  try {
    var newJobs = await jobWorker(data)
  } catch (err) {
    if (err.message.toLowerCase().includes('bad credentials')) {
      errorPayload.level = 'warning'
      statsd.increment('job_errors_github_auth')
      // retry job because of flaky GitHub auth layer
      channel.nack(job)
    } else if (/not implemented/.test(err.message)) {
      errorPayload.level = 'debug'
      // job action not implemented, reported so throwing away
      channel.nack(job, false, false)
    } else if (job.fields.redelivered) {
      // repeated error, reported so throwing away
      channel.nack(job, false, false)
    } else {
      if (dev) console.log(err, data)
      statsd.increment('job_errors')
      // an error occured, try it once more
      channel.nack(job)
    }

    return rollbar.error(
      err,
      errorPayload,
      rollbarRequest
    )
  }

  statsd.increment(
    _.compact([
      `job.${data.name}.success`,
      data.type && `job.${data.name}.${data.type}.success`,
      data.type &&
        data.action &&
        `job.${data.name}.${data.type}.${data.action}.success`
    ])
  )

  if (!_.isArray(newJobs)) newJobs = [newJobs]
  newJobs = _.compact(newJobs)

  // all done, no more work
  if (!newJobs.length) return channel.ack(job)

  try {
    await Promise.mapSeries(newJobs, (
      {
        data,
        plan,
        delay
      }
    ) => {
      if (!data) return
      const priority = plan === 'free' ? 1 : plan === 'supporter' ? 2 : 3

      console.log('scheduling job', data, plan)
      return scheduleJob(
        Buffer.from(JSON.stringify(data)),
        _.pickBy({
          priority,

          headers: delay && {
            'x-delay': delay
          }
        })
      )
    })
  } catch (err) {
    errorPayload.level = 'critical'
    rollbar.error(err, errorPayload, rollbarRequest)
    statsd.increment('job_scheduling_errors')

    if (job.fields.redelivered) {
      // repeated error, reported so throwing away
      return channel.nack(job, false, false)
    }

    // reschedule job because resulting jobs could not be scheduled
    return channel.nack(job)
  }

  // all done
  channel.ack(job)
}
