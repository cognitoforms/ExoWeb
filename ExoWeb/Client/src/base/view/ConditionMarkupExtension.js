Sys.Application.registerMarkupExtension("?",
	function(component, targetProperty, templateContext, properties) {
		var options = Sys._merge({
			source: templateContext.dataItem,
			templateContext: templateContext,
			targetProperty: targetProperty
		}, properties);

		var meta = options.source.meta;
		
		options.type = options.type || options.$default;
		delete options.$default;

		options.single = options.single === true || options.single.toString().toLowerCase() === "true";

		var types = options.type ? options.type.split(",") : null;

		var sets = options.set ? options.set.split(",") : null;

		var target = options.target;
		options.target = target && function() {
			if (target.constructor === String)
				return evalPath(options.source, target);
			return target;
		};

		function updateConditions() {
			var conditions = meta.conditions().where(function(c) {
				return (!types || types.indexOf(c.get_type().get_code()) >= 0) && // check for type code match (if specified)
					(!sets || intersect(sets, c.get_type().get_sets().map(function(s) { return s.get_name(); })).length > 0) && // check for set code match (if specified)
					(!options.target || c.get_targets().where(function(t) { return t.get_entity() === options.target(); }).length > 0); // check for target (if specified)
			});

			if (options.single === true) {
				if (conditions.length > 1) {
					ExoWeb.trace.throwAndLog("?", "Multiple conditions were found for type \"{0}\".", [options.type]);
				}

				conditions = conditions.length === 0 ? null : conditions[0];
			}

			Sys.Observer.setValue(component, properties.targetProperty || targetProperty, conditions);
		}

		updateConditions();
		meta.addConditionsChanged(updateConditions, meta);
	},
	false);
