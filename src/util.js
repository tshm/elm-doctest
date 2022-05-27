function log(o) {
  console.log(o)
}

const DEBUG = require('process').env.DEBUG || false
const dump = (() => {
  if (DEBUG) {
    log('############## debug mode is ON ##############')
    return function (o) {
      console.warn(o)
    }
  } else {
    return function (_o) {}
  }
})()

const RETVAL = {
  SUCCESS: 0,
  FAIL: 1,
  EXCEPTION: 2,
}

module.exports = {
  log: log,
  dump: dump,
  DEBUG: DEBUG,
  RETVAL: RETVAL,
}
