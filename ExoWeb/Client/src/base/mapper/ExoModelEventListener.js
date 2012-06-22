function ExoModelEventListener(model, translator, filters) {
	this._model = model;
	this._translator = translator;
	this._filters = filters;

	// listen for events
	model.addListChanged(this.onListChanged.bind(this));
	model.addAfterPropertySet(this.onPropertyChanged.bind(this));
	model.addObjectRegistered(this.onObjectRegistered.bind(this));
	model.addObjectUnregistered(this.onObjectUnregistered.bind(this));
}

ExoModelEventListener.mixin(ExoWeb.Functor.eventing);

ExoModelEventListener.mixin({
	addChangeDetected: function ExoModelEventListener$onEvent(handler) {
		this._addEvent("changeDetected", handler);
	},

	// Model event handlers
	onListChanged: function ExoModelEventListener$onListChanged(obj, property, listChanges) {
		if (this._filters && this._filters.listChanged && this._filters.listChanged(obj, property, listChanges) !== true)
			return;

		for (var i = 0; i < listChanges.length; ++i) {
			var listChange = listChanges[i];

			var change = {
				type: "ListChange",
				instance: toExoModel(obj, this._translator),
				property: property.get_name(),
				added: [],
				removed: []
			};

			var _this = this;
			if (listChange.newStartingIndex >= 0 || listChange.newItems) {
				Array.forEach(listChange.newItems, function ExoModelEventListener$onListChanged$addedItem(obj) {
					change.added.push(toExoModel(obj, _this._translator));
				});
			}
			if (listChange.oldStartingIndex >= 0 || listChange.oldItems) {
				Array.forEach(listChange.oldItems, function ExoModelEventListener$onListChanged$removedItem(obj) {
					change.removed.push(toExoModel(obj, _this._translator));
				});
			}

			this._raiseEvent("changeDetected", [change]);
		}
	},
	onObjectRegistered: function ExoModelEventListener$onObjectRegistered(obj) {
		if (this._filters && this._filters.objectRegistered && this._filters.objectRegistered(obj) !== true)
			return;

		if (obj.meta.isNew) {
			var change = {
				type: "InitNew",
				instance: toExoModel(obj, this._translator)
			};

			this._raiseEvent("changeDetected", [change]);
		}
	},
	onObjectUnregistered: function ExoModelEventListener$onObjectUnregistered(obj) {
		if (this._filters && this._filters.objectUnregistered && this._filters.objectUnregistered(obj) !== true)
			return;

		if (obj.meta.type.get_origin() === "server") {
			ExoWeb.trace.throwAndLog("server", "Unregistering server-type objects is not currently supported: {0}({1})", obj.meta.type.fullName, obj.meta.id);
		}
	},
	onPropertyChanged: function ExoModelEventListener$onPropertyChanged(obj, property, newValue, oldValue) {
		if (this._filters && this._filters.propertyChanged && this._filters.propertyChanged(obj, property, newValue, oldValue) !== true)
			return;

		if (property.get_isValueType()) {
			var valueChange = {
				type: "ValueChange",
				instance: toExoModel(obj, this._translator),
				property: property.get_name(),
				oldValue: oldValue,
				newValue: newValue
			};

			this._raiseEvent("changeDetected", [valueChange]);
		}
		else {
			var refChange = {
				type: "ReferenceChange",
				instance: toExoModel(obj, this._translator),
				property: property.get_name(),
				oldValue: toExoModel(oldValue, this._translator),
				newValue: toExoModel(newValue, this._translator)
			};

			this._raiseEvent("changeDetected", [refChange]);
		}
	}
});

exports.ExoModelEventListener = ExoModelEventListener;
