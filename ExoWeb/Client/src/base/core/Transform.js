function Transform(array) {
	if (array === null || array === undefined) {
		ExoWeb.trace.throwAndLog("transform", "Transform input is required.");
	}
	if (!(array instanceof Array)) {
		ExoWeb.trace.throwAndLog("transform", "Transform input must be an array.");
	}

	this._array = array;
}

var compileFilterFunction = (function Transform$compileFilterFunction(filter) {
	var parser = /(([a-z_$][0-9a-z_$]*)([.]?))|(('([^']|\')*')|("([^"]|\")*"))/gi;
	var skipWords = ["true", "false", "$index", "null"];

	filter = filter.replace(parser, function(match, ignored, name, more, strLiteral) {
		if ((strLiteral !== undefined && strLiteral !== null && strLiteral.length > 0) || skipWords.indexOf(name) >= 0) {
			return match;
		}

		if (name === "$item") {
			return more ? "" : name;
		}

		if (more.length > 0) {
			return "get('" + name + "')" + more;
		}

		return "get('" + name + "').value";
	});

	return new Function("$item", "$index", "with(new ExoWeb.EvalWrapper($item)){ return (" + filter + ");}");
}).cached();

var compileGroupsFunction = (function Transform$compileGroupsFunction(groups) {
	return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + groups + "');");
}).cached();

var compileOrderingFunction = (function Transform$compileOrderingFunction(ordering) {
	var orderings = [];
	var parser = /\s*([a-z0-9_.]+)(\s+null)?(\s+(asc|desc))?(\s+null)? *(,|$)/gi;

	ordering.replace(parser, function(match, path, nullsFirst, ws, dir, nullsLast) {
		var isNullsFirst = (nullsFirst !== undefined && nullsFirst !== null && nullsFirst.length > 0);
		var isNullsLast = (nullsLast !== undefined && nullsLast !== null && nullsLast.length > 0);
		orderings.push({
			path: path,
			ab: dir === "desc" ? 1 : -1,
			nulls: isNullsLast || (!ws && isNullsFirst) ? 1 : -1
		});
	});

	function before(a, b) {
		if (a !== null && a !== undefined && a.constructor === String && b !== null && b !== undefined && b.constructor === String) {
			a = a.toLowerCase();
			b = b.toLowerCase();
		}
		return a < b;
	}

	return function compare(aObj, bObj) {
		for (var i = 0; i < orderings.length; ++i) {
			var order = orderings[i];

			var a = evalPath(aObj, order.path, null, null);
			var b = evalPath(bObj, order.path, null, null);

			if (a === null && b !== null) {
				return order.nulls;
			}
			if (a !== null && b === null) {
				return -order.nulls;
			}
			if (before(a, b)) {
				return order.ab;
			}
			if (before(b, a)) {
				return -order.ab;
			}
		}

		return 0;
	};
}).cached();

function makeTransform(array, priorTransform, fn, args) {
	Function.mixin(Transform.prototype, array);
	array._prior = priorTransform;
	array._transform = { fn: fn, args: args };
	return array;
}

function updateTransformGroupItems(oldList, newList, nesting) {
	var i, oldGroup, newGroup, oldItems, newItems;
	if (nesting === 0) {
		// when nesting is zero the items are no longer groups themselves.
		update(oldList, newList);
	}
	else {
		// recursively update items as groups
		for (i = 0; i < newList.length; i++) {
			newGroup = newList[i];
			oldGroup = oldList.filter(function(g) { return g.group === newGroup.group; })[0];
			if (oldGroup) {
				updateTransformGroupItems(oldGroup.items, newGroup.items, nesting - 1);
			}
			else {
				Sys.Observer.makeObservable(newGroup.items);
			}
		}
		// Update at the group level
		update(oldList, newList, false, function (a, b) {
			return a && b && a.group === b.group;
		});
	}
}

Transform.mixin({
	input: function Transform$input() {
		return this._array || this;
	},
	where: function Transform$where(filter, thisPtr) {
		var filterFn = filter instanceof Function ? filter : compileFilterFunction(filter);
		var output = this.input().filter(filterFn, thisPtr);
		return makeTransform(output, this, this.where, arguments);
	},
	groupBy: function Transform$groupBy(groups, thisPtr) {
		var groupFn = groups instanceof Function ? groups : compileGroupsFunction(groups);

		var output = [];
		var input = this.input();
		var len = input.length;
		for (var i = 0; i < len; i++) {
			var item = input[i];
			var groupKey = groupFn.apply(thisPtr || item, [item, i]);

			var group = null;
			for (var g = 0; g < output.length; ++g) {
				if (output[g].group == groupKey) {
					group = output[g];
					group.items.push(item);
					break;
				}
			}

			if (!group) {
				output.push({ group: groupKey, items: [item] });
			}
		}

		return makeTransform(output, this, this.groupBy, arguments);
	},
	orderBy: function Transform$orderBy(ordering, thisPtr) {
		var sortFn = ordering instanceof Function ? ordering : compileOrderingFunction(ordering);
		var output = this.input().copy().sort(thisPtr ? sortFn.bind(thisPtr) : sortFn);
		return makeTransform(output, this, this.orderBy, arguments);
	},
	live: function Transform$live() {
		// Watches for changes on the root input into the transform
		// and raises observable change events on this item as the 
		// results change.

		// make a copy of the transform data and make it observable
		var output = this.copy();
		Sys.Observer.makeObservable(output);

		// determine the set of transform steps
		// also determine the level of group nesting and make each group's items collection observable
		var chain = [];
		var groupCount = 0;
		var observableSource = output;
		for (var step = this; step; step = step._prior) {
			chain.splice(0, 0, step);
			if (step._transform && step._transform.fn === Transform.prototype.groupBy) {
				groupCount++;
				// make each group's items collection observable
				observableSource.forEach(function(item) { Sys.Observer.makeObservable(item.items); });
				// the new observable source is all of the items collections of the current observable source
				observableSource = observableSource.mapToArray(function(item) { return item.items; });
			}
		}

		// watch for changes to root input and rerun transform chain as needed
		Sys.Observer.addCollectionChanged(chain[0].input(), function Transform$live$collectionChanged() {
			// re-run the transform on the newly changed input
			var newResult = $transform(chain[0].input());
			for (var i = 1; i < chain.length; ++i) {
				var step = chain[i];
				newResult = step._transform.fn.apply(newResult, step._transform.args);
			}

			// apply the changes to the output.
			// must use the original list so that the events can be seen
			output.beginUpdate();
			if (groupCount > 0) {
				updateTransformGroupItems(output, newResult, groupCount);
			}
			else {
				update(output, newResult);
			}
			output.endUpdate();
		});

		return output;
	}
});

exports.Transform = Transform;
window.$transform = function transform(array) { return new Transform(array); };
