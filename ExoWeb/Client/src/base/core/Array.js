function assertArrayArg(arr, functionName) {
	if (!(arr instanceof Array))
		throw new TypeError("An array must be passed to \"" + functionName + "\".");
}

function assertFunctionArg(fun, allowNull, functionName) {
	if (allowNull.constructor !== Boolean) {
		functionName = allowNull;
		allowNull = false;
	}

	if (allowNull && (fun === null || fun === undefined))
		return;

	if (!(fun instanceof Function))
		throw new TypeError("A callback function must be passed to \"" + functionName + "\".");
}

function addRange(arr, items) {
	assertArrayArg(arr, "addRange");
	assertArrayArg(items, "addRange");

	Array.prototype.push.apply(arr, items);
}

function contains(arr, elt, from) {
	assertArrayArg(arr, "contains");
	return indexOf(arr, elt, from) > -1 ? true : false;
}

// Filters out duplicate items from the given array.
/////////////////////////////////////////////////////
function distinct(arr) {
	assertArrayArg(arr, "distinct");

	var result = [];

	for(var i = 0, len = arr.length; i < len; i++)
		if (result.indexOf(arr[i]) < 0)
			result.push(arr[i]);

	return result;
}

function every(arr, callback, thisPtr) {
	assertArrayArg(arr, "every");
	assertFunctionArg(callback, "every");

	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr && !callback.call(thisPtr || this, arr[i], i, arr))
			return false;

	return true;
}

function filter(arr, callback, thisPtr) {
	assertArrayArg(arr, "filter");
	assertFunctionArg(callback, "filter");

	var result = [];
	for (var i = 0, len = arr.length; i < len; i++) {
		if (i in arr) {
			var val = arr[i]; // callback may mutate original item
			if (callback.call(thisPtr || this, val, i, arr) === true)
				result.push(val);
		}
	}

	return result;
}

function first(arr, callback, thisPtr) {
	assertArrayArg(arr, "first");
	assertFunctionArg(callback, true, "first");

	for (var i = 0, len = arr.length; i < len; i++) {
		if (i in arr) {
			var val = arr[i];
			if (!callback || callback.call(thisPtr || this, val, i, arr) === true) {
				return val;
			}
		}
	}

	return null;
}

function forEach(arr, callback, thisPtr) {
	assertArrayArg(arr, "forEach");
	assertFunctionArg(callback, "forEach");

	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr)
			callback.call(thisPtr || this, arr[i], i, arr);
}

function indexOf(arr, elt, from) {
	assertArrayArg(arr, "indexOf");
	var len = arr.length;
	var from = Number(from) || 0;
	from = (from < 0) ? Math.ceil(from) : Math.floor(from);
	if (from < 0) from += len;

	for (; from < len; from++)
		if (from in arr && arr[from] === elt)
			return from;

	return -1;
}

// Finds the set intersection of the two given arrays.  The items
// in the resulting list are distinct and in no particular order.
///////////////////////////////////////////////////////////////////
function intersect(arr1, arr2) {
	return distinct(filter(arr1, function(item) {
		return arr2.indexOf(item) >= 0;
	}));
}

function lastIndexOf(arr, item, from) {
	assertArrayArg(arr, "lastIndexOf");

	var len = arr.length;

	if (len === 0) return -1;

	var n = len;
	if (from) {
		n = Number(from);

		if (n !== n)
			n = 0;
		else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0))
			n = (n > 0 || -1) * Math.floor(Math.abs(n));
	}

	var k = n >= 0 ? Math.min(n, len - 1) : len - Math.abs(n);

	while (k >= 0)
		if (k in t && t[k] === searchElement)
			return k;

	return -1;
}

function map(arr, callback, thisPtr) {
	assertArrayArg(arr, "map");
	assertFunctionArg(callback, "map");

	var result = [];

	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr)
			result[i] = callback.call(thisPtr || this, arr[i], i, arr);

	return result;
}

function mapToArray(arr, callback, thisPtr) {
	var result = [];

	forEach(arr, function(item, i, a) {
		addRange(result, callback.call(thisPtr || this, item, i, a));
	});

	return result;
}

