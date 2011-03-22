function ExoGraphEventListener(model, translator) {
	this._model = model;
	this._translator = translator;

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

		// don't record changes to types or properties that didn't originate from the server
		if (property.get_containingType().get_origin() != "server" || property.get_origin() !== "server" || property.get_isStatic()) {
			return;
		}

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
				instance: toExoGraph(this._translator, obj),
				property: property.get_name(),
				added: [],
				removed: []
			};

			var _this = this;
			if (listChange.newStartingIndex >= 0 || listChange.newItems) {
				Array.forEach(listChange.newItems, function ExoGraphEventListener$onListChanged$addedItem(obj) {
					change.added.push(toExoGraph(_this._translator, obj));
				});
			}
			if (listChange.oldStartingIndex >= 0 || listChange.oldItems) {
				Array.forEach(listChange.oldItems, function ExoGraphEventListener$onListChanged$removedItem(obj) {
					change.removed.push(toExoGraph(_this._translator, obj));
				});
			}

			this._raiseEvent("changeCaptured", [change]);
		}
	},
	onObjectRegistered: function ExoGraphEventListener$onObjectRegistered(obj) {

		// don't record changes to types that didn't originate from the server
		if (obj.meta.type.get_origin() != "server") {
			return;
		}

		if (obj.meta.isNew) {
//					ExoWeb.trace.log("server", "logging new: {0}({1})", [obj.meta.type.get_fullName(), obj.meta.id]);

			var change = {
				type: "InitNew",
				instance: toExoGraph(this._translator, obj)
			};

			this._raiseEvent("changeCaptured", [change]);
		}
	},
	onObjectUnregistered: function ExoGraphEventListener$onObjectUnregistered(obj) {
		// ignore types that didn't originate from the server
		if (obj.meta.type.get_origin() != "server") {
			return;
		}

		ExoWeb.trace.throwAndLog("server", "Unregistering server-type objects is not currently supported: {type.fullName}({id})", obj.meta);
	},
	onPropertyChanged: function ExoGraphEventListener$onPropertyChanged(obj, property, newValue, oldValue) {

		// don't record changes to types or properties that didn't originate from the server
		if (property.get_containingType().get_origin() != "server" || property.get_origin() !== "server" || property.get_isStatic()) {
			return;
		}

		if (property.get_isValueType()) {
			if (obj instanceof Function) {
//						ExoWeb.trace.log("server", "logging value change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
			}
			else {
//						ExoWeb.trace.log("server", "logging value change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
			}

			var valueChange = {
				type: "ValueChange",
				instance: toExoGraph(this._translator, obj),
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
				instance: toExoGraph(this._translator, obj),
				property: property.get_name(),
				oldValue: toExoGraph(this._translator, oldValue),
				newValue: toExoGraph(this._translator, newValue)
			};

			this._raiseEvent("changeCaptured", [refChange]);
		}
	}
});
