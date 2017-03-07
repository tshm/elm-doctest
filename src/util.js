function log (o) { console.log(o) }

const dump = (() => {
  if (require('process').env.DEBUG) {
    log('############## debug mode is ON ##############')
    return function (o) { console.debug(o) }
  } else {
    return function (o) {}
  }
})()

const RETVAL = {
  SUCCESS: 0,
  FAIL: 1,
  EXCEPTION: 2
}

module.exports = {
  log: log,
  dump: dump,
  RETVAL: RETVAL
}
