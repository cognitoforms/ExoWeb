// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
function getFinalSrcObject(binding) {
	var src = binding.get_source();

	for (var i = 0; i < binding._pathArray.length - 1; ++i) {
		src = src[binding._pathArray[i]] || src["get_" + binding._pathArray[i]]();
	}

	return src;
}

function getFinalPathStep(binding) {
	return binding._pathArray[binding._pathArray.length - 1];
}

var ensureInited = function ($el) {
	if (!window.ExoWeb) {
		return;
	}

	if ($el.attr("__validating") === undefined) {
		// register for model validation events
		var bindings = $el.liveBindings();

		for (var i = 0; i < bindings.length; i++) {
			var binding = bindings[i];
			var srcObj = getFinalSrcObject(binding);
			var propName = getFinalPathStep(binding);

			var meta = srcObj.meta || srcObj;

			if (meta && meta.addPropertyValidating) {
				// wire up validating/validated events
				meta.addPropertyValidating(propName, function (sender, issues) {
					$el.trigger('validating');
				});
			}

			if (meta && meta.addPropertyValidated) {
				meta.addPropertyValidated(propName, function (sender, issues) {
					$el.trigger("validated", [issues]);
				});
			}
		}

		// don't double register for events
		$el.attr("__validating", true);
	}
};

jQuery.fn.validated = function (f) {
	this.each(function () {
		$(this).bind('validated', f);
		ensureInited($(this));
	});

	return this;
};

jQuery.fn.validating = function (f) {
	this.each(function () {
		$(this).bind("validating", f);
		ensureInited($(this));
	});

	return this;
};

// Gets all model rules associated with the property an element is bound to
jQuery.fn.rules = function (ruleType) {
	if (!(window.ExoWeb && ExoWeb.Model)) {
		return [];
	}

	var rules = [];
	var bindings = $(this).liveBindings();

	for (var i = 0; i < bindings.length; i++) {
		var binding = bindings[i];
		var srcObj = getFinalSrcObject(binding);

		var prop;

		if (srcObj instanceof ExoWeb.View.Adapter) {
			prop = srcObj.get_propertyChain().lastProperty();
		}
		else if (srcObj instanceof ExoWeb.View.OptionAdapter) {
			prop = srcObj.get_parent().get_propertyChain().lastProperty();
		}
		else if (srcObj instanceof ExoWeb.Model.Entity) {
			var propName = getFinalPathStep(binding);
			prop = srcObj.meta.property(propName);
		}
		else {
			continue;
		}

		var rule = prop.rule(ruleType);
		if (rule) {
			rules.push(rule);
		}
	}

	return rules;
};

jQuery.fn.issues = function (options) {
	var issues = [];

	options = options || { refresh: false };

	var bindings = $(this).liveBindings();

	for (var i = 0; i < bindings.length; i++) {
		var binding = bindings[i];
		var srcObj = getFinalSrcObject(binding);

		var target;
		var prop;

		// Option adapter defers to parent adapter
		if (srcObj instanceof ExoWeb.View.OptionAdapter) {
			srcObj = srcObj.get_parent();
		}

		if (srcObj instanceof ExoWeb.View.Adapter) {
			var chain = srcObj.get_propertyChain();
			prop = chain.lastProperty();
			target = chain.lastTarget(srcObj.get_target());

			// Guard against null/undefined target.  This could happen if the target is 
			// undefined, or if the path is multi-hop, and the full path is not defined.
			if (target === null || target === undefined) {
				continue;
			}
		}
		else if (srcObj instanceof ExoWeb.Model.Entity) {
			var propName = getFinalPathStep(binding);
			prop = srcObj.meta.property(propName);
			target = srcObj;
		}
		else {
			continue;
		}

		if (options.refresh)
			target.meta.executeRules(prop);

		Array.addRange(issues, target.meta.conditions(prop));
	}
	return issues;
};
