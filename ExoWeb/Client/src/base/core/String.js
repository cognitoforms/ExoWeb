// Add String.trim() if not natively supported
if (typeof String.prototype.trim !== 'function') {
	String.prototype.trim = function () {
		return this.replace(/^\s+|\s+$/g, '');
	}
}
function isNullOrEmpty(str) {
	return str === null || str === undefined || str === "";
}

// Based on https://vanillajstoolkit.com/polyfills/stringendswith/
function endsWith(str, searchStr, position) {
	// This works much better than >= because
	// it compensates for NaN:
	if (!(position < str.length)) {
		position = str.length;
	} else {
		position |= 0; // round position
	}
	return str.substr(position - searchStr.length, searchStr.length) === searchStr;
}

function includes(str, search, start) {
	if (search instanceof RegExp) {
		throw TypeError('first argument must not be a RegExp');
	}
	if (start === undefined) { start = 0; }
	return str.indexOf(search, start) !== -1;
}

// https://gist.github.com/TheBrenny/039add509c87a3143b9c077f76aa550b
function matchAll (str, rx) {
	if (typeof rx === "string") rx = new RegExp(rx, "g"); // coerce a string to be a global regex
	rx = new RegExp(rx); // Clone the regex so we don't update the last index on the regex they pass us
	var cap = []; // the single capture
	var all = []; // all the captures (return this)
	while ((cap = rx.exec(str)) !== null) all.push(cap); // execute and add
	return all; // profit!
}

// Based on https://vanillajstoolkit.com/polyfills/stringpadend/
function padEnd(str, targetLength, padString) {
	targetLength = targetLength >> 0; //floor if number or convert non-number to 0;
	padString = String((typeof padString !== 'undefined' ? padString : ' '));
	if (str.length > targetLength) {
		return String(str);
	}
	else {
		targetLength = targetLength - str.length;
		if (targetLength > padString.length) {
			padString += repeat(padString, targetLength / padString.length); //append to original to ensure we are longer than needed
		}
		return String(str) + padString.slice(0, targetLength);
	}
}

// Based on https://vanillajstoolkit.com/polyfills/stringpadstart/
function padStart(str, targetLength, padString) {
	targetLength = targetLength >> 0; //truncate if number or convert non-number to 0;
	padString = String((typeof padString !== 'undefined' ? padString : ' '));
	if (str.length > targetLength) {
		return String(str);
	}
	else {
		targetLength = targetLength - str.length;
		if (targetLength > padString.length) {
			padString += repeat(padString, targetLength / padString.length); //append to original to ensure we are longer than needed
		}
		return padString.slice(0, targetLength) + String(str);
	}
}

// Based on https://vanillajstoolkit.com/polyfills/stringrepeat/
function repeat(str, count) {
	if (str == null)
		throw new TypeError('can\'t convert ' + str + ' to object');

	var result = '' + str;
	// To convert string to integer.
	count = +count;
	// Check NaN
	if (count != count)
		count = 0;

	if (count < 0)
		throw new RangeError('repeat count must be non-negative');

	if (count == Infinity)
		throw new RangeError('repeat count must be less than infinity');

	count = Math.floor(count);
	if (result.length == 0 || count == 0)
		return '';

	// Ensuring count is a 31-bit integer allows us to heavily optimize the
	// main part. But anyway, most current (August 2014) browsers can't handle
	// strings 1 << 28 chars or longer, so:
	if (result.length * count >= 1 << 28)
		throw new RangeError('repeat count must not overflow maximum string size');

	var maxCount = result.length * count;
	count = Math.floor(Math.log(count) / Math.log(2));
	while (count) {
		result += result;
		count--;
	}
	result += result.substring(0, maxCount - result.length);
	return result;
}

// Based on https://vanillajstoolkit.com/polyfills/stringreplaceall/
function replaceAll(str, substr, newSubstr) {
	// If a regex pattern
	if (Object.prototype.toString.call(substr).toLowerCase() === '[object regexp]') {
		return str.replace(substr, newSubstr);
	}

	// If a string
	return str.replace(new RegExp(substr, 'g'), newSubstr);
}

// Based on https://vanillajstoolkit.com/polyfills/stringstartswith/
function startsWith(str, searchString, position) {
	return str.slice(position || 0, searchString.length) === searchString;
}

// Based on https://vanillajstoolkit.com/polyfills/stringtrimend/
function trimEnd(str) {
	return str.replace(new RegExp(/[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/.source + '$', 'g'), '');
}

// Based on https://vanillajstoolkit.com/polyfills/stringtrimstart/
function trimStart(str) {
	return str.replace(new RegExp('^' + /[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/.source, 'g'), '');
}

if (!String.prototype.endsWith)
	String.prototype.endsWith = function (searchStr /*, position*/) { return endsWith(this, rx, arguments[1]); };
if (!String.prototype.includes)
	String.prototype.includes = function (search /*, start*/) { return includes(this, search, arguments[1]); };
if (!String.prototype.matchAll)
	String.prototype.matchAll = function (regexp) { return matchAll(this, regexp); };
if (!String.prototype.padEnd)
	String.prototype.padEnd = function (targetLength /*, padString*/) { return padEnd(this, targetLength, arguments[1]); };
if (!String.prototype.padStart)
	String.prototype.padStart = function (targetLength /*, padString*/) { return padStart(this, targetLength, arguments[1]); };
if (!String.prototype.repeat)
	String.prototype.repeat = function (count) { return repeat(this, count); };
if (!String.prototype.replaceAll)
	String.prototype.replaceAll = function (substr, newSubstr) { return replaceAll(this, substr, newSubstr); };
if (!String.prototype.startsWith)
	String.prototype.startsWith = function (searchString /*, position*/) { return startsWith(this, searchString, arguments[1]); };
if (!String.prototype.trimEnd)
	String.prototype.trimEnd = function () { return trimEnd(this); };
if (!String.prototype.trimStart)
	String.prototype.trimStart = function () { return trimStart(this); };

exports.endsWith = endsWith; // IGNORE
exports.includes = includes; // IGNORE
exports.isNullOrEmpty = isNullOrEmpty; // IGNORE
exports.matchAll = matchAll; // IGNORE
exports.padEnd = padEnd; // IGNORE
exports.padStart = padStart; // IGNORE
exports.repeat = repeat; // IGNORE
exports.replaceAll = replaceAll; // IGNORE
exports.startsWith = startsWith; // IGNORE
exports.trimEnd = trimEnd; // IGNORE
exports.trimStart = trimStart; // IGNORE

