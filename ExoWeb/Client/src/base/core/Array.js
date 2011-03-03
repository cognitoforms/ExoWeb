function forEach(arr, callback, thisPtr) {
	if (!(arr instanceof Array))
		throw new TypeError("An array must be passed to \"forEach\".");

	if (!(callback instanceof Function))
		throw new TypeError("A callback function must be passed to \"forEach\".");

	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr)
			callback.call(thisPtr || this, arr[i], i, arr);
}

if (!Array.prototype.forEach) {
	Array.prototype.forEach = function(fun /*, thisp*/) {
		forEach(this, fun, arguments[1]);
	};
}

function filter(arr, callback, thisPtr) {
	if (!(arr instanceof Array))
		throw new TypeError("An array must be passed to \"filter\".");

	if (!(callback instanceof Function))
		throw new TypeError("A callback function must be passed to \"filter\".");

	var result = [];

	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr && callback.call(thisPtr || this, arr[i], i, arr) === true)
			result.push(arr[i]);

	return result;
}

if (!Array.prototype.where) {
	Array.prototype.where = function(fun /*, thisp*/) {
		return filter(this, fun, arguments[1]);
	};
}

// Filters out duplicate items from the given array.
/////////////////////////////////////////////////////
function distinct(arr) {
	var result = [];

	for(var i = 0, len = arr.length; i < len; i++)
		if (result.indexOf(arr[i]) < 0)
			result.push(arr[i]);

	return result;
}
exports.distinct = distinct; // IGNORE

// Finds the set intersection of the two given arrays.  The items
// in the resulting list are distinct and in no particular order.
///////////////////////////////////////////////////////////////////
function intersect(arr1, arr2) {
	return distinct(filter(arr1, function(item) {
		return arr2.indexOf(item) >= 0;
	}));
}
exports.intersect = intersect; // IGNORE

if (!Array.prototype.map) {
	Array.prototype.map = function Array$map(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function") {
			throw new TypeError();
		}

		var res = new Array(len);
		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this) {
				res[i] = fun.call(thisp, this[i], i, this);
			}
		}

		return res;
	};
}

if (!Array.prototype.every) {
	Array.prototype.every = function Array$every(fun /*, thisp*/) {
		var len = this.length >>> 0;
		if (typeof fun != "function") {
			throw new TypeError();
		}

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in this && !fun.call(thisp, this[i], i, this)) {
				return false;
			}
		}

		return true;
	};
}

if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function Array$indexOf(elt /*, from*/) {
		var len = this.length >>> 0;

		var from = Number(arguments[1]) || 0;

		from = (from < 0) ? Math.ceil(from) : Math.floor(from);

		if (from < 0) {
			from += len;
		}

		for (; from < len; from++) {
			if (from in this && this[from] === elt) {
				return from;
			}
		}
		return -1;
	};
}

if (!Array.prototype.some) {
	Array.prototype.some = function Array$some(fun /*, thisp*/) {
		var i = 0,
		len = this.length >>> 0;

		if (typeof fun != "function") {
			throw new TypeError();
		}
	
		var thisp = arguments[1];
		for (; i < len; i++) {
			if (i in this && fun.call(thisp, this[i], i, this)) {
				return true;
			}
		}

		return false;
	};
}

if (!Array.prototype.addRange) {
	Array.prototype.addRange = function Array$addRange(items) {
		Array.prototype.push.apply(this, items);
	};
}

if (!Array.prototype.clear) {
	Array.prototype.clear = function Array$clear() {
		this.length = 0;
	};
}

if (!Array.prototype.dequeue) {
	Array.prototype.dequeue = function Array$dequeue() {
		return this.shift();
	};
}

if (!Array.prototype.remove) {
	Array.prototype.remove = function Array$remove(item) {
		var idx = this.indexOf(item);
		if (idx < 0) {
			return false;
		}

		this.splice(idx, 1);
		return true;
	};
}

if (!Array.prototype.copy) {
	Array.prototype.copy = function Array$copy() {
		return Array.prototype.splice.apply([], [0, 0].concat(this));
	};
}

// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/lastIndexOf
if (!Array.prototype.lastIndexOf) {
	Array.prototype.lastIndexOf = function(searchElement /*, fromIndex*/) {
		"use strict";

		if (this === void 0 || this === null) {
			throw new TypeError();
		}

		var t = Object(this);
		var len = t.length >>> 0;

		if (len === 0) {
			return -1;
		}

		var n = len;
		if (arguments.length > 0) {
			n = Number(arguments[1]);
			if (n !== n) {
				n = 0;
			}
			else if (n !== 0 && n !== (1 / 0) && n !== -(1 / 0)) {
				n = (n > 0 || -1) * Math.floor(Math.abs(n));
			}
		}

		var k = n >= 0
			? Math.min(n, len - 1)
			: len - Math.abs(n);

		while (k >= 0)
		{
			if (k in t && t[k] === searchElement) {
				return k;
			}
		}

		return -1;
	};
}

if (!Array.prototype.removeAll) {
	Array.prototype.removeAll = function(fn, thisPtr) {
		for (var i = 0; i < this.length; i++) {
			if (fn.call(thisPtr || this, this[i], i) === true) {
				if (this.removeAt) {
					this.removeAt(i--);
				}
				else {
					this.splice(i--, 1);
				}
			}
		}
	}
}
