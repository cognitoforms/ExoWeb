var isError = function (condition) {
	return condition.type instanceof ExoWeb.Model.ConditionType.Error;
};

var isValidationCondition = function (condition) {
	return condition.type instanceof ExoWeb.Model.ConditionType.Error || condition.type instanceof ExoWeb.Model.ConditionType.Warning;
};

var ensureInited = function ($el) {
	if (!window.ExoWeb) {
		return;
	}

	if ($el.attr("__validating") === undefined) {
		// register for model validation events
		var bindings = $el.liveBindings();

		for (var i = 0; i < bindings.length; i++) {
			var binding = bindings[i];
			var srcObj = ExoWeb.View.getFinalSrcObject(binding);
			var propName = ExoWeb.View.getFinalPathStep(binding);

			var meta = srcObj.meta || srcObj;

			if (meta instanceof ExoWeb.Model.ObjectMeta) {
				var property = meta.type.property(propName);
				meta.addConditionsChanged(function (sender, args) {
					if (isValidationCondition(args.conditionTarget.condition)) {
						$el.trigger("validated", [meta.conditions(property)]);
					}
				}, property);
			}
			else if (meta && meta.get_conditions) {
				var conditions = meta.get_conditions();
				ExoWeb.Observer.addCollectionChanged(conditions, function (sender, args) {
					$el.trigger("validated", [conditions.filter(isValidationCondition)]);
				});
			}
		}

		// don't double register for events
		$el.attr("__validating", true);
	}
};

jQuery.fn.validated = function (f) {
	this.each(function () {
		jQuery(this).bind('validated', f);
		ensureInited(jQuery(this));
	});

	return this;
};

// Gets all model rules associated with the property an element is bound to
jQuery.fn.rules = function (ruleType) {
	if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

	return jQuery(this).liveBindings()
		.map(function(binding) {
			return ExoWeb.View.getBindingInfo(binding);
		}).filter(function(info) {
			return !!info.property;
		}).map(function(info) {
			return info.property.rule(ruleType);
		});
};

jQuery.fn.errors = function () {
	if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

	return jQuery(this).liveBindings().mapToArray(function (binding) {

		var source = binding.get_source();
		if (source instanceof ExoWeb.View.Adapter) {
			return source.get_conditions().filter(isError);
		}
		else {
			var info = ExoWeb.View.getBindingInfo(binding);

			// Guard against null/undefined target.  This could happen if the target is 
			// undefined, or if the path is multi-hop, and the full path is not defined.
			if (!info.target || !info.property) return [];

			return info.target.meta.conditions(info.property).filter(isError);
		}
	});
};
