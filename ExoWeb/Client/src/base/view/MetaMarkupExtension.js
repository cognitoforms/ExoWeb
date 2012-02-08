Sys.Application.registerMarkupExtension(
	"#",
	function MetaMarkupExtension(component, targetProperty, templateContext, properties) {
		if (properties.required) {
			ExoWeb.trace.logWarning(["@", "markupExt"], "Meta markup extension does not support the \"required\" property.");
		}

		var options, element;

		if (Sys.Component.isInstanceOfType(component)) {
			element = component.get_element();
		}
		else if (Sys.UI.DomElement.isDomElement(component)) {
			element = component;
		}

		options = Sys._merge({
			source: templateContext.dataItem,
			templateContext: templateContext,
			target: component,
			targetProperty: targetProperty,
			property: element.nodeName === "SELECT" ? "systemValue" : "displayValue"
		}, properties);

		options.path = options.path || options.$default;
		delete options.$default;

		options.source = new Adapter(options.source || templateContext.dataItem, options.path, options.format, properties);

		options.path = options.property;
		delete options.property;

		templateContext.components.push(Sys.Binding.bind(options));
	},
	false
);
