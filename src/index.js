/** elm-doctest
 */
const debug = false

const proc = require('process')
const fs = require('fs')
const exec = require('child_process').execSync

function log( o ) {
	if (debug) console.log( o )
}

function checkCommandlineArgs( args ) {
	if ( args.length == 3 ) return true
	console.error('need provide elm source file path')
	return false
}

/** read test signatures from the source into Array
 */
function collectSpecs( src ) {
	const r = /^--\s*>>>\s*(.+)$[\r\n]^--\s*([^>\n\r]+)$/gm
	let m = null, specs = []
	while ((m = r.exec( src )) != null) {
		let line = src.substring( 0, m.index ).split(/[\n\r]/).length
		//log( m )
		specs.push({ test: m[ 1 ], expected: m[ 2 ], line })
	}
	return specs
}

/** run elm-repl to read test results into Array
 */
function collectTestResults( tempModuleName ) {
	const input = [
		`import ${ tempModuleName }`,
		'import Json.Encode exposing (object, list, bool, string, encode)',
		'encode 0 <| list <| \\',
		'  List.map (\\(r,o) -> object [("result", bool r), ("output", string o)])\\',
		`  ${ tempModuleName }.doctestResults_`
	].join('\n')
	const stdout = exec('elm-repl', { input, encoding: 'utf8'})
	//log( stdout )
	const match = stdout.match(/^> (.+)/gm)
	if ( !match ) return []
	const resultStr = match[ 0 ].replace(/[^"]*(".+")( : .*)?/, '$1')
	return JSON.parse( JSON.parse( resultStr ))
}

/** make temporary module based on a Elm source file
 * so that rest results are exposed.
 */
function createTempModule( src, specs ) {
	const tempModuleName = 'DoctestTempModule__'
	const tempFilename = tempModuleName + '.elm'
	const re = /module(.|\r|\n)*where/g
	const headerstrippedsrc = src.replace( re, '')
	const specAssertions = specs.map(({ test, expected }) => {
		const result = `(${ expected }) == (${ test })`
		const output = `toString (${ test })`
		return `((${ result }), (${ output }))`
	})
	const tmpsrc = [
		`module ${ tempModuleName } where`,
		headerstrippedsrc,
		'doctestResults_ : List (Bool, String)',
		`doctestResults_ = [${ specAssertions.join(', ')}]`
	].join('\n')
	fs.writeFileSync( tempFilename, tmpsrc )
	return tempModuleName
}

function cleanTempFile( tempModuleName ) {
	const filename = tempModuleName + '.elm'
	if ( !fs.existsSync( filename )) return
	fs.unlinkSync( filename )
}

function createReport( filename, results, failures ) {
	const base = [
		`Examples: ${ results.length }`,
		`Failures: ${ failures.length }`
	].join('  ')
	const reports = failures.map(({ test, expected, output, line }) => {
		return [
			`### Failure in ${ filename }:${ line }: expression '${ test }'`,
			`expected: ${ expected }`,
			` but got: ${ output }`
		].join('\n')
	})
	return base + '\n' + reports.join('\n\n')
}

// main
console.log('Starting elm-doctest ...')
if ( !checkCommandlineArgs( proc.argv )) process.exit()
const elmfile = proc.argv[ 2 ]
const elmsrc = fs.readFileSync( elmfile, 'utf8')
const specs = collectSpecs( elmsrc )
//log( specs )

const tempModuleName = createTempModule( elmsrc, specs )

const results = collectTestResults( tempModuleName )
	.map(( result, i ) => Object.assign({}, result, specs[ i ]))
const failures = results.filter(({ result }) => !result )
log( results )
log( failures )

const report = createReport( elmfile, results, failures )
console.log( report )

if ( !debug ) cleanTempFile( tempModuleName )
if ( failures.length > 0 ) process.exit(1)
