Sys.Application.registerMarkupExtension("?",
	function (component, targetProperty, templateContext, properties) {
		var options = Sys._merge({
			source: templateContext.dataItem,
			templateContext: templateContext,
			targetProperty: targetProperty
		}, properties);

		var meta = options.source.meta;

		options.type = options.type || options.$default;
		delete options.$default;

		options.single = options.single && (options.single === true || options.single.toString().toLowerCase() === "true");

		var types = options.type ? options.type.split(",") : null;

		var sets = options.set ? options.set.split(",") : null;

		var target = function () {
			if (options.target && options.target.constructor === String)
				return evalPath(options.source, options.target);
			return options.target;
		};

		function updateConditions() {
			var currentTarget = target();
			var conditions = meta.conditions().filter(function (c) {
				return (!types || types.indexOf(c.type.code) >= 0) && // check for type code match (if specified)
					(!sets || intersect(sets, c.type.sets.map(function (s) { return s.name; })).length > 0) && // check for set code match (if specified)
					(!target || c.targets.some(function (t) { return t.target === currentTarget; })); // check for target (if specified)
			});

			if (options.single === true) {
				if (conditions.length > 1) {
					ExoWeb.trace.throwAndLog("?", "Multiple conditions were found for type \"{0}\".", [options.type]);
				}

				conditions = conditions.length === 0 ? null : conditions[0];
			}

			Observer.setValue(component, properties.targetProperty || targetProperty, conditions);
		}

		updateConditions();
		meta.addConditionsChanged(updateConditions, meta);
	},
	false);
