function PathTokens(expression) {
	
	// legacy: remove "this." prefix from instance properties
	if (expression.substr(0, 5) === "this.")
		expression = expression.substr(5);

	this.expression = expression;

	// replace "." in type casts so that they do not interfere with splitting path
	expression = expression.replace(/<[^>]*>/ig, function(e) { return e.replace(/\./ig, function() { return "$_$"; }); });

	if (expression.length > 0) {
		this.steps = expression.split(".").map(function(step) {
			var parsed = step.match(/^([a-z0-9_]+)(<([a-z0-9_$]+)>)?$/i);

			if (!parsed) {
				return null;
			}

			var result = { property: parsed[1] };

			if (parsed[3]) {
				// restore "." in type case expression
				result.cast = parsed[3].replace(/\$_\$/ig, function() { return "."; });
			}

			return result;
		});
	}
	else {
		this.steps = [];
	}
}

PathTokens.normalizePaths = function PathTokens$normalizePaths(paths) {
	var result = [];

	if (paths) {
		paths.forEach(function (p) {

			// coerce property and property chains into string paths
			p = p instanceof Property ? p.get_name() :
				p instanceof PropertyChain ? p.get_path() :
				p;

			var stack = [];
			var parent;
			var start = 0;
			var pLen = p.length;

			for (var i = 0; i < pLen; ++i) {
				var c = p.charAt(i);

				if (c === '{' || c === ',' || c === '}') {
					var seg = p.substring(start, i).trim();
					start = i + 1;

					if (c === '{') {
						if (parent) {
							stack.push(parent);
							parent += "." + seg;
						}
						else {
							parent = seg;
						}
					}
					else {   // ',' or '}'
						if (seg.length > 0) {
							result.push(new PathTokens(parent ? parent + "." + seg : seg));
						}

						if (c === '}') {
							parent = (stack.length === 0) ? undefined : stack.pop();
						}
					}
				}
			}

			if (stack.length > 0) {
				ExoWeb.trace.throwAndLog("model", "Unclosed '{' in path: {0}", [p]);
			}

			if (start === 0) {
				result.push(new PathTokens(p.trim()));
			}
		});
	}
	return result;
};

PathTokens.mixin({
	buildExpression: function PathTokens$buildExpression() {
		var path = "";
		this.steps.forEach(function(step) {
			path += (path ? "." : "") + step.property + (step.cast ? "<" + step.cast + ">" : "");
		});
		return path;
	},
	toString: function PathTokens$toString() {
		return this.expression;
	}
});

exports.PathTokens = PathTokens;
