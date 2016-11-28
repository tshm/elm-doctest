'use strict'
/** allow to use Elm from nodejs...
 */
const path = require('path')
const vm = require('vm')
const fs = require('fs')
const proc = require('process')
const spawn = require('child_process').spawnSync
const debug = proc.env.DEBUG || false
const RETVAL = {
	SUCCESS: 0,
	FAIL: 1,
	EXCEPTION: 2
}

// extract source folder from elm-package.json
const cwd = (() => {
	try {
		const data = fs.readFileSync('elm-package.json' )
		return JSON.parse( data )['source-directories'][0]
	} catch (e) {
		return './'
	}
})()
const testfilename = path.resolve( cwd, './DoctestTempModule__.elm')

function log(o) { console.log(o) }
if ( debug ) log('############## debug mode is ON ##############')

/** loads Elm compiled javascript
 * and returns Elm object
 */
function loadElm( path ) {
	const data = fs.readFileSync( path )
	const context = { console, setInterval, setTimeout, setImmediate }
	vm.runInNewContext( data, context, path )
	return context.Elm
}

/** use generator to serialize the test runner for multiple files
 * if watch is true, then it does not quit even if queue is empty.
 */
let elmfile = ''
function* fileIterator( pretest, watch ) {
	while ( watch || fileQueue.length > 0 ) {
		if ( watch && fileQueue.length == 0 ) {
			yield true
			continue
		}
		elmfile = fileQueue.shift()
		// log(`elmfile: ${ elmfile }`)
		try {
			const run_repl = ( pretest.length == 0 ) || (() => {
				const cmd = pretest[0]
				const args = pretest.slice(1)
				const { stdout, stderr, status } = spawn(cmd, args, { encoding: 'utf8'})
				if ( stdout ) log(`pretest: ${ stdout }`)
				if ( stderr ) log(`pretest err: ${ stderr }`)
				log(`pretest status: ${ status }`)
				return status == 0
			})()
			if ( run_repl ) {
				const elmsrc = fs.readFileSync( elmfile, 'utf8')
				// for some reason, Elm port does not work without delay.
				setTimeout(() => {
					log(`\n processing: ${ elmfile }`)
					app.ports.srccode.send( elmsrc )
				}, 1)
			}
			yield true
		} catch(e) {
			log(`failed to run tests: ${ e }`)
			process.exit( RETVAL.EXCEPTION )
		}
	}
	return
}

// load main Elm script
const Elm = loadElm( path.resolve(__dirname, '../distribution/index.js'))
const app = Elm.Main.worker()

/** receive evaluate message from Elm and elm-make and evaluate
 * test cases, then send it back to Elm.
 */
app.ports.evaluate.subscribe( resource => {
	if ( debug ) {
		log('----------- evaluate called.')
		log( resource )
	}
	if ( resource.src.length == 0 ) return
	// log('writing temporary source into file...')
	fs.writeFileSync( testfilename, resource.src )
	const { stdout, status, error } = spawn(elm_repl, [], { input: resource.runner, encoding: 'utf8'})
	if ( error ) {
		log(`elm-repl failed to run:\n ${ error }`)
	}
	if ( debug ) log( stdout )
	if ( status != 0 ) {
		log(`elm-repl exited with ${ status }`)
	} else {
		const match = stdout.match(/^> (.+)/gm)
		if ( !match ) return []
		const resultStr = match[0].replace(/[^"]*(".+")( : .*)?/, '$1')
		if ( debug ) log( resultStr )
		app.ports.result.send({ stdout: JSON.parse( resultStr ), filename: elmfile })
	}
	if ( !debug && fs.existsSync( testfilename ))
		fs.unlinkSync( testfilename )
})

/** Receive report message from Elm and
 * display results
 */
let returnValue = true
app.ports.report.subscribe( report => {
	if ( report.text.length == 0 ) return
	log( report.text )
	if ( report.failed ) returnValue = false
	runNext( fi )
})

/** Helper function to serialize the tests
 */
function runNext( fi ) {
	const v = fi.next()
	if ( debug ) log( v )
	if ( v.done ) {
		process.exit( returnValue ? RETVAL.SUCCESS : RETVAL.FAIL )
	}
}

/** parse commandline options
 */
function parseOpt( argv ) {
	const optSpec = {
		boolean: ['help', 'version', 'watch'],
		string: ['elm-repl-path', 'pretest'],
		alias: {h: 'help', v: 'version', w: 'watch'}
	}
	const opts = require('minimist')( argv, optSpec )
	if ( debug ) console.log('options:', opts )

	// show usage/help message
	if ( opts.version || opts.help || !opts._ ) {
		(function showHelpMessage() {
			const version = require('../package.json').version
			log(`elm-doctest ${ version }`)
			log('')
			log('Usage: elm-doctest [--watch] [--help] [--elm-repl-path PATH]')
			log('                   [--pretest CMD] FILES...')
			log('  run doctest against given Elm files')
			log('')
			log('Available options:')
			log('  -h,--help\t\t'
				+ 'Show this help text')
			log('  --pretest CMD\t\t'
				+ 'command to run before doc-test')
			log('  --elm-repl-path PATH\t'
				+ 'Path to elm-repl executable')
			log('  -w,--watch\t\t'
				+ 'Watch and run tests when target files get updated')
		})()
		process.exit( RETVAL.SUCCESS )
	}

	return {
		elm_repl: opts['elm-repl-path'] || 'elm-repl',
		fileQueue: opts._,
		pretest: opts.pretest ? opts.pretest.split(' ') : [],
		watch: opts.watch
	}
}

/** main */
const { elm_repl, fileQueue, pretest, watch } = parseOpt( proc.argv.slice(2))
log('Starting elm-doctest ...')

// persist/watch files if `--watch` option was given
if ( watch ) {
	const chokidar = require('chokidar')
	console.log('start watching...', fileQueue )

	chokidar.watch( fileQueue ).on('change', (path, stats) => {
		if ( stats.size == 0 ) return
		console.log('\nfile has changed...')
		fileQueue.push( path )
		runNext( fi )
	})
}

// kick-off the test for the 1st time
const fi = fileIterator( pretest, watch )
runNext( fi )

