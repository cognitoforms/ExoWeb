var bindingSetters = [];
var setterExpr = /^set_(.*)$/;
ExoWeb.eachProp(Sys.Binding.prototype, function(prop) {
	var name = setterExpr.exec(prop);
	if (name) {
		bindingSetters.push(name[1]);
	}
});

Sys.Application.registerMarkupExtension(
	"#",
	function MetaMarkupExtension(component, targetProperty, templateContext, properties) {
		if (properties.required) {
			ExoWeb.trace.logWarning(["#", "markupExt"], "Meta markup extension does not support the \"required\" property.");
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

		delete properties.$default;

		// remove properties that apply to the binding
		for (var p in properties) {
			if (properties.hasOwnProperty(p)) {
				if (bindingSetters.indexOf(p) >= 0) {
					delete properties[p];
				}
			}
		}

		options.path = options.path || options.$default;
		delete options.$default;

		var adapter = options.source = new Adapter(options.source || templateContext.dataItem, options.path, options.format, properties);

		options.path = options.property;
		delete options.property;
		
		templateContext.components.push(adapter);
		templateContext.components.push(Sys.Binding.bind(options));
	},
	false
);
