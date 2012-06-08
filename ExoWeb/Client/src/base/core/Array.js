function addRange(arr, items) {
	Array.prototype.push.apply(arr, items);
}

function contains(arr, item, from) {
	return arr.indexOf(item, from) >= 0;
}

function copy(arr) {
	return Array.prototype.slice.call(arr);
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

function every(arr, callback, thisPtr) {
	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr && !callback.call(thisPtr || this, arr[i], i, arr))
			return false;

	return true;
}

function fill(arr, value, times) {
	for (var i = 0; i < times; i++)
		arr.push(value);
	return arr;
}

function filter(arr, callback, thisPtr) {
	var result = [];
	for (var i = 0, len = arr.length; i < len; i++) {
		if (i in arr) {
			var val = arr[i]; // callback may mutate original item
			if (callback.call(thisPtr || this, val, i, arr))
				result.push(val);
		}
	}

	return result;
}

function first(arr, callback, thisPtr) {
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
	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr)
			callback.call(thisPtr || this, arr[i], i, arr);
}

function indexOf(arr, elt, from) {
	var len = arr.length;
	from = Number(from) || 0;
	from = (from < 0) ? Math.ceil(from) : Math.floor(from);
	if (from < 0) from += len;

	for (; from < len; from++)
		if (from in arr && arr[from] === elt)
			return from;

	return -1;
}

function insert(arr, index, item) {
	Array.prototype.splice.call(arr, index, 0, item);
}

function insertRange(arr, index, items) {
	var args = items.slice();
	args.splice(0, 0, index, 0);
	Array.prototype.splice.apply(arr, args);
}

// Finds the set intersection of the two given arrays.  The items
// in the resulting list are distinct and in no particular order.
///////////////////////////////////////////////////////////////////
function intersect(arr1, arr2) {
	return distinct(filter(arr1, function(item) {
		return arr2.indexOf(item) >= 0;
	}));
}

function last(arr, callback, thisPtr) {
	var result = null;

	for (var i = 0, len = arr.length; i < len; i++) {
		if (i in arr) {
			var val = arr[i];
			if (!callback || callback.call(thisPtr || this, val, i, arr) === true) {
				result = val;
			}
		}
	}

	return result;
}

function lastIndexOf(arr, item, from) {
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
		if (k in arr && arr[k] === item)
			return k;

	return -1;
}

