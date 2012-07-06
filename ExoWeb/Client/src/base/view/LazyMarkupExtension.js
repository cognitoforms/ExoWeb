Sys.Application.registerMarkupExtension(
	"~",
	function LazyMarkupExtension(component, targetProperty, templateContext, properties) {
		var source;
		var scopeChain;
		var path = properties.path || properties.$default || null;

		// if a source is specified and it is a string, then execute the source as a JavaScript expression
		if (properties.source) {
			if (properties.source.constructor === String) {
				// create a function to evaluate the binding source from the given string
				var evalSource = new Function("$element", "$index", "$dataItem", "$context", "return " + properties.source + ";");

				// get the relevant html element either as the component or the component's target element
				var element = null;
				if (Sys.Component.isInstanceOfType(component)) {
					element = component.get_element();
				}
				else if (Sys.UI.DomElement.isDomElement(component)) {
					element = component;
				}

				// evaluate the value of the expression
				source = evalSource(element, templateContext.index, templateContext.dataItem, templateContext);

				// don't try to eval the path against window
				scopeChain = [];
			}
			else {
				source = properties.source;
			}
		}
		else if (templateContext.dataItem) {
			source = templateContext.dataItem;
		}
		else {
			// No context data, so path must be global
			source = window;
			scopeChain = [];
		}

		// Build an options object that represents only the options that the binding
		// expects, and only if they were specified in the markup extension
		var options = {};
		if (properties.hasOwnProperty("required")) {
			options.required = properties.required;
		}
		if (properties.hasOwnProperty("transform")) {
			options.transform = properties.transform;
		}
		if (properties.hasOwnProperty("format")) {
			options.format = properties.format;
		}
		if (properties.hasOwnProperty("nullValue")) {
			options.nullValue = properties.nullValue;
		}

		// Construct the new binding class
		var binding = new Binding(templateContext, source, path, component, properties.targetProperty || targetProperty, options, scopeChain);

		// register with the template context as a child component
		templateContext.components.push(binding);
	},
	false
);
