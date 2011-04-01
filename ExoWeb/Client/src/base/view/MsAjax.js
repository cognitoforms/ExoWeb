(function() {
	var impl = Sys.Binding.prototype._targetChanged;
	Sys.Binding.prototype._targetChanged = function(force) {
		var target = this._target;

		// invoke the method implementation
		impl.apply(this, [force]);

		// Set _lastTarget=false on other radio buttons in the group, since they only 
		// remember the last target that was recieved when an event fires and radio button
		// target change events fire on click (which does not account for de-selection).  
		// Otherwise, the source value is only set the first time the radio button is selected.
		if (Sys.UI.DomElement.isDomElement(target) && $(target).is("input[type=radio]")) {
			$("input[type=radio][name='" + target.name + "']").each(function() {
				if (this != target && this.__msajaxbindings !== undefined) {
					var bindings = this.__msajaxbindings;
					for (var i = 0; i < bindings.length; i++)
						bindings[i]._lastTarget = false;
				}
			});
		}
	};
})();