function map(arr, callback, thisPtr) {
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

function observableSplice(arr, events, index, removeCount, addItems) {
	var removedArray, removedItem;

	if (removeCount) {
		if (removeCount > 1 && arr.removeRange) {
			removedArray = arr.removeRange(index, removeCount);
		}
		else if (removeCount === 1 && arr.removeAt) {
			removedItem = arr.removeAt(index);
		}
		else {
			removedArray = arr.splice(index, removeCount);
		}
	
		if (events) {
			events.push({
				action: Sys.NotifyCollectionChangedAction.remove,
				oldStartingIndex: index,
				oldItems: removedArray || [removedItem],
				newStartingIndex: null,
				newItems: null
			});
		}
	}

	if (addItems.length > 0) {
		if (addItems.length > 1 && arr.insertRange) {
			arr.insertRange(index, addItems);
		}
		else if (addItems.length === 1 && arr.insert) {
			arr.insert(index, addItems[0]);
		}
		else {
			insertRange(arr, index, addItems);
		}

		if (events) {
			events.push({
				action: Sys.NotifyCollectionChangedAction.add,
				oldStartingIndex: null,
				oldItems: null,
				newStartingIndex: index,
				newItems: addItems
			});
		}
	}
}

function peek(arr) {
	var peekVal = arr.pop();
	arr.push(peekVal);
	return peekVal;
}

function purge(arr, callback, thisPtr) {
	var result;

	for (var i = 0; i < arr.length; i++) {
		if (callback.call(thisPtr || this, arr[i], i, arr) === true) {
			// Invoke removeAt method if it exists.
			if (arr.removeAt)
				arr.removeAt(i);
			else
				arr.splice(i, 1);

			// Lazy create array and add index (accounting for previously removed).
			if (!result) result = [];
			result.push(i + result.length);

			// Decrement to account for removal.
			i--;
		}
	}

	return result;
}

function reduce(arr, accumlator, initialValue){
	var i = 0, len = arr.length, curr;

	if(typeof(accumlator) !== "function")
		throw new TypeError("First argument is not a function.");

	if(!len && arguments.length <= 2)
		throw new TypeError("Array length is 0 and no intial value was given.");

	if(arguments.length <= 2) {
		if (len === 0)
			throw new TypeError("Empty array and no second argument");

		curr = arr[i++]; // Increase i to start searching the secondly defined element in the array
	}
	else {
		curr = arguments[2];
	}

	for(; i < len; i++) {
		if (i in arr) {
			curr = accumlator.call(undefined, curr, arr[i], i, arr);
		}
	}

	return curr;
}

function remove(arr, item) {
	var idx = arr.indexOf(item);
	if (idx < 0)
		return false;

	arr.splice(idx, 1);
	return true;
}

function removeAt(arr, index) {
	arr.splice(index, 1);
}

function removeRange(arr, index, count) {
	return arr.splice(index, count);
}

function single(arr, callback, thisPtr) {
	var items = filter(arr, callback, thisPtr);

	if (items.length > 1)
		throw new Error("Expected a single item, but found " + items.length + ".");

	if (items.length === 0) {
		throw new Error("Expected a single item, but did not find a match.");
	}

	return items[0];
}

function some(arr, callback, thisPtr) {
	for (var i = 0, len = arr.length; i < len; i++)
		if (i in arr && callback.call(thisPtr || this, arr[i], i, arr))
			return true;

	return false;
}

function update(arr, target/*, trackEvents, equalityFn*/) {
	var source = arr, trackEvents = arguments[2], events = trackEvents ? [] : null, pointer = 0, srcSeek = 0, tgtSeek = 0, equalityFn = arguments[3];

	while (srcSeek < source.length) {
		if (source[srcSeek] === target[tgtSeek]) {
			if (pointer === srcSeek && pointer === tgtSeek) {
				// items match, so advance
				pointer = srcSeek = tgtSeek = pointer + 1;
			}
			else {
				// remove range from source and add range from target
				observableSplice(source, events, pointer, srcSeek - pointer, target.slice(pointer, tgtSeek));

				// reset to index follow target seek location since arrays match up to that point
				pointer = srcSeek = tgtSeek = tgtSeek + 1;
			}
		}
		else if (tgtSeek >= target.length) {
			// reached the end of the target array, so advance the src pointer and test again
			tgtSeek = pointer;
			srcSeek += 1;
		}
		else {
			// advance to the next target item to test
			tgtSeek += 1;
		}
	}

	observableSplice(source, events, pointer, srcSeek - pointer, target.slice(pointer, Math.max(tgtSeek, target.length)));

	return events;
}

if (!Array.prototype.addRange)
	Array.prototype.addRange = function(items) { addRange(this, items); };
if (!Array.prototype.copy)
	Array.prototype.copy = function() { return copy(this); };
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
if (!Array.prototype.fill)
	Array.prototype.fill = function(value, times) { return fill(this, value, times); };
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
if (!Array.prototype.last)
	Array.prototype.last = function(fun/*, thisp */) { return last(this, fun, arguments[1]); };
if (!Array.prototype.lastIndexOf)
	Array.prototype.lastIndexOf = function (item/*, from*/) { return lastIndexOf(this, item, arguments[1]); };
if (!Array.prototype.map)
	Array.prototype.map = function(fun /*, thisp*/) { return map(this, fun, arguments[1]); };
if (!Array.prototype.mapToArray)
	Array.prototype.mapToArray = function(fun/*, thisp*/) { return mapToArray(this, fun, arguments[1]); };
if (!Array.prototype.peek)
	Array.prototype.peek = function() { return peek(this); };
if (!Array.prototype.purge)
	Array.prototype.purge = function(fun/*, thisp*/) { return purge(this, fun, arguments[1]); };
if (!Array.prototype.reduce)
	Array.prototype.reduce = function(accumulator, intialValue) { return reduce(this, accumulator, intialValue); };
if (!Array.prototype.remove)
	Array.prototype.remove = function(item) { return remove(this, item); };
if (!Array.prototype.single)
	Array.prototype.single = function(fun/*, thisp */) { return single(this, fun, arguments[1]); };
if (!Array.prototype.some)
	Array.prototype.some = function(fun /*, thisp*/) { return some(this, fun, arguments[1]); };

exports.contains = contains; // IGNORE
exports.distinct = distinct; // IGNORE
exports.every = every; // IGNORE
exports.filter = filter; // IGNORE
exports.first = first; // IGNORE
exports.forEach = forEach; // IGNORE
exports.indexOf = indexOf; // IGNORE
exports.insert = insert; // IGNORE
exports.insertRange = insertRange; // IGNORE
exports.intersect = intersect; // IGNORE
exports.last = last; // IGNORE
exports.lastIndexOf = lastIndexOf; // IGNORE
exports.map = map; // IGNORE
exports.mapToArray = mapToArray; // IGNORE
exports.peek = peek; // IGNORE
exports.purge = purge; // IGNORE
exports.remove = remove; // IGNORE
exports.removeAt = removeAt; // IGNORE
exports.removeRange = removeRange; // IGNORE
exports.reduce = reduce; // IGNORE
exports.single = single; // IGNORE
exports.some = some; // IGNORE
exports.update = update; // IGNORE
