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
	if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

	return $(this).liveBindings()
		.map(function(binding) {
			return ExoWeb.View.getBindingInfo(binding);
		}).filter(function(info) {
			return !!info.property;
		}).map(function(info) {
			return info.property.rule(ruleType);
		});
};

jQuery.fn.issues = function (options) {
	if (!window.Sys || !window.ExoWeb || !ExoWeb.Model) return [];

	options = options || { refresh: false };

	return $(this).liveBindings().mapToArray(function(binding) {
		var info = ExoWeb.View.getBindingInfo(binding);
		
		// Guard against null/undefined target.  This could happen if the target is 
		// undefined, or if the path is multi-hop, and the full path is not defined.
		if (!info.target || !info.property) return [];

		if (options.refresh)
			info.target.meta.executeRules(info.property);
		else if (options.ensure)
			info.target.meta.ensureValidation(info.property);

		return info.target.meta.conditions({ property: info.property });
	});
};
