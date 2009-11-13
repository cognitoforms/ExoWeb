
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

				if (!meta)
					continue;

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
		return Sys.Binding.getElementBindings(this.get(0));
	}


	var renderedRegs = [];

	var instantiateInBase = Sys.UI.Template.prototype.instantiateIn;
	Sys.UI.Template.prototype.instantiateIn = function(containerElement, data, dataItem, dataIndex, nodeToInsertTemplateBefore, parentContext) {
		var ret = instantiateInBase.apply(this, arguments);

		// rebind validation events
		for (var e = 0; e < ret.nodes.length; ++e) {
			var newElement = ret.nodes[e];

			for (var i = 0; i < renderedRegs.length; ++i) {
				var reg = renderedRegs[i];

				if ($(newElement).is(reg.selector)) {
					reg.handler.apply(newElement, [containerElement]);
				}
			}
		}

		return ret;
	}


	jQuery.fn.rendered = function(f) {
		renderedRegs.push({
			selector: this.selector,
			context: this.context,
			handler: f
		});

		return this;
	}
})();
