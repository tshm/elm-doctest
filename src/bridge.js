'use strict'
const path = require('path')
const fs = require('fs')
const proc = require('process')
const spawn = require('child_process').spawnSync

/** debug mode can be controlled from env variable */
const DEBUG = proc.env.DEBUG || false

/** exit codes */
const RETVAL = {
  SUCCESS: 0,
  FAIL: 1,
  EXCEPTION: 2
}

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

function log (o) { console.log(o) }
if (DEBUG) log('############## debug mode is ON ##############')

/** run elm-make to make sure test code compiles
 */
function checkElmMake (elmMake, testfilename, elmfile) {
  const { stdout, status, stderr } =
    spawn(elmMake, [testfilename, '--output=.tmp.js'], {encoding: 'utf8'})
  if (status !== 0) {
    log(stdout)
    log(stderr.replace(testfilename, elmfile))
    log(`elm-make failed. aborting`)
    return status
  }
  return status
}

/** setup elm runtime
 */
function makeElmRuntime (elmMake, elmRepl, watch) {
  // load main Elm script
  const app = require('./elm').Main.worker()

  /** read elm source file and send it back to runtime
   */
  app.ports.readfile.subscribe((elmfile) => {
    try {
      const elmsrc = fs.readFileSync(elmfile, 'utf8')
      // for some reason, Elm port does not work without delay.
      setTimeout(() => {
        log(`\n processing: ${elmfile}`)
        app.ports.srccode.send({code: elmsrc, filename: elmfile})
      }, 1)
    } catch (e) {
      log(`failed to run tests: ${e}`)
      process.exit(RETVAL.EXCEPTION)
    }
  })

  /** receive evaluate message from Elm and elm-make and evaluate
   * test cases, then send it back to Elm.
   */
  app.ports.evaluate.subscribe(({src, runner, filename}) => {
    if (DEBUG) {
      log('----------- evaluate called.')
      log([src, runner, filename])
    }
    if (src.length === 0) return
    // log('writing temporary source into file...')
    fs.writeFileSync(TESTFILENAME, src)
    try {
      if (checkElmMake(elmMake, TESTFILENAME, filename) !== 0) {
        throw new Error('elm-make exited with error')
      }
      const {stdout, status, error} = spawn(elmRepl, [], {input: runner, encoding: 'utf8'})
      if (error) log(`elm-repl failed to run:\n ${error}`)
      if (DEBUG) log(stdout)
      if (status !== 0) {
        throw new Error(`elm-repl exited with ${status}`)
      } else {
        const match = stdout.match(/^> (.+)/gm)
        if (!match) throw new Error('elm-repl did not produce output')
        const resultStr = match[0].replace(/[^"]*(".+").*/, '$1')
        if (DEBUG) log(resultStr)
        app.ports.result.send({ stdout: JSON.parse(resultStr), filename: filename, failed: false })
      }
    } catch (e) {
      log(`evaluation failed: ${e.message}`)
      app.ports.result.send({ stdout: e.message, filename: filename, failed: true })
    } finally {
      if (!DEBUG && fs.existsSync(TESTFILENAME)) fs.unlinkSync(TESTFILENAME)
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

  return app
}

/** parse commandline options
 */
function parseOpt (argv) {
  const optSpec = {
    boolean: ['help', 'version', 'watch'],
    string: ['elm-repl-path', 'pretest'],
    alias: {h: 'help', v: 'version', w: 'watch'}
  }
  const opts = require('minimist')(argv, optSpec)
  if (DEBUG) console.log('options:', opts)

  // show usage/help message
  if (opts.version || opts.help || !opts._) {
    (function showHelpMessage () {
      const version = require('../package.json').version
      log(`elm-doctest ${version}`)
      log('')
      log('Usage: elm-doctest [--help] [--watch] [--elm-repl-path PATH]')
      log('                   [--elm-make-path PATH]')
      log('                   [--pretest CMD] FILES...')
      log('  run doctest against given Elm files')
      log('')
      log('Available options:')
      log('  -h,--help\t\t' +
        'Show this help text')
      log('  -w,--watch\t\t' +
        'Watch and run tests when target files get updated')
      log('  --elm-repl-path PATH\t' +
        'Path to elm-repl executable')
      log('  --elm-make-path PATH\t' +
        'Path to elm-make executable')
      log('  --pretest CMD\t\t' +
        'command to run before doc-test')
    })()
    process.exit(RETVAL.SUCCESS)
  }

  return {
    elmMake: opts['elm-make-path'] || 'elm-make',
    elmRepl: opts['elm-repl-path'] || 'elm-repl',
    fileQueue: opts._,
    pretest: opts.pretest ? opts.pretest.split(' ') : [],
    watch: opts.watch
  }
}

/** run pretest */
function runPretest (pretest) {
  if (pretest.length === 0) return true
  const cmd = pretest[0]
  const args = pretest.slice(1)
  const { stdout, stderr, status } = spawn(cmd, args, {encoding: 'utf8'})
  if (stdout) log(`pretest: ${stdout}`)
  if (stderr) log(`pretest err: ${stderr}`)
  log(`pretest status: ${status}`)
  return status === 0
}

/** main */
(function main () {
  const {elmMake, elmRepl, fileQueue, pretest, watch} = parseOpt(proc.argv.slice(2))
  log('Starting elm-doctest ...')

  if (!runPretest(pretest)) {
    log('exiting as preset failed')
    process.exit(1)
  }

  const app = makeElmRuntime(elmMake, elmRepl, watch)

  // persist/watch files if `--watch` option was given
  if (watch) {
    const chokidar = require('chokidar')
    console.log('start watching...', fileQueue)

    chokidar.watch(fileQueue).on('change', (path, stats) => {
      if (stats.size === 0) return
      console.log('\nfile has changed...')
      if (runPretest(pretest)) {
        app.ports.addfiles.send([path])
      }
    })
  }
  app.ports.addfiles.send(fileQueue)

  // kick off testing
  app.ports.next.send(watch)
})()
