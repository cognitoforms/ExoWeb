(function () {
	var targetChangedImpl = Sys.Binding.prototype._targetChanged;
	Sys.Binding.prototype._targetChanged = function (force) {
		var target = this._target;

		// invoke the method implementation
		targetChangedImpl.apply(this, [force]);

		// Set _lastTarget=false on other radio buttons in the group, since they only 
		// remember the last target that was recieved when an event fires and radio button
		// target change events fire on click (which does not account for de-selection).  
		// Otherwise, the source value is only set the first time the radio button is selected.
		if (Sys.UI.DomElement.isDomElement(target) && $(target).is("input[type=radio]") && $(target).attr("checked")) {
			$("input[type=radio][name='" + target.name + "']").each(function () {
				if (this != target && this.__msajaxbindings !== undefined) {
					var bindings = this.__msajaxbindings;
					for (var i = 0; i < bindings.length; i++)
						bindings[i]._lastTarget = bindings[i]._lastSource = false;
				}
			});
		}
	};

	var sourceChangedImpl = Sys.Binding.prototype._sourceChanged;
	Sys.Binding.prototype._sourceChanged = function (force) {
		var target = this._target;

		// invoke the method implementation
		sourceChangedImpl.apply(this, [force]);

		// Remove checked attribute from other radio buttons in the group that are currently checked.
		if (Sys.UI.DomElement.isDomElement(target) && $(target).is("input[type=radio]") && !this._lastSource) {
			$(target).removeAttr("checked");
		}
	};
})();

// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
function getFinalSrcObject(binding) {
	var src = binding.get_source();

	for (var i = 0; i < binding._pathArray.length - 1; ++i) {
		src = src[binding._pathArray[i]] || src["get_" + binding._pathArray[i]]();
	}

	return src;
}

ExoWeb.View.getFinalSrcObject = getFinalSrcObject;

function getFinalPathStep(binding) {
	return binding._pathArray[binding._pathArray.length - 1];
}

ExoWeb.View.getFinalPathStep = getFinalPathStep;

function getBindingInfo(binding) {
	var srcObj = getFinalSrcObject(binding);

	var target;
	var property;

	// Option adapter defers to parent adapter
	if (srcObj instanceof ExoWeb.View.OptionAdapter) {
		srcObj = srcObj.get_parent();
	}

	if (srcObj instanceof ExoWeb.View.Adapter) {
		var chain = srcObj.get_propertyChain();
		property = chain.lastProperty();
		target = chain.lastTarget(srcObj.get_target());
	}
	else if (srcObj instanceof ExoWeb.Model.Entity) {
		var propName = getFinalPathStep(binding);
		property = srcObj.meta.property(propName);
		target = srcObj;
	}

	return {
		target: target,
		property: property
	};
}

ExoWeb.View.getBindingInfo = getBindingInfo;
