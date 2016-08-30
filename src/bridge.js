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
const testfilename = path.resolve(cwd, './DoctestTempModule__.elm')
const runnerScript = path.resolve(cwd, './RunnerDoctestTempModule__.elm')

function log(o) {
	console.log(o)
}
if ( debug ) log('############## debug mode is ON ##############')

/** loads Elm compiled javascript
 * and returns Elm object
 */
function loadElm( path ) {
	const MockBrowser = new require('mock-browser').mocks.MockBrowser
	const browser = new MockBrowser()
	const window = browser.getWindow()
	const document = browser.getDocument()
	const data = fs.readFileSync( path )
	const context = { console, window, document, setInterval, setTimeout, setImmediate }
	vm.runInNewContext( data, context, path )
	return context.Elm
}

let elmfile = ''
function* fileIterator( files ) {
	for (let i = 0; i < files.length; i++) {
		let file = files[ i ]
		try {
			elmfile = file
			const elmsrc = fs.readFileSync( file, 'utf8')
			setTimeout(() => {  // for some reason, port does not work without delay.
				log(`processing: ${file}`)
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

const Elm = loadElm( path.resolve(__dirname, '../distribution/index.js'))
const app = Elm.Main.worker()

app.ports.evaluate.subscribe( resource => {
	if ( debug ) {
		log('----------- evaluate called.')
		log( resource )
	}
	if ( resource.src.length == 0 ) return
	// log('writing temporary source into file...')
	fs.writeFileSync( testfilename, resource.src )
	fs.writeFileSync( runnerScript, resource.runner )
	const stdout = exec(`elm-make ${runnerScript} --output ${runnerScript}.js`,
		{ encoding: 'utf8'})
	if ( debug ) log( stdout )

	const app_runner = loadElm(`${runnerScript}.js`)
		.RunnerDoctestTempModule__.worker()
	app_runner.ports.evalResults.subscribe( results => {
		if ( debug ) log( results )
		app.ports.result.send({ stdout: JSON.stringify(results), filename: elmfile })
	})
	if ( !debug && fs.existsSync( testfilename ) && fs.existsSync( runnerScript )) {
		fs.unlinkSync( testfilename )
		fs.unlinkSync( runnerScript )
		fs.unlinkSync(`${runnerScript}.js`)
	}
})

let returnValue = true
app.ports.report.subscribe( report => {
	if ( report.text.length == 0 ) return
	log( report.text )
	if ( report.failed ) returnValue = false
	runNext( fi )
})

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

