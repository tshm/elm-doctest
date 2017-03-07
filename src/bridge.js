const { log, dump, RETVAL } = require('./util')
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

/** setup elm runtime
 */
function makeElmRuntime (elmMake, elmRepl, watch) {
  /** extract source folder from elm-package.json */
  const cwd = (() => {
    try {
      const data = fs.readFileSync('elm-package.json')
      return JSON.parse(data)['source-directories'][0]
    } catch (e) {
      return './'
    }
  })()
  const TESTFILENAME = path.resolve(cwd, './DoctestTempModule__.elm')

  /** run elm-make to make sure test code compiles
   */
  function checkElmMake (elmMake, testfilename, elmfile) {
    const { stdout, status, stderr } =
      spawnSync(elmMake, [testfilename, '--output=.tmp.js'], {encoding: 'utf8'})
    if (status !== 0) {
      log(stdout)
      log(stderr.replace(testfilename, elmfile))
      log(`elm-make failed. aborting`)
      return status
    }
    return status
  }

  // load main Elm script
  const app = require('./elm').Main.worker()

  /** read elm source file and send it back to runtime
   */
  app.ports.readfile.subscribe(elmfile => {
    try {
      const elmsrc = fs.readFileSync(elmfile, 'utf8')
      log(`\n processing: ${elmfile}`)
      app.ports.srccode.send({code: elmsrc, filename: elmfile})
    } catch (e) {
      log(`failed to run tests: ${e}`)
      process.exit(RETVAL.EXCEPTION)
    }
  })

  /** receive evaluate message from Elm and elm-make and evaluate
   * test cases, then send it back to Elm.
   */
  app.ports.evaluate.subscribe(({src, runner, filename}) => {
    dump('----------- evaluate called.')
    dump([src, runner, filename])
    if (src.length === 0) return
    fs.writeFileSync(TESTFILENAME, src)
    try {
      if (checkElmMake(elmMake, TESTFILENAME, filename) !== 0) {
        throw new Error('elm-make exited with error')
      }
      const {stdout, status, error} = spawnSync(elmRepl, [], {input: runner, encoding: 'utf8'})
      if (error) log(`elm-repl failed to run:\n ${error}`)
      dump(stdout)
      if (status !== 0) {
        throw new Error(`elm-repl exited with ${status}`)
      } else {
        const match = stdout.match(/^> (.+)/gm)
        if (!match) throw new Error('elm-repl did not produce output')
        const resultStr = match[0].replace(/[^"]*(".+").*/, '$1')
        dump(resultStr)
        app.ports.result.send({ stdout: JSON.parse(resultStr), filename: filename, failed: false })
      }
    } catch (e) {
      log(`evaluation failed: ${e.message}`)
      app.ports.result.send({ stdout: e.message, filename: filename, failed: true })
    } finally {
      if (fs.existsSync(TESTFILENAME)) fs.unlinkSync(TESTFILENAME)
    }
  })

  /** Receive report message from Elm and
   * display results
   */
  app.ports.report.subscribe(report => {
    log(report.text)
    app.ports.next.send(watch)
  })

  /** exit the process with failure */
  app.ports.exit.subscribe(() => {
    process.exit(RETVAL.FAIL)
  })

  return {
    addfiles: function (o) { app.ports.addfiles.send(o) },
    runnext: function (o) { app.ports.next.send(o) }
  }
}

module.exports = {
  makeElmRuntime: makeElmRuntime
}
