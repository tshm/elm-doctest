// @ts-check
const { log, dump, DEBUG, RETVAL } = require('./util')
const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

/**
 * setup elm runtime
 * @param {string} elm
 * @param {boolean} watch
 */
function makeElmRuntime(elm, watch) {
  /** extract source folder from elm.json */
  const cwd = (() => {
    try {
      const data = fs.readFileSync('elm.json')
      return JSON.parse(data.toString())['source-directories'][0]
    } catch (e) {
      return './'
    }
  })()

  /**
   * run elm make to make sure test code compiles
   * @param {string} elm
   * @param {string} testfilename
   * @param {string} elmfile
   */
  function checkElmMake(elm, testfilename, elmfile) {
    dump(`checkElmMake(${elm}, ${testfilename}, ${elmfile}) called`)
    const { stdout, status, stderr } = spawnSync(
      elm,
      ['make', testfilename, '--output=/dev/null'],
      { encoding: 'utf8' }
    )
    if (status !== 0) {
      log(`status: ${status}`)
      log(`stdout: ${stdout}`)
      if (stderr) log(stderr.replace(testfilename, elmfile))
      log(`elm make failed. aborting`)
      return status
    }
    return status
  }

  // load main Elm script
  // @ts-ignore
  const app = require('./elm').Elm.Main.init()

  /** read elm source file and send it back to runtime
   */
  app.ports.readfile.subscribe((elmfile) => {
    try {
      const elmsrc = fs.readFileSync(elmfile, 'utf8')
      log(`\n processing: ${elmfile}`)
      app.ports.srccode.send({ code: elmsrc, filename: elmfile })
    } catch (e) {
      log(`failed to run tests: ${e}`)
      process.exit(RETVAL.EXCEPTION)
    }
  })

  /** receive evaluate message from Elm and elm make and evaluate
   * test cases, then send it back to Elm.
   */
  app.ports.evaluate.subscribe(({ src, runner, filename, modulename }) => {
    dump('----------- evaluate called.')
    dump([src, runner, filename])
    if (src.length === 0) return
    const tempModulePath = path.resolve(cwd, `${modulename}.elm`)
    fs.writeFileSync(tempModulePath, src)
    try {
      if (checkElmMake(elm, tempModulePath, filename) !== 0) {
        throw new Error('elm make exited with error')
      }
      const { stdout, stderr, status } = spawnSync(
        elm,
        ['repl', '--no-colors'],
        {
          input: runner,
          encoding: 'utf8',
        }
      )
      if (DEBUG) fs.writeFileSync('runner.elm', runner)
      dump(`stdout: ${stdout}`)
      if (status !== 0 || stderr) {
        if (stderr) log(stderr)
        throw new Error(`elm repl failed with some error.`)
      } else {
        const match = stdout.match(/^> (.+)/gm)
        if (!match) throw new Error('elm repl did not produce output')
        dump(`match: ${match[0]}`)
        const resultStr = match[0].replace(/[^"]*(".+").*/, '$1')
        dump(resultStr)
        app.ports.result.send({
          stdout: JSON.parse(resultStr),
          filename: filename,
          failed: false,
        })
      }
    } catch (e) {
      app.ports.result.send({
        stdout: e.message,
        filename: filename,
        failed: true,
      })
    } finally {
      if (!DEBUG && fs.existsSync(tempModulePath)) fs.unlinkSync(tempModulePath)
    }
  })

  /** Receive report message from Elm and
   * display results
   */
  app.ports.report.subscribe((report) => {
    log(report.text)
    app.ports.next.send(watch)
  })

  /** exit the process with failure */
  app.ports.exit.subscribe(() => {
    process.exit(RETVAL.FAIL)
  })

  return {
    addfiles: function (/** @type {string[]} */ o) {
      app.ports.addfiles.send(o)
    },
    runnext: function (/** @type {boolean} */ o) {
      app.ports.next.send(o)
    },
  }
}

module.exports = { makeElmRuntime }
