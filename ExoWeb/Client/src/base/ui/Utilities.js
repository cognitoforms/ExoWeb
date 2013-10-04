function getTemplateSubContainer(childElement) {
	var element = childElement;

	function isDataViewOrContent(el) {
		return (el.control && el.control instanceof Sys.UI.DataView) ||
			(el.control && el.control instanceof ExoWeb.UI.Content);
	}

	// find the first parent that has an attached ASP.NET Ajax dataview or ExoWeb content control (ignore toggle)
	while (element.parentNode && !isDataViewOrContent(element.parentNode)) {
		element = element.parentNode;
	}

	// containing template was not found
	if (element.parentNode && isDataViewOrContent(element.parentNode)) {
		return element;
	}
}

function getDataForContainer(container, subcontainer, index) {
	var data = null;

	if (container) {
		if (container.control instanceof Sys.UI.DataView || container.control instanceof ExoWeb.UI.Content) {
			var containerContexts = container.control.get_contexts();
			var containerData = container.control.get_data();

			// ensure an array for conformity
			if (!(containerData instanceof Array)) {
				containerData = [containerData];
			}

			if (containerContexts) {
				// if there is only one context in the array then the index must be zero
				if (containerContexts.length == 1) {
					index = 0;
				}

				if (index !== undefined && index !== null && index.constructor === Number) {
					if (index < containerContexts.length) {
						var indexedContext = containerContexts[index];
						var indexedData = containerData[index];
						data = (indexedContext) ? indexedContext.dataItem : indexedData;
					}
				}
				else {
					// try to find the right context based on the element's position in the dom
					for (var i = 0, l = containerContexts.length; i < l; i++) {
						var childContext = containerContexts[i];
						if (!childContext) {
							var contextsFromDom = map(container.children, function(e) { return Sys.UI.Template.findContext(e.firstChild); }).distinct();
							var matchingContext = contextsFromDom.single(function(tc) { return Sys._indexOf(tc.nodes, subcontainer) >= 0; });
							if (matchingContext) {
								data = matchingContext.dataItem;
								break;
							}
						}
						else if (childContext.containerElement === container && Sys._indexOf(childContext.nodes, subcontainer) > -1) {
							data = childContext.dataItem;
							break;
						}

					}
				}
			}
		}
	}

	return data;
}

