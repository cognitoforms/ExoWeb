function ServerSync(model) {
	this._model = model;
	this._changes = [];
	this._pendingServerEvent = false;
	this._pendingRoundtrip = false;
	this._pendingSave = false;
	this._objectsExcludedFromSave = [];
	this._translator = new ExoWeb.Translator();
	this._listener = new ExoGraphEventListener(this._model, this._translator);

	var applyingChanges = false;
	this.isApplyingChanges = function ServerSync$isApplyingChanges() {
		return applyingChanges;
	};
	this.beginApplyingChanges = function ServerSync$beginApplyingChanges() {
		applyingChanges = true;
	};
	this.endApplyingChanges = function ServerSync$endApplyingChanges() {
		applyingChanges = false;
	};

	var captureRegisteredObjects = false;
	model.addObjectRegistered(function(obj) {
		// if an existing object is registered then register for lazy loading
		if (!obj.meta.isNew && obj.meta.type.get_origin() == "server" && captureRegisteredObjects && !applyingChanges) {
			ObjectLazyLoader.register(obj);
//					ExoWeb.trace.log(["entity", "server"], "{0}({1})  (ghost)", [obj.meta.type.get_fullName(), obj.meta.id]);
		}
	});
	this.isCapturingRegisteredObjects = function ServerSync$isCapturingRegisteredObjects() {
		return captureRegisteredObjects;
	};
	this.beginCapturingRegisteredObjects = function ServerSync$beginCapturingRegisteredObjects() {
		captureRegisteredObjects = true;
	};

	model._server = this;

	this._listener.addChangeCaptured(this._captureChange.setScope(this));

	Sys.Observer.makeObservable(this);
}

ServerSync.mixin(ExoWeb.Functor.eventing);

function tryGetJsType(model, name, property, forceLoad, callback, thisPtr) {
	var jstype = ExoWeb.Model.Model.getJsType(name, true);

	if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
		callback.call(thisPtr || this, jstype);
	}
	else if (jstype && forceLoad) {
//				ExoWeb.trace.log("server", "Forcing lazy loading of type \"{0}\".", [name]);
		ExoWeb.Model.LazyLoader.load(jstype.meta, property, callback, thisPtr);
	}
	else if (!jstype && forceLoad) {
//				ExoWeb.trace.log("server", "Force creating type \"{0}\".", [name]);
		ensureJsType(model, name, callback, thisPtr);
	}
	else {
//				ExoWeb.trace.log("server", "Waiting for existance of type \"{0}\".", [name]);
		$extend(name, function() {
//					ExoWeb.trace.log("server", "Type \"{0}\" was loaded, now continuing.", [name]);
			callback.apply(this, arguments);
		}, thisPtr);
	}
}

var entitySignals = [];

var LazyLoadEnum = {
	None: 0,
	Force: 1,
	ForceAndWait: 2
};

function tryGetEntity(model, translator, type, id, property, lazyLoad, callback, thisPtr) {
	var obj = type.meta.get(translateId(translator, type.meta.get_fullName(), id));

	if (obj && ExoWeb.Model.LazyLoader.isLoaded(obj)) {
		callback.call(thisPtr || this, obj);
	}
	else {
		var objKey = type.meta.get_fullName() + "|" + id;
		var signal = entitySignals[objKey];
		if (!signal) {
			signal = entitySignals[objKey] = new ExoWeb.Signal(objKey);

			// When the signal is created increment its counter once, since
			// we are only keeping track of whether the object is loaded.
			signal.pending();
		}

		// wait until the object is loaded to invoke the callback
		signal.waitForAll(function() {
			callback.call(thisPtr || this, type.meta.get(translateId(translator, type.meta.get_fullName(), id)));
		});

		function done() {
			if (signal.isActive()) {
				signal.oneDone();
			}
		}
		
		if (lazyLoad == LazyLoadEnum.Force) {
			if (!obj) {
//					ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
				obj = fromExoGraph({ type: type.meta.get_fullName(), id: id }, translator);
			}
			done();
//					ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			ExoWeb.Model.LazyLoader.eval(obj, property, function() {});
		}
		else if (lazyLoad == LazyLoadEnum.ForceAndWait) {
			if (!obj) {
//					ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
				obj = fromExoGraph({ type: type.meta.get_fullName(), id: id }, translator);
			}
//					ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			ExoWeb.Model.LazyLoader.eval(obj, property, done);
		}
		else {
//					ExoWeb.trace.log("server", "Waiting for existance of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);

			function waitForProperty() {
				if (property) {
					// if the property is not initialized then wait
					var prop = type.meta.property(property, true);
					if (prop.isInited(obj)) {
						done();
					}
					else {
//									ExoWeb.trace.log("server", "Waiting on \"{0}\" property init for object \"{1}|{2}\".", [property, type.meta.get_fullName(), id]);
						var initHandler = function() {
//										ExoWeb.trace.log("server", "Property \"{0}\" inited for object \"{1}|{2}\", now continuing.", [property, type.meta.get_fullName(), id]);
							done();
						};

						// Register the handler once.
						prop.addChanged(initHandler, obj, true);
					}
				}
				else {
					done();
				}
			}

			// Object is already created but not loaded.
			if (obj) {
				waitForProperty();
			}
			else {
				var registeredHandler = function(obj) {
	//						ExoWeb.trace.log("server", "Object \"{0}|{1}\" was created, now continuing.", [type.meta.get_fullName(), id]);
					if (obj.meta.type === type.meta && obj.meta.id === id) {
						waitForProperty();
					}
				};

				// Register the handler once.
				model.addObjectRegistered(registeredHandler, true);
			}
		}
	}
}

