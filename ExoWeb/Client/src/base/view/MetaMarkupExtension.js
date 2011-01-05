Sys.Application.registerMarkupExtension(
	"#",
	function(component, targetProperty, templateContext, properties) {
		var options = Sys._merge({
			source: templateContext.dataItem,
			templateContext: templateContext,
			target: component,
			targetProperty: targetProperty
		}, properties);
		
		
		options.path = options.path || options.$default;
		delete options.$default;

		var element = null;
		if (Sys.Component.isInstanceOfType(component)) {
			element = component.get_element();
		}
		else if (Sys.UI.DomElement.isDomElement(component)) {
			element = component;
		}

		var adapter = new Adapter(options.source || templateContext.dataItem, options.path, options.systemFormat, options.displayFormat, properties);
		options.source = adapter;
		options.path = element.nodeName == "SELECT" ? "systemValue" : "displayValue";

		var binding = Sys.Binding.bind(options);
		templateContext.components.push(binding);
	},
	false);
