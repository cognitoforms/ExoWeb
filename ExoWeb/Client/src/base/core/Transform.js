function Transform(root) {
	this.array = root;
}

function Transform$compileFilterFunction(filter) {
	var parser = /(([a-z_$][0-9a-z_$]*)([.]?))|(('([^']|\')*')|("([^"]|\")*"))/gi;
	var skipWords = ["true", "false", "$index", "null"];

	filter = filter.replace(parser, function(match, ignored, name, more, strLiteral) {
		if ((strLiteral !== undefined && strLiteral !== null && strLiteral.length > 0) || skipWords.indexOf(name) >= 0) {
			return match;
		}

		if (name === "$item") {
			return "";
		}

		if (more.length > 0) {
			return "get('" + name + "')" + more;
		}

		return "get('" + name + "').value";
	});

	return new Function("$item", "$index", "with(new ExoWeb.EvalWrapper($item)){ return (" + filter + ");}");
}

var compileFilterFunction = Transform$compileFilterFunction.cached({ key: function(filter) { return filter; } });

function Transform$compileGroupsFunction(groups) {
	return new Function("$item", "$index", "return ExoWeb.evalPath($item, '" + groups + "');");
}

var compileGroupsFunction = Transform$compileGroupsFunction.cached({ key: function(groups) { return groups; } });

function Transform$compileOrderingFunction(ordering) {
	var orderings = [];
	var parser = / *([a-z0-9_.]+)( +null)?( +(asc|desc))?( +null)? *(,|$)/gi;

	ordering.replace(parser, function(match, path, nullsFirst, ws, dir, nullsLast) {
		orderings.push({
			path: path,
			ab: dir === "desc" ? 1 : -1,
			nulls: (nullsLast !== undefined && nullsLast !== null && nullsLast.length > 0) ? 1 : -1
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
}

var compileOrderingFunction = Transform$compileOrderingFunction.cached({ key: function(ordering) { return ordering; } });

Transform.mixin({
	_next: function Transform$_next(fn, args, output) {
		Function.mixin(Transform.prototype, output);
		output.prior = this;
		output.transform = { fn: fn, args: args };
		return output;
	},
	input: function Transform$input() {
		return this.array || this;
	},
	where: function Transform$where(filter, thisPtr) {
		if (!(filter instanceof Function)) {
			filter = compileFilterFunction(filter);
		}

		var output = [];

		var input = this.input();

		var len = input.length;
		for (var i = 0; i < len; ++i) {
			var item = input[i];

			if (filter.apply(thisPtr || item, [item, i])) {
				output.push(item);
			}
		}

		return this._next(this.where, arguments, output);
	},
	groupBy: function Transform$groupBy(groups, thisPtr) {
		if (!(groups instanceof Function)) {
			groups = compileGroupsFunction(groups);
		}

		var output = [];

		var input = this.input();
		var len = input.length;
		for (var i = 0; i < len; i++) {
			var item = input[i];
			var groupKey = groups.apply(thisPtr || item, [item, i]);

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
		return this._next(this.groupBy, arguments, output);
	},
	orderBy: function Transform$orderBy(ordering, thisPtr) {
		if (!(ordering instanceof Function)) {
			ordering = compileOrderingFunction(ordering);
		}

		var input = this.input();
		var output = new Array(input.length);

		// make new array
		var len = input.length;
		for (var i = 0; i < len; i++) {
			output[i] = input[i];
		}

		// sort array in place
		if (!thisPtr) {
			output.sort(ordering);
		}
		else {
			output.sort(function() { return ordering.apply(thisPtr, arguments); });
		}

		return this._next(this.orderBy, arguments, output);
	},
	// Watches for changes on the root input into the transform
	// and raises observable change events on this item as the 
	// results change.
	live: function Transform$live() {
		var chain = [];
		for (var step = this; step; step = step.prior) {
			Array.insert(chain, 0, step);
		}

		// make a new observable array
		var input = this.input();
		var output = Sys.Observer.makeObservable(new Array(input.length));

		var len = input.length;
		for (var i = 0; i < len; i++) {
			output[i] = input[i];
		}

		// watch for changes to root input and rerun transform chain as needed
		Sys.Observer.addCollectionChanged(chain[0].input(), function Transform$live$collectionChanged() {
			// re-run the transform on the newly changed input
			var newResult = $transform(chain[0].input());

			for (var i = 1; i < chain.length; ++i) {
				var step = chain[i];
				newResult = step.transform.fn.apply(newResult, step.transform.args);
			}

			// apply the changes to the output.
			// must use the original list so that the events can be seen
			output.beginUpdate();
			output.clear();
			Array.addRange(output, newResult);
			output.endUpdate();
		});

		return this._next(this.live, arguments, output);
	}
});

exports.Transform = Transform;
window.$transform = function transform(array) { return new Transform(array); };
