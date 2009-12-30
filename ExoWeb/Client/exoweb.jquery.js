
(function() {
	//////////////////////////////////////////////////////////////////////////////////////
	// validation events
	var ensureInited = function($el) {
		if (typeof ($el.attr("__validating")) == "undefined") {
			// register for model validation events
			var bindings = $el.liveBindings();

			for (var i = 0; i < bindings.length; i++) {
				var binding = bindings[i];
				var srcObj = Sys_Binding_getFinalSourceObject(binding);
				var propName = Sys_Binding_getFinalPath(binding);

				var meta = srcObj.meta || srcObj;

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

	//////////////////////////////////////////////////////////////////////////////////////
	// selectors for rules

	jQuery.expr[":"].rule = function(obj, index, meta, stack) {
		var ruleName = meta[3];
		var ruleType = ExoWeb.Model.Rule[ruleName];

		if (!ruleType)
			ExoWeb.trace.throwAndLog(["ui", "jquery"], "Unknown rule in selector: " + ruleName);

		return $(obj).rules(ruleType).length > 0;
	};

	jQuery.expr[":"].bound = function(obj, index, meta, stack) {
		return $(obj).liveBindings().length > 0;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	// helpers for MS AJAX and model integration
	var everRegs = [];

	var instantiateInBase = Sys.UI.Template.prototype.instantiateIn;
	Sys.UI.Template.prototype.instantiateIn = function(containerElement, data, dataItem, dataIndex, nodeToInsertTemplateBefore, parentContext) {
		var ret = instantiateInBase.apply(this, arguments);

		// rebind validation events
		for (var e = 0; e < ret.nodes.length; ++e) {
			var newElement = ret.nodes[e];

			for (var i = 0; i < everRegs.length; ++i) {
				var reg = everRegs[i];

				// test root
				if ($(newElement).is(reg.selector))
					reg.handler.apply(newElement);

				// test children
				$(reg.selector, newElement).each(reg.handler);
			}
		}

		return ret;
	}

	// matches elements as they are dynamically added to the DOM
	jQuery.fn.ever = function(f) {
		// apply now
		this.each(f);

		// and then watch for dom changes
		everRegs.push({
			selector: this.selector,
			context: this.context,
			handler: f
		});

		return this;
	}

	// Gets all Sys.Bindings for an element
	jQuery.fn.liveBindings = function() {
		return this.get(0).__msajaxbindings || [];
	}

	// Gets all model rules associated with the property an element is bound to
	jQuery.fn.rules = function(ruleType) {
		var rules = [];
		var bindings = $(this).liveBindings();

		for (var i = 0; i < bindings.length; i++) {
			var binding = bindings[i];
			var srcObj = Sys_Binding_getFinalSourceObject(binding);

			var prop;

			if (srcObj instanceof ExoWeb.View.Adapter) {
				prop = srcObj.get_propertyChain().lastProperty();
			}
			else if (srcObj instanceof ExoWeb.View.OptionAdapter) {
				prop = srcObj.get_parent().get_propertyChain().lastProperty();
			}
			else if (srcObj instanceof ExoWeb.Model.ObjectBase) {
				var propName = Sys_Binding_getFinalPath(binding);
				prop = srcObj.meta.property(propName);
			}
			else
				continue;

			var rule = prop.rule(ruleType);
			if (rule)
				rules.push(rule);
		}

		return rules;
	}

	// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
	function Sys_Binding_getFinalSourceObject(binding){
		var src = binding.get_source();

		for (var i = 0; i < binding._pathArray.length - 1; ++i)
			src = src[binding._pathArray[i]];

		return src;
	}
	
	function Sys_Binding_getFinalPath(binding){
		return binding._pathArray[binding._pathArray.length - 1];
	}
	
})();
