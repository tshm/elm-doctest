// @ts-check
const { log, dump, RETVAL } = require('./util')
const { makeElmRuntime } = require('./bridge')
const { spawnSync } = require('child_process')

/**
 * parse commandline options
 * @param {string[]} argv
 * @returns {{ elmpath: string, fileQueue: string[], pretest: string[], watch: boolean }}
 */
function parseOpt(argv) {
  const optSpec = {
    boolean: ['help', 'version', 'watch'],
    string: ['elm-path', 'pretest'],
    alias: { h: 'help', v: 'version', w: 'watch' },
  }
  const opts = require('minimist')(argv, optSpec)
  dump(opts)

  // show usage/help message
  if (opts.version || opts.help || opts._.length === 0) {
    ;(function showHelpMessage() {
      const version = require('../package.json').version
      log(`elm-doctest ${version}`)
      log('')
      log('Usage: elm-doctest [--help] [--watch] [--elm-path PATH]')
      log('                   [--pretest CMD] FILES...')
      log('  run doctest against given Elm files')
      log('')
      log('Available options:')
      log('  -h,--help\t\t' + 'Show this help text')
      log(
        '  -w,--watch\t\t' + 'Watch and run tests when target files get updated'
      )
      log('  --elm-path PATH\t' + 'Path to elm executable')
      log('  --pretest CMD\t\t' + 'command to run before doc-test')
    })()
    process.exit(RETVAL.SUCCESS)
  }

  return {
    elmpath: opts['elm-path'] || 'elm',
    fileQueue: opts._,
    pretest: opts.pretest ? opts.pretest.split(' ') : [],
    watch: opts.watch,
  }
}

/**
 * run pretest
 * @param {string[]} pretest
 */
function runPretest(pretest) {
  if (pretest.length === 0) return true
  const cmd = pretest[0]
  const args = pretest.slice(1)
  const { stdout, stderr, status } = spawnSync(cmd, args, { encoding: 'utf8' })
  if (stdout) log(`pretest: ${stdout}`)
  if (stderr) log(`pretest err: ${stderr}`)
  log(`pretest status: ${status}`)
  return status === 0
}

/** main */
;(function main(argv) {
  const { elmpath, fileQueue, pretest, watch } = parseOpt(argv)
  log('Starting elm-doctest ...')

  if (!runPretest(pretest)) {
    log('exiting as preset failed')
    process.exit(1)
  }

  const { addfiles, runnext } = makeElmRuntime(elmpath, watch)

  // persist/watch files if `--watch` option was given
  if (watch) {
    const chokidar = require('chokidar')
    console.log('start watching...', fileQueue)

    chokidar.watch(fileQueue).on('change', (path, stats) => {
      if (stats.size === 0) return
      console.log('\nfile has changed...')
      if (runPretest(pretest)) {
        addfiles([path])
      }
    })
  }

  addfiles(fileQueue)
  // kick off testing
  runnext(watch)
})(require('process').argv.slice(2))
