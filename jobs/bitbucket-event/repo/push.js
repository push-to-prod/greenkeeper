const minDate = new Date(-1000)

module.exports = async function (data) {
  const { repositories } = await dbs()
  const { push, repository } = data

  const { changes } = push

  // get newest change from set of changes
  let latestDate = minDate
  let latestChange
  for (const change of changes) {
    let currentChange = change.new
    let currentDate = new Date(new.target.date)
    if (currentDate > latestDate) {
      latestDate = currentDate
      latestChange = currentChange
    }
  }

  if (!latestChange) {
    console.log('wooooooah')
    return
  }

  const after = latestChange.hash
}
