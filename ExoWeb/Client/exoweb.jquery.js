
//////////////////////////////////////////////////////////////////////////////////////
// jquery validation plugin
(function() {
	var ensureInited = function($el) {
		if (typeof ($el.attr("__validating")) == "undefined") {
			// register for model validation events
			var bindings = $el.liveBindings();

			for (var i = 0; i < bindings.length; i++) {
				var binding = bindings[i];
				var srcObj = binding.get_finalSourceObject();
				var propName = binding.get_finalPath();

				var meta = (srcObj instanceof ExoWeb.Model.Adapter) ? srcObj : srcObj.meta;

				// wire up validating/validated events
				meta.addPropertyValidating(propName, function(sender, issues) {
					$el.trigger('validating');
				});

				meta.addPropertyValidated(propName, function(sender, issues) {
					$el.trigger("validated", [issues]);
				});
			}

			// don't double register for events
			$el.attr("__validating", true);
		}
	}
	
	jQuery.fn.validated = function(f) {
		this.each(function() {
			$(this).bind('validated', f);
			ensureInited($(this));
		});

		return this;
	}

	jQuery.fn.validating = function(f) {
		this.each(function() {
			$(this).bind("validating", f);
			ensureInited($(this));
		});

		return this;
	}

	jQuery.fn.liveBindings = function() {
		return ExoWebBinding.getElementBindings(this.get(0));
	}

})();