function getParentContext(options/*{ target, subcontainer, index, level, dataType, ifFn }*/) {
	/// <summary>
	/// 	Finds the template context data based on the given options.
	/// </summary>
	/// <param name="options" type="Object">
	/// 	The object which contains the options to use.
	/// 	target:  The target from which to start searching.  This can be an HTML
	/// 					element, a control, or a template context.
	/// 		index (optional):  The index of the desired context.  If the desired context
	/// 					is one level up and is part of a list, this argument can be used
	/// 					to specify which template context to return.
	/// 		level (optional):  The number of levels to travel.  By default this is "1",
	/// 					which means that the immediate parent context data will be returned.
	/// 		dataType (optional):  If specified, this type is used as the type of data to search
	/// 					for.  When context data of this type is encountered it is returned.
	/// 					Note that arrays are not supported.  If the data is an array and the
	/// 					type of items must be checked, use the "ifFn" argument.
	/// 		ifFn (optional):  A function that determines whether the correct data has been
	/// 					found.  The context data is returned as soon as the result of calling 
	/// 					this function with the current data and container is true.
	/// </param>
	/// <returns type="Object" />

	var target = options.target, effectiveLevel = options.level || 1, container, subcontainer = options.subcontainer, i = 0, searching = true, context, data;

	if (target.control && (target.control instanceof Sys.UI.DataView || target.control instanceof ExoWeb.UI.Content)) {
		target = target.control;
	}
	else if (target instanceof Sys.UI.Template) {
		target = target.get_element();
	}
	else if (target instanceof Sys.UI.TemplateContext) {
		target = target.containerElement;
	}

	while (searching === true) {
		// if we are starting out with a dataview then look at the parent context rather than walking 
		// up the dom (since the element will probably not be present in the dom)
		if (!container && (target instanceof Sys.UI.DataView || target instanceof ExoWeb.UI.Content)) {
			context = target.get_templateContext();

			// If the control's context is the global context, then exit here with a custom result
			if (context._global === true) {
				return { data: null, global: true, container: document.documentElement, subcontainer: target.get_element() };
			}

			container = context.containerElement;

			if (container.control instanceof Toggle)
				container = Sys.UI.Template.findContext(container).containerElement;
			
			if (options.target && options.target.tagName) {
				subcontainer = getTemplateSubContainer(options.target);
			}
		}
		else {
			var obj = container || target;
			subcontainer = getTemplateSubContainer(obj);

			if (!subcontainer) {
				// Back up and attempt to go through the control.
				if (obj.control && (obj.control instanceof Sys.UI.DataView || container.control instanceof ExoWeb.UI.Content)) {
					container = null;
					target = obj.control;
					continue;
				}

				throw Error.invalidOperation("Not within a container template.");
			}

			container = subcontainer.parentNode;
		}

		// Increment the counter to check against the level parameter.
		i++;

		// Get the context data for the current level.
		data = getDataForContainer(container, subcontainer, options.index);

		if (options.dataType) {
			// Verify that the current data is not the data type that we are looking for.
			searching = !data || !(data instanceof options.dataType || data.constructor === options.dataType);
		}
		else if (options.ifFn) {
			// Verify that the stop function conditions are not met.
			searching = !(options.ifFn.call(this, data, container));
		}
		else {
			// Finally, check the level.  If no level was specified then we will only go up one level.
			searching = i < effectiveLevel;
		}
	}

	return { data: data, container: container, subcontainer: subcontainer };
}

ExoWeb.UI.getParentContext = getParentContext;

ExoWeb.UI.getParentContextData = function() {
	return getParentContext.apply(this, arguments).data;
};

window.$parentContextData = function $parentContextData(target, index, level, dataType, ifFn) {
	/// <summary>
	/// 	Finds the template context data based on the given options.
	/// </summary>
	/// <param name="target" type="Object">
	/// 	The target from which to start searching.  This can be an HTML element, a 
	/// 	control, or a template context.
	/// </param>
	/// <param name="index" type="Number" integer="true" optional="true">
	/// 	The index of the desired context.  If the desired context is one level
	/// 	up and is part of a list, this argument can be used to specify which
	/// 	template context to return.
	/// </param>
	/// <param name="level" type="Number" integer="true" optional="true">
	/// 	The number of levels to travel.  By default this is "1", which means that
	/// 	the immediate parent context data will be returned.
	/// </param>
	/// <param name="dataType" type="Function" optional="true">
	/// 	If specified, this type is used as the type of data to search for.  When context
	/// 	data of this type is encountered it is returned.  Note that arrays are not supported.
	/// 	If the data is an array and the type of items must be checked, use the "ifFn" argument.
	/// </param>
	/// <param name="ifFn" type="Function" optional="true">
	/// 	A function that determines whether the correct data has been found.  The context data
	/// 	is returned as soon as the result of calling this function with the current data and 
	/// 	container is true.
	/// </param>
	/// <returns type="Object" />

	return getParentContext({
		"target": target,
		"index": index,
		"level": level,
		"dataType": dataType,
		"ifFn": ifFn
	}).data;
};

function getIsLast(template, index) {
	/// <summary>
	/// 	Returns whether the data being rendered in the given template at the given index is 
	/// 	the last object in the list.
	///
	///		Example:
	///
	///		&lt; span sys:if="{{ $isLast(this, $index) }}" &gt;
	///
	/// </summary>
	/// <param name="template" type="Sys.UI.Template">The template that is being rendered.</param>
	/// <param name="index" type="Number" integer="true">The index of the current data item.</param>
	/// <returns type="Boolean" />

	var len = template.get_element().control.get_contexts().length;
	return index == len - 1;
}

window.$isLast = getIsLast;
