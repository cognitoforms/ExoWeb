var fs = require("fs");
var JSHINT = require("./ref/jshint/jshint").JSHINT;

var fileName = process.argv[2];
var content = fs.readFileSync(fileName, 'utf8');

JSHINT.jshint(content, { evil: true });
//JSHINT.report()

if (JSHINT.errors && JSHINT.errors.length > 0) {
	console.log(JSHINT.errors.length + " errors occurred:");
}

if (JSHINT.errors.length === 0) {
	console.log("PASSED!");
}
else {
	JSHINT.errors.forEach(function(err) {
		if (!err) return;
		console.log(err.line + ": " + err.reason);
	});
}
