/** allow to use Elm from nodejs...
 */
const vm = require('vm')
const fs = require('fs')
const proc = require('process')
const exec = require('child_process').execSync

function log( o ) {
	console.log( o )
}

/** loads Elm compiled javascript
 * and returns Elm object
 */
function loadElm( path ) {
	log('exports called.')
	const data = fs.readFileSync( path )
	const context = { console, setInterval, setTimeout, setImmediate }
	vm.runInNewContext( data, context, path )
	return context.Elm
}

/** main
 */
const Elm = loadElm('./index.js')
const app = Elm.worker( Elm.Main,
  { srccode: ''
	, result: { stdout: '', filename: ''}
  }
)

console.log('Starting elm-doctest ...')
if ( proc.argv.length != 3 ) {
	console.error('need provide elm source file path')
	process.exit( 1 )
}
const elmfile = proc.argv[ 2 ]
const elmsrc = fs.readFileSync( elmfile, 'utf8')
app.ports.srccode.send( elmsrc )

app.ports.evaluate.subscribe(function( resource ) {
	if ( resource.src.length == 0 ) return
	log('writing temporary source into file...')
	fs.writeFileSync('./src/DoctestTempModule__.elm', resource.src )
	const stdout = exec('elm-repl', { input: resource.runner, encoding: 'utf8'})
	//log(stdout)
	app.ports.result.send({ stdout: stdout, filename: elmfile })
})

app.ports.report.subscribe(function( report ) {
	log( report.text )
	if ( report.failed ) process.exit(1)
	process.exit()
})

