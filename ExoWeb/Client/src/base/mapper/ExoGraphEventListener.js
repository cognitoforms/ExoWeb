function ExoGraphEventListener(model, translator, filters) {
	this._model = model;
	this._translator = translator;
	this._filters = filters;

	// listen for events
	model.addListChanged(this.onListChanged.bind(this));
	model.addAfterPropertySet(this.onPropertyChanged.bind(this));
	model.addObjectRegistered(this.onObjectRegistered.bind(this));
	model.addObjectUnregistered(this.onObjectUnregistered.bind(this));
}

ExoGraphEventListener.mixin(ExoWeb.Functor.eventing);

ExoGraphEventListener.mixin({
	addChangeCaptured: function ExoGraphEventListener$onEvent(handler) {
		this._addEvent("changeCaptured", handler);
	},

	// Model event handlers
	onListChanged: function ExoGraphEventListener$onListChanged(obj, property, listChanges) {
		if (this._filters && this._filters.listChanged && this._filters.listChanged(obj, property, listChanges) !== true)
			return;

		if (obj instanceof Function) {
//					ExoWeb.trace.log("server", "logging list change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
		}
		else {
//					ExoWeb.trace.log("server", "logging list change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
		}

		for (var i = 0; i < listChanges.length; ++i) {
			var listChange = listChanges[i];

			var change = {
				type: "ListChange",
				instance: toExoGraph(obj, this._translator),
				property: property.get_name(),
				added: [],
				removed: []
			};

			var _this = this;
			if (listChange.newStartingIndex >= 0 || listChange.newItems) {
				Array.forEach(listChange.newItems, function ExoGraphEventListener$onListChanged$addedItem(obj) {
					change.added.push(toExoGraph(obj, _this._translator));
				});
			}
			if (listChange.oldStartingIndex >= 0 || listChange.oldItems) {
				Array.forEach(listChange.oldItems, function ExoGraphEventListener$onListChanged$removedItem(obj) {
					change.removed.push(toExoGraph(obj, _this._translator));
				});
			}

			this._raiseEvent("changeCaptured", [change]);
		}
	},
	onObjectRegistered: function ExoGraphEventListener$onObjectRegistered(obj) {
		if (this._filters && this._filters.objectRegistered && this._filters.objectRegistered(obj) !== true)
			return;

		if (obj.meta.isNew) {
//					ExoWeb.trace.log("server", "logging new: {0}({1})", [obj.meta.type.get_fullName(), obj.meta.id]);

			var change = {
				type: "InitNew",
				instance: toExoGraph(obj, this._translator)
			};

			this._raiseEvent("changeCaptured", [change]);
		}
	},
	onObjectUnregistered: function ExoGraphEventListener$onObjectUnregistered(obj) {
		if (this._filters && this._filters.objectUnregistered && this._filters.objectUnregistered(obj) !== true)
			return;

		ExoWeb.trace.throwAndLog("server", "Unregistering server-type objects is not currently supported: {0}({1})", obj.meta.type.fullName, obj.meta.id);
	},
	onPropertyChanged: function ExoGraphEventListener$onPropertyChanged(obj, property, newValue, oldValue) {
		if (this._filters && this._filters.propertyChanged && this._filters.propertyChanged(obj, property, newValue, oldValue) !== true)
			return;

		if (property.get_isValueType()) {
			if (obj instanceof Function) {
//						ExoWeb.trace.log("server", "logging value change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
			}
			else {
//						ExoWeb.trace.log("server", "logging value change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
			}

			var valueChange = {
				type: "ValueChange",
				instance: toExoGraph(obj, this._translator),
				property: property.get_name(),
				oldValue: oldValue,
				newValue: newValue
			};

			this._raiseEvent("changeCaptured", [valueChange]);
		}
		else {
			if (obj instanceof Function) {
//						ExoWeb.trace.log("server", "logging reference change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
			}
			else {
//						ExoWeb.trace.log("server", "logging reference change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
			}

			var refChange = {
				type: "ReferenceChange",
				instance: toExoGraph(obj, this._translator),
				property: property.get_name(),
				oldValue: toExoGraph(oldValue, this._translator),
				newValue: toExoGraph(newValue, this._translator)
			};

			this._raiseEvent("changeCaptured", [refChange]);
		}
	}
});

exports.ExoGraphEventListener = ExoGraphEventListener;