var aggressiveLog = false;

var pendingRequests = 0;

ExoWeb.registerActivity(function() {
	return pendingRequests > 0;
});

ServerSync.mixin({
	_addEventHandler: function ServerSync$_addEventHandler(name, handler, includeAutomatic, automaticArgIndex) {
		automaticArgIndex = (automaticArgIndex === undefined) ? 0 : automaticArgIndex;

		this._addEvent(name, function() {
			var automatic = arguments.length > automaticArgIndex ? arguments[automaticArgIndex] : null;

			// only raise automated events if the subscriber requests them
			if (!automatic || includeAutomatic) {
				handler.apply(this, arguments);
			}
		});
	},
	_raiseBeginEvent: function ServerSync$raiseBeginEvent(method, includeAutomatic)
	{
		this._raiseEvent("requestBegin", [includeAutomatic]);
		this._raiseEvent(method + "Begin", [includeAutomatic]);
	},
	_raiseSuccessEvent: function ServerSync$raiseSuccessEvent(method, result, includeAutomatic)
	{
		this._raiseEvent("requestEnd", [result, includeAutomatic]);
		this._raiseEvent("requestSuccess", [result, includeAutomatic]);
		this._raiseEvent(method + "End", [result, includeAutomatic]);
		this._raiseEvent(method + "Success", [result, includeAutomatic]);
	},
	_raiseFailedEvent: function ServerSync$raiseFailedEvent(method, result, includeAutomatic)
	{
		this._raiseEvent("requestEnd", [result, includeAutomatic]);
		this._raiseEvent("requestFailed", [result, includeAutomatic]);
		this._raiseEvent(method + "End", [result, includeAutomatic]);
		this._raiseEvent(method + "Failed", [result, includeAutomatic]);
	},
	addRequestBegin: function ServerSync$addRequestBegin(handler, includeAutomatic) {
		this._addEventHandler("requestBegin", handler, includeAutomatic, 1);
	},
	addRequestEnd: function ServerSync$addRequestEnd(handler, includeAutomatic) {
		this._addEventHandler("requestEnd", handler, includeAutomatic, 1);
	},
	addRequestSuccess: function ServerSync$addRequestSuccess(handler, includeAutomatic) {
		this._addEventHandler("requestSuccess", handler, includeAutomatic, 3);
	},
	addRequestFailed: function ServerSync$addRequestFailed(handler, includeAutomatic) {
		this._addEventHandler("requestFailed", handler, includeAutomatic, 3);
	},
	enableSave: function ServerSync$enableSave(obj) {
		if (Array.contains(this._objectsExcludedFromSave, obj)) {
			Array.remove(this._objectsExcludedFromSave, obj);
			Sys.Observer.raisePropertyChanged(this, "Changes");
			return true;
		}
	},
	disableSave: function ServerSync$disableSave(obj) {
		if (!Array.contains(this._objectsExcludedFromSave, obj)) {
			this._objectsExcludedFromSave.push(obj);
			Sys.Observer.raisePropertyChanged(this, "Changes");
			return true;
		}
	},
	canSaveObject: function ServerSync$canSaveObject(objOrMeta) {
		var obj;
		var errorFmt = "Unable to test whether object can be saved:  {0}.";

		if (arguments.length === 0) {
			ExoWeb.trace.throwAndLog("server", errorFmt, ["argument not given"]);
		}
		else if (objOrMeta === undefined || objOrMeta === null) {
			ExoWeb.trace.throwAndLog("server", errorFmt, ["argument is null or undefined"]);
		}
		else if (objOrMeta instanceof ExoWeb.Model.ObjectMeta) {
			obj = objOrMeta._obj;
		}
		else if (objOrMeta instanceof ExoWeb.Model.Entity) {
			obj = objOrMeta;
		}
		else {
			ExoWeb.trace.throwAndLog("server", errorFmt, ["argument is not of correct type"]);
		}

		return !Array.contains(this._objectsExcludedFromSave, obj);
	},
	canSave: function ServerSync$canSave(change) {
		// For list changes additionally check added and removed objects.
		if (change.type == "ListChange") {
			if (change.added.length > 0 || change.removed.length > 0) {
				var ignore = true;

				// Search added and removed for an object that can be saved.
				Array.forEach(change.added, function(item) {
					// if the type doesn't exist then obviously the instance doesn't either
					var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
					if (!jstype) {
						return;
					}
					var addedObj = fromExoGraph(item, this._translator);
					if (this.canSaveObject(addedObj)) {
						ignore = false;
					}
				}, this);
				Array.forEach(change.removed, function(item) {
					// if the type doesn't exist then obviously the instance doesn't either
					var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
					if (!jstype) {
						return;
					}
					var removedObj = fromExoGraph(item, this._translator);
					if (this.canSaveObject(removedObj)) {
						ignore = false;
					}
				}, this);

				// If no "savable" object was found in added or 
				// removed then this change cannot be saved.
				if (ignore) {
					return false;
				}
			}
		}
		// For reference changes additionally check oldValue/newValue
		else if(change.__type == "ReferenceChange:#ExoGraph"){
			var oldJsType = change.oldValue && ExoWeb.Model.Model.getJsType(change.oldValue.type, true);
			if (oldJsType) {
				var oldValue = fromExoGraph(change.oldValue, this._translator);
				if(oldValue && !this.canSaveObject(oldValue)) {
					return false;
				}
			}

			var newJsType = change.newValue && ExoWeb.Model.Model.getJsType(change.newValue.type, true);
			if (newJsType) {
				var newValue = fromExoGraph(change.newValue, this._translator);
				if(newValue && !this.canSaveObject(newValue)) {
					return false;
				}
			}
		}

		// if the type doesn't exist then obviously the instance doesn't either
		var jstype = ExoWeb.Model.Model.getJsType(change.instance.type, true);
		if (!jstype) {
			return true;
		}

		// Ensure that the instance that the change pertains to can be saved.
		var instanceObj = fromExoGraph(change.instance, this._translator);
		return this.canSaveObject(instanceObj);
	},

	_handleResult: function ServerSync$handleResult(result, automatic, callback)
	{
		var signal = new ExoWeb.Signal("Success");

		if (result.instances) {
			var batch = ExoWeb.Batch.start();

			objectsFromJson(this._model, result.instances, signal.pending(function() {
				// if there is instance data to load then wait before loading conditions (since they may reference these instances)
				if (result.conditions) {
					conditionsFromJson(this._model, result.conditions);
				}
				ExoWeb.Batch.end(batch);
				if (result.changes && result.changes.length > 0) {
					this.applyChanges(result.changes, signal.pending());
				}
			}), this);
		}
		else if (result.changes && result.changes.length > 0) {
			this.applyChanges(result.changes, signal.pending(function () {
				if (result.conditions) {
					conditionsFromJson(this._model, result.conditions);
				}
			}, this));
		}
		else if (result.conditions) {
			conditionsFromJson(this._model, result.conditions);
		}

		signal.waitForAll(function() {
			if (callback && callback instanceof Function) {
				callback.call(this);
			}
		}, this);
	},

	// Raise Server Event
	///////////////////////////////////////////////////////////////////////
	raiseServerEvent: function ServerSync$raiseServerEvent(name, obj, event, includeAllChanges, success, failed/*, automatic, paths */) {
		pendingRequests++;

		Sys.Observer.setValue(this, "PendingServerEvent", true);

		var automatic = arguments.length > 6 && arguments[6] === true;
		var paths = arguments.length > 7 && arguments[7];

		this._raiseBeginEvent("raiseServerEvent", automatic);

		// if no event object is provided then use an empty object
		if (event === undefined || event === null) {
			event = {};
		}

		// If includeAllChanges is true, then use all changes including those 
		// that should not be saved, otherwise only use changes that can be saved.
		var changes = includeAllChanges ? this._changes : this.get_Changes();

		for(var key in event) {
			var arg = event[key];

			if(arg instanceof Array) {
				for(var i=0; i<arg.length; ++i) {
					arg[i] = toExoGraph(this._translator, arg[i]);
				}
			}
			else {
				event[key] = toExoGraph(this._translator, arg);
			}
		}

		eventProvider(
			name,
			toExoGraph(this._translator, obj),
			event,
			paths,
			changes,
			this._onRaiseServerEventSuccess.setScope(this).appendArguments(success, automatic),
			this._onRaiseServerEventFailed.setScope(this).appendArguments(failed || success, automatic)
		);
	},
	_onRaiseServerEventSuccess: function ServerSync$_onRaiseServerEventSuccess(result, callback, automatic) {
		Sys.Observer.setValue(this, "PendingServerEvent", false);

		this._handleResult(result, automatic, function() {
			this._raiseSuccessEvent("raiseServerEvent", result, automatic);

			if (callback && callback instanceof Function) {
				var event = result.events[0];
				if(event instanceof Array) {
					for(var i=0; i<event.length; ++i) {
						event[i] = fromExoGraph(event[i], this._translator);
					}
				}
				else {
					event = fromExoGraph(event, this._translator);
				}							

				result.event = event;
				restoreDates(result.event);
				callback.call(this, result);
			}

			pendingRequests--;
		});
	},
	_onRaiseServerEventFailed: function ServerSync$_onRaiseServerEventFailed(result, callback, automatic) {
		Sys.Observer.setValue(this, "PendingServerEvent", false);

		this._raiseFailedEvent("raiseServerEvent", result, automatic);

		if (callback && callback instanceof Function) {
			callback.call(this, result);
		}

		pendingRequests--;
	},
	addRaiseServerEventBegin: function ServerSync$addRaiseServerEventBegin(handler, includeAutomatic) {
		this._addEventHandler("raiseServerEventBegin", handler, includeAutomatic, 2);
	},
	addRaiseServerEventEnd: function ServerSync$addRaiseServerEventEnd(handler, includeAutomatic) {
		this._addEventHandler("raiseServerEventEnd", handler, includeAutomatic, 1);
	},
	addRaiseServerEventSuccess: function ServerSync$addRaiseServerEventSuccess(handler, includeAutomatic) {
		this._addEventHandler("raiseServerEventSuccess", handler, includeAutomatic, 3);
	},
	addRaiseServerEventFailed: function ServerSync$addRaiseServerEventFailed(handler, includeAutomatic) {
		this._addEventHandler("raiseServerEventFailed", handler, includeAutomatic, 3);
	},

	// Roundtrip
	///////////////////////////////////////////////////////////////////////
	roundtrip: function ServerSync$roundtrip(success, failed/*, automatic */) {
		pendingRequests++;

		Sys.Observer.setValue(this, "PendingRoundtrip", true);

		var automatic = arguments.length == 3 && arguments[2] === true;

		this._raiseBeginEvent("roundtrip", automatic);

		roundtripProvider(
			this._changes,
			this._onRoundtripSuccess.setScope(this).appendArguments(success, automatic),
			this._onRoundtripFailed.setScope(this).appendArguments(failed || success, automatic)
		);
	},
	_onRoundtripSuccess: function ServerSync$_onRoundtripSuccess(result, callback, automatic) {
		Sys.Observer.setValue(this, "PendingRoundtrip", false);

		this._handleResult(result, automatic, function() {
			this._raiseSuccessEvent("roundtrip", result, automatic);

			if (callback && callback instanceof Function) {
				callback.call(this, result);
			}

			pendingRequests--;
		});

	},
	_onRoundtripFailed: function ServerSync$_onRoundtripFailed(result, callback, automatic) {
		Sys.Observer.setValue(this, "PendingRoundtrip", false);

		this._raiseFailedEvent("roundtrip", result, automatic);

		if (callback && callback instanceof Function) {
			callback.call(this, result);
		}

		pendingRequests--;
	},
	startAutoRoundtrip: function ServerSync$startAutoRoundtrip(interval) {
//				ExoWeb.trace.log("server", "auto-roundtrip enabled - interval of {0} milliseconds", [interval]);

		// cancel any pending roundtrip schedule
		this.stopAutoRoundtrip();

		var _this = this;
		function doRoundtrip() {
//					ExoWeb.trace.log("server", "auto-roundtrip starting ({0})", [new Date()]);
			_this.roundtrip(function context$autoRoundtripCallback() {
//						ExoWeb.trace.log("server", "auto-roundtrip complete ({0})", [new Date()]);
				_this._roundtripTimeout = window.setTimeout(doRoundtrip, interval);
			}, null, true);
		}

		this._roundtripTimeout = window.setTimeout(doRoundtrip, interval);
	},
	stopAutoRoundtrip: function ServerSync$stopAutoRoundtrip() {
		if (this._roundtripTimeout) {
			window.clearTimeout(this._roundtripTimeout);
		}
	},

	// Save
	///////////////////////////////////////////////////////////////////////
	save: function ServerSync$save(root, success, failed/*, automatic*/) {
		pendingRequests++;

		Sys.Observer.setValue(this, "PendingSave", true);

		var automatic = arguments.length == 4 && arguments[3] === true;

		this._raiseBeginEvent("save", automatic);

		saveProvider(
			{ type: root.meta.type.get_fullName(), id: root.meta.id },
			this.get_Changes(),
			this._onSaveSuccess.setScope(this).appendArguments(success, automatic),
			this._onSaveFailed.setScope(this).appendArguments(failed || success, automatic)
		);
	},
	_onSaveSuccess: function ServerSync$_onSaveSuccess(result, callback, automatic) {
		Sys.Observer.setValue(this, "PendingSave", false);

		this._handleResult(result, automatic, function() {
			this._raiseSuccessEvent("save", result, automatic);

			if (callback && callback instanceof Function) {
				callback.call(this, result);
			}

			pendingRequests--;
		});
		
	},
	_onSaveFailed: function ServerSync$_onSaveFailed(result, callback, automatic) {
		Sys.Observer.setValue(this, "PendingSave", false);

		this._raiseFailedEvent("save", result, automatic);

		if (callback && callback instanceof Function) {
			callback.call(this, result);
		}

		pendingRequests--;
	},
	startAutoSave: function ServerSync$startAutoSave(root, interval) {
		// cancel any pending save schedule
		this.stopAutoSave();
		this._saveInterval = interval;
		this._saveRoot = root;
	},
	stopAutoSave: function ServerSync$stopAutoSave() {
		if (this._saveTimeout) {
			window.clearTimeout(this._saveTimeout);

			this._saveTimeout = null;
		}

		this._saveInterval = null;
		this._saveRoot = null;
	},
	_queueAutoSave: function ServerSync$_queueAutoSave() {
		if (this._saveTimeout)
			return;

		var _this = this;
		function ServerSync$doAutoSave() {
//					ExoWeb.trace.log("server", "auto-save starting ({0})", [new Date()]);
			_this.save(_this._saveRoot, function ServerSync$doAutoSave$callback() {
//						ExoWeb.trace.log("server", "auto-save complete ({0})", [new Date()]);

				// wait for the next change before next auto save
				_this._saveTimeout = null;
			}, null, true);
		}

		this._saveTimeout = window.setTimeout(ServerSync$doAutoSave, this._saveInterval);
	},
	addSaveBegin: function ServerSync$addSaveBegin(handler, includeAutomatic) {
		this._addEventHandler("saveBegin", handler, includeAutomatic);
	},
	addSaveEnd: function ServerSync$addSaveEnd(handler, includeAutomatic) {
		this._addEventHandler("saveEnd", handler, includeAutomatic);
	},
	addSaveSuccess: function ServerSync$addSaveSuccess(handler, includeAutomatic) {
		this._addEventHandler("saveSuccess", handler, includeAutomatic, 3);
	},
	addSaveFailed: function ServerSync$addSaveFailed(handler, includeAutomatic) {
		this._addEventHandler("saveFailed", handler, includeAutomatic, 3);
	},

	// Rollback
	///////////////////////////////////////////////////////////////////////
	rollback: function ServerSync$rollback(steps, callback) {
		var changes = this._changes;
		var depth = 0;

		if (!changes || !(changes instanceof Array)) {
			return;
		}

		try {
//					ExoWeb.trace.log("server", "ServerSync.rollback() >> {0}", steps);

			this.beginApplyingChanges();

			var signal = new ExoWeb.Signal("ServerSync.rollback");

			function processNextChange() {
				var change = null;

				if (steps === undefined || depth < steps) {
					change = changes.pop();
				}

				if (change) {
					var callback = signal.pending(processNextChange, this);

					if (change.type == "InitNew") {
						this.rollbackInitChange(change, callback);
					}
					else if (change.type == "ReferenceChange") {
						this.rollbackRefChange(change, callback);
					}
					else if (change.type == "ValueChange") {
						this.rollbackValChange(change, callback);
					}
					else if (change.type == "ListChange") {
						this.rollbackListChange(change, callback);
					}
				}

				depth++;
			}

			processNextChange.call(this);

			signal.waitForAll(function() {
//						ExoWeb.trace.log("server", "done rolling back {0} changes", [steps]);
				this.endApplyingChanges();

				if (callback && callback instanceof Function) {
					callback();
				}
			}, this);
		}
		catch (e) {
			this.endApplyingChanges();
			ExoWeb.trace.throwAndLog(["server"], e);
		}
	},
	rollbackValChange: function ServerSync$rollbackValChange(change, callback) {
//				ExoWeb.trace.log("server", "rollbackValChange", change.instance);

		var obj = fromExoGraph(change.instance, this._translator);

		Sys.Observer.setValue(obj, change.property, change.oldValue);
		callback();
	},
	rollbackRefChange: function ServerSync$rollbackRefChange(change, callback) {
//				ExoWeb.trace.log("server", "rollbackRefChange: Type = {instance.type}, Id = {instance.id}, Property = {property}", change);

		var obj = fromExoGraph(change.instance, this._translator);
		var ref = fromExoGraph(change.oldValue, this._translator);

		Sys.Observer.setValue(obj, change.property, ref);
		callback();
	},
	rollbackInitChange: function ServerSync$rollbackInitChange(change, callback) {
//				ExoWeb.trace.log("server", "rollbackInitChange: Type = {type}, Id = {id}", change.instance);

		delete change.instance;

		//TODO: need to remove from the translator

		callback();
	},
	rollbackListChange: function ServerSync$rollbackListChange(change, callback) {
		var obj = fromExoGraph(change.instance, this._translator);
		var prop = obj.meta.property(change.property, true);
		var list = prop.value(obj);
		var translator = this._translator;

		list.beginUpdate();

		// Rollback added items
		Array.forEach(change.added, function ServerSync$rollbackListChanges$added(item) {
			var childObj = fromExoGraph(item, translator);
			list.remove(childObj);
		});

		// Rollback removed items
		Array.forEach(change.removed, function ServerSync$rollbackListChanges$added(item) {
			var childObj = fromExoGraph(item, translator);
			list.add(childObj);
		});

		list.endUpdate();

		callback();
	},

	// Various
	///////////////////////////////////////////////////////////////////////
	_captureChange: function ServerSync$_captureChange(change) {
		if (!this.isApplyingChanges()) {
			this._changes.push(change);
			Sys.Observer.raisePropertyChanged(this, "Changes");

			if (this._saveInterval)
				this._queueAutoSave();
		}
	},
	_truncateLog: function ServerSync$_truncateLog(func) {
		var changed = false;

		if (func && func instanceof Function) {
			for (var i = 0; i < this._changes.length; i++) {
				var change = this._changes[i];
				if (func.call(this, change)) {
					changed = true;
					Array.removeAt(this._changes, i);
					i--;
				}
			}
		}
		else {
			changed = true;
			Array.clear(this._changes);
		}

		if (changed) {
			Sys.Observer.raisePropertyChanged(this, "Changes");
		}
	},
	get_Changes: function ServerSync$get_Changes() {
		return $transform(this._changes).where(this.canSave, this);
	},
	get_PendingAction: function ServerSync$get_PendingAction() {
		return this._pendingServerEvent || this._pendingRoundtrip || this._pendingSave;
	},
	get_PendingServerEvent: function ServerSync$get_PendingServerEvent() {
		return this._pendingServerEvent;
	},
	set_PendingServerEvent: function ServerSync$set_PendingServerEvent(value) {
		var oldValue = this._pendingServerEvent;
		this._pendingServerEvent = value;

		if (oldValue !== value) {
			Sys.Observer.raisePropertyChanged(this, "PendingAction");
		}
	},
	get_PendingRoundtrip: function ServerSync$get_PendingRoundtrip() {
		return this._pendingRoundtrip;
	},
	set_PendingRoundtrip: function ServerSync$set_PendingRoundtrip(value) {
		var oldValue = this._pendingRoundtrip;
		this._pendingRoundtrip = value;

		if (oldValue !== value) {
			Sys.Observer.raisePropertyChanged(this, "PendingAction");
		}
	},
	get_PendingSave: function ServerSync$get_PendingSave() {
		return this._pendingSave;
	},
	set_PendingSave: function ServerSync$set_PendingSave(value) {
		var oldValue = this._pendingSave;
		this._pendingSave = value;

		if (oldValue !== value) {
			Sys.Observer.raisePropertyChanged(this, "PendingAction");
		}
	},

	// APPLY CHANGES
	///////////////////////////////////////////////////////////////////////
	applyChanges: function ServerSync$applyChanges(changes, callback) {
		if (!changes || !(changes instanceof Array)) {
			return;
		}

		try {
			var batch = ExoWeb.Batch.start("apply changes");
//					ExoWeb.trace.log("server", "begin applying {length} changes", changes);

			this.beginApplyingChanges();

			var signal = new ExoWeb.Signal("ServerSync.apply");

			var totalChanges = changes.length;
			var newChanges = 0;
			var ignoreCount = 0;

			// NOTE: "save" changes are processed before the changes that they affect since the instances 
			// that are serialized and sent back to the client will always refer to their persisted 
			// identifiers, which will not be reflected on the client until the id changes are applied.  
			// Naively processing changes in order can result in cases where a change refers to an item 
			// that is already on the client by an id that it is not yet aware of.  The client will then 
			// fetch this data from the server, resulting in duplicate data and perhaps unexpected UI 
			// behavior.  If the data sent from the server refers to objects using point-in-time ids, 
			// then this process can be greatly simplified to simply process changes in order.

			function processNextChange() {
				var change = null;

				// don't record the change if we are still ignoring changes prior to a save
				var recordChange = (ignoreCount === 0);

				// look for remaining changes that are save changes, but only if 
				// we are finished processing changes that occurred before a save
				var saveChanges = null;
//						if (ignoreCount === 0) {
//							saveChanges = $transform(changes).where(function(c) {
//								return c.type === "Save";
//							});
//						}

				// process the next save change
				if (saveChanges && saveChanges.length > 0) {
					// get the first save change
					change = saveChanges[0];
					// don't record changes before changes were saved
					ignoreCount = Array.indexOf(changes, change);
					// remove the save change from the underlying array if there are no preceeding changes
					if (ignoreCount === 0) {
						Array.remove(changes, change);
					}
				}
				// process the next change of any kind
				else {
					// decrement ignore count until it reaches zero
					ignoreCount = ignoreCount > 0 ? ignoreCount - 1 : 0;
					// pull off the next change to process
					change = Array.dequeue(changes);
				}

				if (change) {
					var callback = signal.pending(processNextChange, this);

					var ifApplied = (function(applied) {
						if (recordChange && applied) {
							newChanges++;
							this._changes.push(change);
						}
						callback();
					}).setScope(this);

					if (change.type == "InitNew") {
						this.applyInitChange(change, ifApplied);
					}
					else if (change.type == "ReferenceChange") {
						this.applyRefChange(change, ifApplied);
					}
					else if (change.type == "ValueChange") {
						this.applyValChange(change, ifApplied);
					}
					else if (change.type == "ListChange") {
						this.applyListChange(change, ifApplied);
					}
					else if (change.type == "Save") {
						var lookahead = (saveChanges && saveChanges.length > 0 && ignoreCount !== 0);
						this.applySaveChange(change, lookahead, function() {
							// changes have been applied so truncate the log to this point
							this._truncateLog(this.canSave.setScope(this));

							ifApplied.apply(this, arguments);
						});
					}
				}
			}

			processNextChange.call(this);

			signal.waitForAll(function() {
//						ExoWeb.trace.log("server", "done applying {0} changes: {1} captured", [totalChanges, newChanges]);
				this.endApplyingChanges();
				ExoWeb.Batch.end(batch);
				if (callback && callback instanceof Function) {
					callback();
				}
				if (newChanges > 0) {
//							ExoWeb.trace.log("server", "raising \"Changes\" property change event");
					Sys.Observer.raisePropertyChanged(this, "Changes");
				}
			}, this);
		}
		catch (e) {
			this.endApplyingChanges();
			ExoWeb.trace.throwAndLog(["server"], e);
		}
	},
	applySaveChange: function ServerSync$applySaveChange(change, isLookahead, callback) {
//				ExoWeb.trace.log("server", "applySaveChange: {0} changes", [change.idChanges ? change.idChanges.length : "0"]);

		if (change.idChanges && change.idChanges.length > 0) {

			var index = 0;

			var processNextIdChange = function processNextIdChange() {
				if (index == change.idChanges.length) {
					callback.call(this);
				}
				else {
					var idChange = change.idChanges[index++];

					ensureJsType(this._model, idChange.type, function applySaveChange$typeLoaded(jstype) {
						var serverOldId = idChange.oldId;
						var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
								this._translator.reverse(idChange.type, serverOldId) :
								idChange.oldId;

						// If the client recognizes the old id then this is an object we have seen before
						if (clientOldId) {
							var type = this._model.type(idChange.type);

							// Attempt to load the object.
							var obj = type.get(clientOldId);

							// Ensure that the object exists.
							if (!obj) {
								ExoWeb.trace.throwAndLog("server",
									"Unable to change id for object of type \"{0}\" from \"{1}\" to \"{2}\" since the object could not be found.",
									[jstype.meta.get_fullName(), idChange.oldId, idChange.newId]
								);
							}
							// TODO
							//// Ensure that the object is a new object.
							//else if (!obj.meta.isNew) {
							//	ExoWeb.trace.throwAndLog("server",
							//		"Changing id for object of type \"{0}\" from \"{1}\" to \"{2}\", but the object is not new.",
							//		[jstype.meta.get_fullName(), idChange.oldId, idChange.newId]
							//	);
							//}

							// Change the id and make non-new.
							type.changeObjectId(clientOldId, idChange.newId);
							Sys.Observer.setValue(obj.meta, "isNew", false);

							// Remove the id change from the list and move the index back.
							Array.remove(change.idChanges, idChange);
							index = (index === 0) ? 0 : index - 1;
						}
						// Otherwise, if this is a lookahead pass, make a note of the new object 
						// that was created on the server so that we can correct the ids later
						else if (isLookahead) {
							// The server knows the correct old id, but the client will see a new object created with a persisted id 
							// since it was created and then committed.  Translate from the persisted id to the server's old id so that 
							// we can reverse it when creating new objects from the server.  Also, a reverse record should not be added.
							var unpersistedId = idChange.oldId;
							var persistedId = idChange.newId;
							this._translator.add(idChange.type, persistedId, unpersistedId, true);
						}
						// Otherwise, log an error.
						else {
							ExoWeb.trace.logError("server",
								"Cannot apply id change on type \"{type}\" since old id \"{oldId}\" was not found.",
								idChange
							);
						}

						processNextIdChange.call(this);
					}, this);
				}
			};

			// start processing id changes, use call so that "this" pointer refers to ServerSync object
			processNextIdChange.call(this);
		}
		else {
			callback.call(this);
		}
	},
	applyInitChange: function ServerSync$applyInitChange(change, callback) {
//				ExoWeb.trace.log("server", "applyInitChange: Type = {type}, Id = {id}", change.instance);

		var translator = this._translator;

		ensureJsType(this._model, change.instance.type,
			function applyInitChange$typeLoaded(jstype) {
				// Create the new object
				var newObj = new jstype();

				// Check for a translation between the old id that was reported and an actual old id.  This is
				// needed since new objects that are created on the server and then committed will result in an accurate
				// id change record, but "instance.id" for this change will actually be the persisted id.
				var serverOldId = translator.forward(change.instance.type, change.instance.id) || change.instance.id;

				// Remember the object's client-generated new id and the corresponding server-generated new id
				translator.add(change.instance.type, newObj.meta.id, serverOldId);

				callback(true);
			});
	},
	applyRefChange: function ServerSync$applyRefChange(change, callback) {
//				ExoWeb.trace.log("server", "applyRefChange: Type = {instance.type}, Id = {instance.id}, Property = {property}", change);

		var returnImmediately = !aggressiveLog;

		tryGetJsType(this._model, change.instance.type, change.property, aggressiveLog, function(srcType) {
			tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, aggressiveLog ? LazyLoadEnum.ForceAndWait : LazyLoadEnum.None, function(srcObj) {

				// Call ballback here if type and instance were
				// present immediately or aggressive mode is turned on
				var doCallback = returnImmediately || aggressiveLog;

				// Indicate that type and instance were present immediately
				returnImmediately = false;

				if (change.newValue) {
					tryGetJsType(this._model, change.newValue.type, null, true, function(refType) {
						var refObj = fromExoGraph(change.newValue, this._translator);
						var changed = ExoWeb.getValue(srcObj, change.property) != refObj;

						Sys.Observer.setValue(srcObj, change.property, refObj);

						if (doCallback) {
							callback(changed);
						}
					}, this);
				}
				else {
					var changed = ExoWeb.getValue(srcObj, change.property) != null;

					Sys.Observer.setValue(srcObj, change.property, null);

					if (doCallback) {
						callback(changed);
					}
				}
			}, this);
		}, this);

		// call callback here if target type or instance is not
		// present and aggressive log behavior is not turned on
		if (returnImmediately) {
			callback();
		}

		returnImmediately = false;
	},
	applyValChange: function ServerSync$applyValChange(change, callback) {
//				ExoWeb.trace.log("server", "applyValChange", change.instance);

		var returnImmediately = !aggressiveLog;

		tryGetJsType(this._model, change.instance.type, change.property, aggressiveLog, function(srcType) {
			tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, aggressiveLog ? LazyLoadEnum.ForceAndWait : LazyLoadEnum.None, function(srcObj) {

				// Call ballback here if type and instance were
				// present immediately or aggressive mode is turned on
				var doCallback = returnImmediately || aggressiveLog;

				// Indicate that type and instance were present immediately
				returnImmediately = false;

				var changed = ExoWeb.getValue(srcObj, change.property) != change.newValue;

				if (srcObj.meta.property(change.property).get_jstype() == Date && change.newValue && change.newValue.constructor == String && change.newValue.length > 0) {
					change.newValue = change.newValue.replace(dateRegex, dateRegexReplace);
					change.newValue = new Date(change.newValue);
				}

				Sys.Observer.setValue(srcObj, change.property, change.newValue);

				if (doCallback) {
					callback(changed);
				}
			}, this);
		}, this);

		if (returnImmediately) {
			callback();
		}

		returnImmediately = false;
	},
	applyListChange: function ServerSync$applyListChange(change, callback) {
//				ExoWeb.trace.log("server", "applyListChange", change.instance);

		var returnImmediately = !aggressiveLog;

		tryGetJsType(this._model, change.instance.type, change.property, aggressiveLog, function(srcType) {
			tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, aggressiveLog ? LazyLoadEnum.ForceAndWait : LazyLoadEnum.None, function(srcObj) {

				// Call callback here if type and instance were
				// present immediately or aggressive mode is turned on
				var doCallback = returnImmediately || aggressiveLog;

				// Indicate that type and instance were present immediately
				returnImmediately = false;

				var prop = srcObj.meta.property(change.property, true);
				var list = prop.value(srcObj);

				list.beginUpdate();

				var listSignal = new ExoWeb.Signal("applyListChange-items");

				// apply added items
				Array.forEach(change.added, function ServerSync$applyListChanges$added(item) {
					var done = listSignal.pending();
					tryGetJsType(this._model, item.type, null, true, function(itemType) {
						tryGetEntity(this._model, this._translator, itemType, item.id, null, LazyLoadEnum.Force, function(itemObj) {
							// Only add item to list if it isn't already present.
							if (list.indexOf(itemObj) < 0) {
								list.add(itemObj);
							}
						}, this);
					}, this);
					
					// wait for processing of pending changes that target the new value
					var signal = entitySignals[item.type + "|" + item.id];
					if (signal) {
						signal.waitForAll(done);
					}
					else {
						done();
					}
				}, this);

				// apply removed items
				Array.forEach(change.removed, function ServerSync$applyListChanges$removed(item) {
					// no need to load instance only to remove it from a list
					tryGetJsType(this._model, item.type, null, false, function(itemType) {
						tryGetEntity(this._model, this._translator, itemType, item.id, null, LazyLoadEnum.None, function(itemObj) {
							list.remove(itemObj);
						}, this);
					}, this);
				}, this);

				// don't end update until the items have been loaded
				listSignal.waitForAll(function() {
					list.endUpdate();
					if (doCallback) {
						callback(true);
					}
				}, this);

			}, this);
		}, this);

		if (returnImmediately) {
			callback();
		}

		returnImmediately = false;
	}
});

ExoWeb.Mapper.ServerSync = ServerSync;

ServerSync.Roundtrip = function ServerSync$Roundtrip(root, success, failed) {
	if (root instanceof ExoWeb.Model.Entity) {
		root = root.meta.type.get_model();
	}

	if (root instanceof ExoWeb.Model.Model) {
		if (root._server) {
			if (!root._server.isApplyingChanges()) {
				root._server.roundtrip(success, failed);
			}
		}
		else {
			ExoWeb.trace.logWarning("server", "Unable to perform roundtrip:  root is not a model or entity.");
		}
	}
};

ServerSync.Save = function ServerSync$Save(root, success, failed) {
	var model;
	if (root instanceof ExoWeb.Model.Entity) {
		model = root.meta.type.get_model();
	}

	if (model && model instanceof ExoWeb.Model.Model) {
		if (model._server) {
			model._server.save(root, success, failed);
		}
		else {
			// TODO
		}
	}
};
