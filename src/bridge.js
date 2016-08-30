/** allow to use Elm from nodejs...
 */
const path = require('path')
const vm = require('vm')
const fs = require('fs')
const proc = require('process')
const exec = require('child_process').execSync
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
 */
let elmfile = ''
function* fileIterator( files ) {
	for (let i = 0; i < files.length; i++) {
		let file = files[ i ]
		try {
			elmfile = file
			const elmsrc = fs.readFileSync( file, 'utf8')
			// for some reason, Elm port does not work without delay.
			setTimeout(() => {
				log(`\n processing: ${ file }`)
				app.ports.srccode.send( elmsrc )
			}, 1)
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
	const stdout = exec('elm-repl', { input: resource.runner, encoding: 'utf8'})
	if ( debug ) log( stdout )
	const match = stdout.match(/^> (.+)/gm)
	if ( !match ) return []
	const resultStr = match[0].replace(/[^"]*(".+")( : .*)?/, '$1')
	if ( debug ) log( resultStr )
	app.ports.result.send({ stdout: JSON.parse( resultStr ), filename: elmfile })
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

/** main */
log('Starting elm-doctest ...')
if ( proc.argv.length < 3 ) {
	console.error('need provide elm source file path')
	process.exit( RETVAL.EXCEPTION )
}

const fi = fileIterator( proc.argv.slice(2))
runNext( fi )

