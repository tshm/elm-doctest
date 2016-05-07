'use strict';

/** elm-doctest
 */
var debug = false;

var proc = require('process');
var fs = require('fs');
var exec = require('child_process').execSync;

function log(o) {
	if (debug) console.log(o);
}

function checkCommandlineArgs(args) {
	if (args.length == 3) return true;
	console.error('need provide elm source file path');
	return false;
}

/** read test signatures from the source into Array
 */
function collectSpecs(src) {
	var r = /^--\s*>>>\s*(.+)$[\r\n]^--\s*([^>\n\r]+)$/gm;
	var m = null,
	    specs = [];
	while ((m = r.exec(src)) != null) {
		var line = src.substring(0, m.index).split(/[\n\r]/).length;
		//log( m )
		specs.push({ test: m[1], expected: m[2], line: line });
	}
	return specs;
}

/** run elm-repl to read test results into Array
 */
function collectTestResults(tempModuleName) {
	var input = ['import ' + tempModuleName, 'import Json.Encode exposing (object, list, bool, string, encode)', 'encode 0 <| list <| \\', '  List.map (\\(r,o) -> object [("result", bool r), ("output", string o)])\\', '  ' + tempModuleName + '.doctestResults_'].join('\n');
	var stdout = exec('elm-repl', { input: input, encoding: 'utf8' });
	log(stdout);
	var match = stdout.match(/^> (.+)/gm);
	if (!match) return [];
	var resultStr = match[0].replace(/[^"]*(".+")( : .*)?/, '$1');
	return JSON.parse(JSON.parse(resultStr));
}

/** make temporary module based on a Elm source file
 * so that rest results are exposed.
 */
function createTempModule(src, specs) {
	var tempModuleName = 'DoctestTempModule__';
	var tempFilename = tempModuleName + '.elm';
	var re = /^\s*module(.|\r|\n)*?where/g;
	var headerstrippedsrc = src.replace(re, '');
	var specAssertions = specs.map(function (_ref) {
		var test = _ref.test;
		var expected = _ref.expected;

		var result = '(' + expected + ') == (' + test + ')';
		var output = 'toString (' + test + ')';
		return '((' + result + '), (' + output + '))';
	});
	var tmpsrc = ['module ' + tempModuleName + ' where', headerstrippedsrc, 'doctestResults_ : List (Bool, String)', 'doctestResults_ = [' + specAssertions.join(', ') + ']'].join('\n');
	fs.writeFileSync(tempFilename, tmpsrc);
	return tempModuleName;
}

function cleanTempFile(tempModuleName) {
	var filename = tempModuleName + '.elm';
	if (!fs.existsSync(filename)) return;
	fs.unlinkSync(filename);
}

function createReport(filename, results, failures) {
	var summary = ['Examples: ' + results.length, 'Failures: ' + failures.length].join('  ');
	var reports = failures.map(function (_ref2) {
		var test = _ref2.test;
		var expected = _ref2.expected;
		var output = _ref2.output;
		var line = _ref2.line;

		return ['### Failure in ' + filename + ':' + line + ': expression \'' + test + '\'', 'expected: ' + expected, ' but got: ' + output].join('\n');
	});
	return reports.join('\n\n') + '\n' + summary;
}

// main
console.log('Starting elm-doctest ...');
if (!checkCommandlineArgs(proc.argv)) process.exit();
var elmfile = proc.argv[2];
var elmsrc = fs.readFileSync(elmfile, 'utf8');
var specs = collectSpecs(elmsrc);
//log( specs )

var tempModuleName = createTempModule(elmsrc, specs);

var results = collectTestResults(tempModuleName).map(function (result, i) {
	return Object.assign({}, result, specs[i]);
});
var failures = results.filter(function (_ref3) {
	var result = _ref3.result;
	return !result;
});
log(results);
log(failures);

var report = createReport(elmfile, results, failures);
console.log(report);

if (!debug) cleanTempFile(tempModuleName);
if (failures.length > 0) process.exit(1);