function peek(arr) {
	var peekVal = arr.pop();
	arr.push(peekVal);
	return peekVal;
}

function purge(arr, callback, thisPtr) {
	assertArrayArg(arr, "purge");
	assertFunctionArg(callback, "purge");

	var result;

	for (var i = arr.length - 1; i >= 0; i--) {
		if (callback.call(thisPtr || this, arr[i], i) === true) {
			if (arr.removeAt)
				arr.removeAt(i);
			else
				arr.splice(i, 1);

			if (!result) result = [];

			result.splice(0, 0, i);
		}
	}

	return result;
}

function remove(arr, item) {
	var idx = arr.indexOf(item);
	if (idx < 0)
		return false;

	arr.splice(idx, 1);
	return true;
}

function some(arr, callback, thisPtr) {
	assertArrayArg(arr, "some");
	assertFunctionArg(callback, true, "some");

	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr && callback.call(thisPtr || this, arr[i], i, arr))
			return true;

	return false;
}

if (!Array.prototype.addRange)
	Array.prototype.addRange = function(items) { addRange(this, items); };
if (!Array.prototype.copy)
	Array.prototype.copy = function() { return Array.prototype.splice.apply([], [0, 0].concat(this)); };
if (!Array.prototype.clear)
	Array.prototype.clear = function () { this.length = 0; };
if (!Array.prototype.contains)
	Array.prototype.contains = function (elt/*, from*/) { return contains(this, elt, arguments[1]); };
if (!Array.prototype.dequeue)
	Array.prototype.dequeue = function() { return this.shift(); };
if (!Array.prototype.distinct)
	Array.prototype.distinct = function() { return distinct(this); };
if (!Array.prototype.every)
	Array.prototype.every = function(fun /*, thisp*/) { return every(this, fun, arguments[1]); };
if (!Array.prototype.filter)
	Array.prototype.filter = function(fun/*, thisp */) { return filter(this, fun, arguments[1]); };
if (!Array.prototype.first)
	Array.prototype.first = function(fun/*, thisp */) { return first(this, fun, arguments[1]); };
if (!Array.prototype.forEach)
	Array.prototype.forEach = function(fun /*, thisp*/) { forEach(this, fun, arguments[1]); };
if (!Array.prototype.indexOf)
	Array.prototype.indexOf = function(elt/*, from*/) { return indexOf(this, elt, arguments[1]); };
if (!Array.prototype.intersect)
	Array.prototype.intersect = function(items) { return intersect(this, items); };
if (!Array.prototype.lastIndexOf)
	Array.prototype.lastIndexOf = function (item/*, from*/) { return lastIndexOf(this, item, arguments[1]); };
if (!Array.prototype.map)
	Array.prototype.map = function(fun /*, thisp*/) { return map(this, fun, arguments[1]); };
if (!Array.prototype.mapToArray)
	Array.prototype.mapToArray = function(fun/*, thisp*/) { return mapToArray(this, fun, arguments[1]); };
if (!Array.prototype.peek)
	Array.prototype.peek = function() { return peek(this); }
if (!Array.prototype.purge)
	Array.prototype.purge = function(fun/*, thisp*/) { return purge(this, fun, arguments[1]); }
if (!Array.prototype.remove)
	Array.prototype.remove = function(item) { return remove(this, item); };
if (!Array.prototype.some)
	Array.prototype.some = function(fun /*, thisp*/) { return some(this, fun, arguments[1]); };

exports.contains = contains; // IGNORE
exports.distinct = distinct; // IGNORE
exports.every = every; // IGNORE
exports.filter = filter; // IGNORE
exports.first = first; // IGNORE
exports.forEach = forEach; // IGNORE
exports.indexOf = indexOf; // IGNORE
exports.intersect = intersect; // IGNORE
exports.lastIndexOf = lastIndexOf; // IGNORE
exports.map = map; // IGNORE
exports.mapToArray = mapToArray; // IGNORE
exports.peek = peek; // IGNORE
exports.purge = purge; // IGNORE
exports.some = some; // IGNORE
