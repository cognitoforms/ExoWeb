/*globals Sys, jQuery */

(function () {
	"use strict";

	function updateLastTargetAndSourceForOtherRadios(target) {
		// Set _lastTarget=false on other radio buttons in the group, since they only 
		// remember the last target that was recieved when an event fires and radio button
		// target change events fire on click (which does not account for de-selection).  
		// Otherwise, the source value is only set the first time the radio button is selected.
		if (Sys.UI.DomElement.isDomElement(target) && jQuery(target).is("input[type=radio]:checked")) {
			jQuery("input[type=radio][name='" + target.name + "']").each(function () {
				if (this !== target && this.__msajaxbindings !== undefined) {
					var bindings = this.__msajaxbindings;
					for (var i = 0; i < bindings.length; i++)
						bindings[i]._lastTarget = bindings[i]._lastSource = false;
				}
			});
		}
	}

	var targetChangedImpl = Sys.Binding.prototype._targetChanged;
	Sys.Binding.prototype._targetChanged = function (force) {
		// Batch changes that may occur due to the target element changing.
		var source = this.get_source(),
			sourceType,
			batchChanges = true;

		if (source === null) {
			sourceType = "null";
		}
		else if (source === undefined) {
			sourceType = "undefined";
		}
		else if (source instanceof ExoWeb.Model.Entity) {
			sourceType = source.meta.type.get_fullName();
		}
		else if (source instanceof ExoWeb.View.Adapter) {
			sourceType = "Adapter";

			// Adapters handle their own batching.
			batchChanges = false;
		}
		else if (source instanceof ExoWeb.View.OptionAdapter) {
			sourceType = "OptionAdapter";

			// If the option adapter is not a list, then it will set the
			// adapter's rawValue, which will handle batching itself.
			if (!source.get_parent().get_isList()) {
				batchChanges = false;
			}
		}
		else if (source instanceof ExoWeb.View.OptionGroupAdapter) {
			sourceType = "OptionGroupAdapter";
		}
		else {
			sourceType = parseFunctionName(source.constructor);
		}

		if (batchChanges) {
			context.server._changeLog.batchChanges(
				$format("binding: {0}.{1}", sourceType, this.get_path()),
				context.server._localUser,
				targetChangedImpl.bind(this, arguments),
				true
			);
		} else {
			targetChangedImpl.apply(this, arguments);
		}

		// If the binding is not disposing, then fix backing
		// fields for other radio buttons in the same group.
		if (!this._disposed) {
			updateLastTargetAndSourceForOtherRadios(this._target);
		}
	};

	function removeCheckedAttributeToMatchSourceValue(target, sourceValue) {
		// Remove checked attribute from a radio button if the source value has been set to false.
		if (Sys.UI.DomElement.isDomElement(target) && jQuery(target).is("input[type=radio]:checked") && !sourceValue) {
			jQuery(target).removeAttr("checked");
		}
	}

	var sourceChangedImpl = Sys.Binding.prototype._sourceChanged;
	Sys.Binding.prototype._sourceChanged = function (force) {
		var link = force === false;

		// Invoke the standard method implementation.
		sourceChangedImpl.apply(this, [force]);

		if (!this._disposed && !link) {
			removeCheckedAttributeToMatchSourceValue(this._target, this._lastSource);
		}
	};

	Sys.UI.DataView.prototype._loadData = function (value) {
		this._swapData(this._data, value);
		var oldValue = this._data;
		this._data = value;
		this._setData = true;
		this._stale = false;
		// Array data should not typically be set unless some intermediate
		// process (like transform) is creating a new array from the same original.
		if ((value && value instanceof Array) && (oldValue && oldValue instanceof Array)) {
			// copy the original array
			var arr = oldValue.slice();
			var changes = update(arr, value, true);
			this._collectionChanged(value, new Sys.NotifyCollectionChangedEventArgs(changes));
		}
		else {
			this._dirty = true;
			if (this._isActive()) {
				if (this.get_isLinkPending()) {
					this.link();
				}
				else {
					this.refresh();
				}
				this.raisePropertyChanged("data");
			}
			else {
				this._changed = true;
			}
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
