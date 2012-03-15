function ServerSync(model) {
	this._model = model;
	this._changeLog = new ChangeLog();
	this._pendingServerEvent = false;
	this._pendingRoundtrip = false;
	this._pendingSave = false;
	this._scopeQueries = [];
	this._objectsExcludedFromSave = [];
	this._objectsDeleted = [];
	this._translator = new ExoWeb.Translator();
	this._serverInfo = null;

	function isDeleted(obj, isChange) {
		if (Array.contains(this._objectsDeleted, obj)) {
			if (isChange) {
				ExoWeb.trace.logWarning("server", "Object {0}({1}) was changed but has been deleted.", obj.meta.type.get_fullName(), obj.meta.id);
			}
			return true;
		}
		return false;
	}

	// don't record changes to types that didn't originate from the server
	function filterObjectEvent(obj) {
		return !isDeleted.apply(this, [obj, false]) && obj.meta.type.get_origin() === "server";
	}

	// don't record changes to types or properties that didn't originate from the server
	function filterPropertyEvent(obj, property) {
		return !isDeleted.apply(this, [obj, true]) && property.get_containingType().get_origin() === "server" && property.get_origin() === "server" && !property.get_isStatic();
	}

	this._listener = new ExoModelEventListener(this._model, this._translator, {
		listChanged: filterPropertyEvent.bind(this),
		propertyChanged: filterPropertyEvent.bind(this),
		objectRegistered: filterObjectEvent.bind(this),
		objectUnregistered: filterObjectEvent.bind(this)
	});

	var applyingChanges = 0;
	this.isApplyingChanges = function ServerSync$isApplyingChanges() {
		return applyingChanges > 0;
	};
	this.beginApplyingChanges = function ServerSync$beginApplyingChanges() {
		applyingChanges++;
	};
	this.endApplyingChanges = function ServerSync$endApplyingChanges() {
		applyingChanges--;

		if (applyingChanges < 0)
			ExoWeb.trace.throwAndLog("Error in transaction log processing: unmatched begin and end applying changes.");
	};

	var isCapturingChanges;
	this.isCapturingChanges = function ServerSync$isCapturingChanges() {
		return isCapturingChanges === true;
	};
	this.beginCapturingChanges = function ServerSync$beginCapturingChanges() {
		if (!isCapturingChanges) {
			isCapturingChanges = true;
			startChangeSet.call(this, "client");
		}
	};

	this.ignoreChanges = function(before, callback, after, thisPtr) {
		return function() {
			var beforeCalled = false;

			try {
				applyingChanges++;

				if (before && before instanceof Function)
					before();
				
				beforeCalled = true;

				callback.apply(thisPtr || this, arguments);
			}
			finally {
				applyingChanges--;
				
				if (beforeCalled === true && after && after instanceof Function)
					after();
			}
		};
	};

	model.addObjectRegistered(function(obj) {
		// if an existing object is registered then register for lazy loading
		if (!obj.meta.isNew && obj.meta.type.get_origin() == "server" && isCapturingChanges === true && !applyingChanges) {
			ObjectLazyLoader.register(obj);
			//ExoWeb.trace.log(["entity", "server"], "{0}({1})  (ghost)", [obj.meta.type.get_fullName(), obj.meta.id]);
		}
	});

	// Assign back reference
	model._server = this;

	this._listener.addChangeCaptured(this._captureChange.bind(this));

	Sys.Observer.makeObservable(this);
}

ServerSync.mixin(ExoWeb.Functor.eventing);

var pendingRequests = 0;

ExoWeb.registerActivity(function() {
	return pendingRequests > 0;
});

function serializeChanges(includeAllChanges, simulateInitRoot) {
	var changes = this._changeLog.serialize(includeAllChanges ? this.canSend : this.canSave, this);

	// temporary HACK (no, really): splice InitNew changes into init transaction
	if (simulateInitRoot && simulateInitRoot.meta.isNew) {
		function isRootChange(change) {
			return change.type === "InitNew" && change.instance.type === simulateInitRoot.meta.type.get_fullName() &&
				(change.instance.id === simulateInitRoot.meta.id || this._translator.reverse(change.instance.type, change.instance.id) === simulateInitRoot.meta.id);
		}

		var found = false;
		var initSet = changes.filter(function(set) { return set.source === "init"; })[0];
		if (!initSet || !initSet.changes.some(isRootChange, this)) {
			changes.forEach(function(set) {
				if (found === true) return;
				set.changes.forEach(function(change, index) {
					if (found === true) return;
					else if (isRootChange.call(this, change)) {
						set.changes.splice(index, 1);
						if (!initSet) {
							initSet = { changes: [change], source: "init" };
							changes.splice(0, 0, initSet);
						}
						else {
							initSet.changes.push(change);
						}
						found = true;
					}
				}, this);
			}, this);
		}
	}

	return changes;
}

function startChangeSet(source) {
	if (source) {
		this._changeLog.start(source);
	}
	else {
		this._changeLog.start("unknown");
		ExoWeb.trace.logWarning("server", "Changes to apply but no source is specified.");
	}
}

// when ServerSync is made singleton, this data will be referenced via closure
function ServerSync$addScopeQuery(query) {
	this._scopeQueries.push(query);
}

function ServerSync$storeInitChanges(changes) {
	var activeSet = this._changeLog.activeSet();

	this._changeLog.addSet("init", changes);

	if (activeSet)
		startChangeSet.call(this, activeSet.source());
}

ServerSync.mixin({
	// Enable/disable save & related functions
	///////////////////////////////////////////////////////////////////////
	enableSave: function ServerSync$enableSave(obj) {
		if (!(obj instanceof ExoWeb.Model.Entity)) {
			ExoWeb.trace.throwAndLog("server", "Can only enableSave on entity objects.");
		}

		if (Array.contains(this._objectsExcludedFromSave, obj)) {
			Array.remove(this._objectsExcludedFromSave, obj);
			Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");
			return true;
		}
	},
	disableSave: function ServerSync$disableSave(obj) {
		if (!(obj instanceof ExoWeb.Model.Entity)) {
			ExoWeb.trace.throwAndLog("server", "Can only disableSave on entity objects.");
		}

		if (!Array.contains(this._objectsExcludedFromSave, obj)) {
			this._objectsExcludedFromSave.push(obj);
			Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");
			return true;
		}
	},
	notifyDeleted: function ServerSync$notifyDeleted(obj) {
		if (!(obj instanceof ExoWeb.Model.Entity)) {
			throw ExoWeb.trace.logError("server", "Notified of deleted object that is not an entity.");
		}

		if (!Array.contains(this._objectsDeleted, obj)) {
			this._objectsDeleted.push(obj);
			return true;
		}
	},
	canSend: function (change) {
		if (change.type === "Checkpoint") return false;

		return true;
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

		// Can't save changes that can't be sent to the server at all.
		if (!this.canSend(change)) return false;

		// For list changes additionally check added and removed objects.
		if (change.type === "ListChange") {
			if (change.added.length > 0 || change.removed.length > 0) {
				var ignore = true;

				// Search added and removed for an object that can be saved.
				Array.forEach(change.added, function (item) {
					// if the type doesn't exist then obviously the instance doesn't either
					var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
					if (!jstype) {
						ignore = false;
					}
					else {
						var obj = fromExoModel(item, this._translator);
						// Only objects that exist can be disabled
						if (!obj || this.canSaveObject(obj)) {
							ignore = false;
						}
					}
				}, this);
				Array.forEach(change.removed, function (item) {
					// if the type doesn't exist then obviously the instance doesn't either
					var jstype = ExoWeb.Model.Model.getJsType(item.type, true);
					if (!jstype) {
						ignore = false;
					}
					else {
						var obj = fromExoModel(item, this._translator);
						if (!obj || this.canSaveObject(obj)) {
							ignore = false;
						}
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
		else if (change.type === "ReferenceChange") {
			var oldJsType = change.oldValue && ExoWeb.Model.Model.getJsType(change.oldValue.type, true);
			if (oldJsType) {
				var oldValue = fromExoModel(change.oldValue, this._translator);
				if (oldValue && !this.canSaveObject(oldValue)) {
					return false;
				}
			}

			var newJsType = change.newValue && ExoWeb.Model.Model.getJsType(change.newValue.type, true);
			if (newJsType) {
				var newValue = fromExoModel(change.newValue, this._translator);
				if (newValue && !this.canSaveObject(newValue)) {
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
		var instanceObj = fromExoModel(change.instance, this._translator);
		return !instanceObj || this.canSaveObject(instanceObj);
	},

	_handleResult: function ServerSync$handleResult(result, source, checkpoint, callbackOrOptions) {
		var options,
			batch,
			signal = new ExoWeb.Signal("Success");

		if (callbackOrOptions instanceof Function) {
			options = { callback: callbackOrOptions };
		}
		else {
			options = callbackOrOptions;
		}

		if (result.serverinfo)
			this.set_ServerInfo(result.serverinfo);

		if (result.instances) {
			batch = ExoWeb.Batch.start();

			objectsFromJson(this._model, result.instances, signal.pending(function () {
				function processChanges() {
					ExoWeb.Batch.end(batch);

					if (result.changes && result.changes.length > 0) {
						this._changeLog.applyChanges(checkpoint, result.changes, source, this, null, options.beforeApply, options.afterApply);
					}
					else if (source) {
						// no changes, so record empty set
						startChangeSet.call(this, source);
						startChangeSet.call(this, "client");
					}
				}

				// if there is instance data to load then wait before loading conditions (since they may reference these instances)
				if (result.conditions) {
					conditionsFromJson(this._model, result.conditions, signal.pending(processChanges), this);
				}
				else {
					processChanges.call(this);
				}
			}), this);
		}
		else if (result.changes && result.changes.length > 0) {
			this._changeLog.applyChanges(checkpoint, result.changes, source, this, null, options.beforeApply, options.afterApply);
			if (result.conditions) {
				conditionsFromJson(this._model, result.conditions, signal.pending());
			}
		}
		else {
			if (source) {
				// no changes, so record empty set
				startChangeSet.call(this, source);
				startChangeSet.call(this, "client");
			}

			if (result.conditions) {
				conditionsFromJson(this._model, result.conditions, signal.pending());
			}
		}

		signal.waitForAll(function () {
			if (options.callback && options.callback instanceof Function) {
				options.callback.call(this);
			}
		}, this);
	},

	// General events methods
	///////////////////////////////////////////////////////////////////////
	_raiseBeginEvents: function (method, args) {
		this._raiseEvent(method + "Begin", [this, args]);
		this._raiseEvent("requestBegin", [this, args]);
	},
	_raiseEndEvents: function (method, result, args) {
		this._raiseEvent(method + result, [this, args]);
		this._raiseEvent("request" + result, [this, args]);
		this._raiseEvent(method + "End", [this, args]);
		this._raiseEvent("requestEnd", [this, args]);
	},
	addRequestBegin: function (handler) {
		this._addEvent("requestBegin", handler);
	},
	addRequestEnd: function (handler) {
		this._addEvent("requestEnd", handler);
	},
	addRequestSuccess: function (handler) {
		this._addEvent("requestSuccess", handler);
	},
	addRequestFailed: function (handler) {
		this._addEvent("requestFailed", handler);
	},

	// Raise Server Event
	///////////////////////////////////////////////////////////////////////
	raiseServerEvent: function ServerSync$raiseServerEvent(name, obj, event, includeAllChanges, success, failed, paths) {
		pendingRequests++;

		// Checkpoint the log to ensure that we only truncate changes that were saved.
		var checkpoint = this._changeLog.checkpoint("server event " + name + " " + (new Date()).format("d"));

		Sys.Observer.setValue(this, "PendingServerEvent", true);

		var args = { type: "raiseServerEvent", eventTarget: obj, eventName: name, eventRaised: event, checkpoint: checkpoint, includeAllChanges: includeAllChanges };
		this._raiseBeginEvents("raiseServerEvent", args);

		// if no event object is provided then use an empty object
		if (event === undefined || event === null) {
			event = {};
		}

		for (var key in event) {
			var arg = event[key];

			if (arg instanceof Array) {
				event[key] = arg.map(function (a) { return toExoModel(a, this._translator); }, this);
				}
			else {
				event[key] = toExoModel(arg, this._translator);
			}
		}

		eventProvider(
			name,
			toExoModel(obj, this._translator),
			event,
			paths,
		// If includeAllChanges is true, then use all changes including those 
		// that should not be saved, otherwise only use changes that can be saved.
			serializeChanges.call(this, includeAllChanges, obj),
			this._onRaiseServerEventSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onRaiseServerEventFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onRaiseServerEventSuccess: function ServerSync$_onRaiseServerEventSuccess(result, args, checkpoint, callback) {
		Sys.Observer.setValue(this, "PendingServerEvent", false);

		args.responseObject = result;

		this._handleResult(result, args.name, checkpoint, function () {
			var event = result.events[0];
			if (event instanceof Array) {
				for (var i = 0; i < event.length; ++i) {
					event[i] = fromExoModel(event[i], this._translator, true);
				}
			}
			else {
				event = fromExoModel(event, this._translator, true);
			}

			restoreDates(event);

			result.event = event;
			args.eventResponse = event;

			this._raiseEndEvents("raiseServerEvent", "Success", args);

			if (callback && callback instanceof Function)
				callback.call(this, result);

			pendingRequests--;
		});
	},
	_onRaiseServerEventFailed: function ServerSync$_onRaiseServerEventFailed(error, args, callback) {
		Sys.Observer.setValue(this, "PendingServerEvent", false);

		args.error = error;

		this._raiseEndEvents("raiseServerEvent", "Failed", args);

		if (callback && callback instanceof Function)
			callback.call(this, error);

		pendingRequests--;
	},
	addRaiseServerEventBegin: function (handler) {
		this._addEvent("raiseServerEventBegin", handler);
	},
	addRaiseServerEventEnd: function (handler) {
		this._addEvent("raiseServerEventEnd", handler);
	},
	addRaiseServerEventSuccess: function (handler) {
		this._addEvent("raiseServerEventSuccess", handler);
	},
	addRaiseServerEventFailed: function (handler) {
		this._addEvent("raiseServerEventFailed", handler);
	},

	// Roundtrip
	///////////////////////////////////////////////////////////////////////
	roundtrip: function ServerSync$roundtrip(root, paths, success, failed) {
		pendingRequests++;

		if (root && root instanceof Function) {
			success = root;
			failed = paths;
			root = null;
			paths = null;
		}

		var checkpoint = this._changeLog.checkpoint("roundtrip " + (new Date()).format("d"));

		Sys.Observer.setValue(this, "PendingRoundtrip", true);

		var args = { type: "roundtrip", checkpoint: checkpoint };
		this._raiseBeginEvents("roundtrip", args);

		var mtype = root ? root.meta.type || root.meta : null;
		var id = root ? root.meta.id || STATIC_ID : null;

		roundtripProvider(
			mtype ? mtype.get_fullName() : null,
			id,
			paths,
			serializeChanges.call(this, !!root, root),
			this._onRoundtripSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onRoundtripFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onRoundtripSuccess: function ServerSync$_onRoundtripSuccess(result, args, checkpoint, callback) {
		Sys.Observer.setValue(this, "PendingRoundtrip", false);

		args.responseObject = result;

		this._handleResult(result, "roundtrip", checkpoint, function () {
			this._raiseEndEvents("roundtrip", "Success", args);

			if (callback && callback instanceof Function)
				callback.call(this, result);

			pendingRequests--;
		});
	},
	_onRoundtripFailed: function ServerSync$_onRoundtripFailed(error, args, callback) {
		Sys.Observer.setValue(this, "PendingRoundtrip", false);

		args.error = error;

		this._raiseEndEvents("roundtrip", "Failed", args);

		if (callback && callback instanceof Function)
			callback.call(this, error);

		pendingRequests--;
	},
	startAutoRoundtrip: function ServerSync$startAutoRoundtrip(interval) {
		//ExoWeb.trace.log("server", "auto-roundtrip enabled - interval of {0} milliseconds", [interval]);

		// cancel any pending roundtrip schedule
		this.stopAutoRoundtrip();

		function doRoundtrip() {
			//ExoWeb.trace.log("server", "auto-roundtrip starting ({0})", [new Date()]);
			this.roundtrip(function () {
				//ExoWeb.trace.log("server", "auto-roundtrip complete ({0})", [new Date()]);
				this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
			});
		}

		this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
	},
	stopAutoRoundtrip: function ServerSync$stopAutoRoundtrip() {
		if (this._roundtripTimeout) {
			window.clearTimeout(this._roundtripTimeout);
		}
	},

	// Save
	///////////////////////////////////////////////////////////////////////
	save: function ServerSync$save(root, success, failed) {
		pendingRequests++;

		// Checkpoint the log to ensure that we only truncate changes that were saved.
		var checkpoint = this._changeLog.checkpoint("save " + (new Date()).format("d"));

		Sys.Observer.setValue(this, "PendingSave", true);

		var args = { type: "save", root: root, checkpoint: checkpoint };
		this._raiseBeginEvents("save", args);

		saveProvider(
			toExoModel(root, this._translator),
			serializeChanges.call(this, false, root),
			this._onSaveSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onSaveFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onSaveSuccess: function ServerSync$_onSaveSuccess(result, args, checkpoint, callback) {
		Sys.Observer.setValue(this, "PendingSave", false);

		args.responseObject = result;

		this._handleResult(result, "save", checkpoint, function () {
			this._raiseEndEvents("save", "Success", args);

			if (callback && callback instanceof Function)
				callback.call(this, result);

			pendingRequests--;
		});
	},
	_onSaveFailed: function (error, args, callback) {
		Sys.Observer.setValue(this, "PendingSave", false);

		args.error = error;

		this._raiseEndEvents("save", "Failed", args);

		if (callback && callback instanceof Function)
			callback.call(this, error);

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

		function doAutoSave() {
			//ExoWeb.trace.log("server", "auto-save starting ({0})", [new Date()]);
			this.save(this._saveRoot, function ServerSync$doAutoSave$callback() {
				//ExoWeb.trace.log("server", "auto-save complete ({0})", [new Date()]);

				// wait for the next change before next auto save
				this._saveTimeout = null;
			});
		}

		this._saveTimeout = window.setTimeout(doAutoSave.bind(this), this._saveInterval);
	},
	addSaveBegin: function (handler) {
		this._addEvent("saveBegin", handler);
	},
	addSaveEnd: function (handler) {
		this._addEvent("saveEnd", handler);
	},
	addSaveSuccess: function (handler) {
		this._addEvent("saveSuccess", handler);
	},
	addSaveFailed: function (handler) {
		this._addEvent("saveFailed", handler);
	},

	// Rollback
	///////////////////////////////////////////////////////////////////////
	rollback: function ServerSync$rollback(steps, callback) {
		var depth = 0;

		try {
			this.beginApplyingChanges();

			var signal = new ExoWeb.Signal("ServerSync.rollback");

			function processNextChange() {
				var change = null;

				if (steps === undefined || depth < steps) {
					change = this._changeLog.undo();
					depth++;
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
			}

			processNextChange.call(this);

			signal.waitForAll(function () {
				this.endApplyingChanges();

				if (callback && callback instanceof Function) {
					callback();
				}

				Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");
			}, this);
		}
		catch (e) {
			this.endApplyingChanges();
			ExoWeb.trace.throwAndLog(["server"], e);
		}
	},
	rollbackValChange: function ServerSync$rollbackValChange(change, callback) {
		tryGetJsType(this._model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {

				Sys.Observer.setValue(srcObj, change.property, change.oldValue);
				callback();

			}, this);
		}, this);
	},
	rollbackRefChange: function ServerSync$rollbackRefChange(change, callback) {
		tryGetJsType(this._model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {
				if (change.oldValue) {
					tryGetJsType(this._model, change.oldValue.type, null, true, function (refType) {
						tryGetEntity(this._model, this._translator, refType, change.oldValue.id, change.property, LazyLoadEnum.None, function (refObj) {
							Sys.Observer.setValue(srcObj, change.property, refObj);
							callback();
						}, this);
					}, this);
				}
				else {
					Sys.Observer.setValue(srcObj, change.property, null);
					callback();
				}
			}, this);
		}, this);
	},
	rollbackInitChange: function ServerSync$rollbackInitChange(change, callback) {
		//TODO: need to remove from the translator
		callback();
	},
	rollbackListChange: function ServerSync$rollbackListChange(change, callback) {
		tryGetJsType(this._model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {
				var prop = srcObj.meta.property(change.property, true);
				var list = prop.value(srcObj);
				var translator = this._translator;

				list.beginUpdate();

				// Rollback added items
				Array.forEach(change.added, function rollbackListChanges$added(item) {
					tryGetJsType(this._model, item.type, null, false, function (itemType) {
						var childObj = fromExoModel(item, translator);
						if (childObj) {
							list.remove(childObj);
						}
					}, this);
				});

				// Rollback removed items
				Array.forEach(change.removed, function rollbackListChanges$added(item) {
					tryGetJsType(this._model, item.type, null, true, function (itemType) {
						var childObj = fromExoModel(item, translator, true);

						list.add(childObj);
					}, this);
				});

				list.endUpdate();

				callback();
			}, this);
		}, this);
	},

	// Various
	///////////////////////////////////////////////////////////////////////
	_captureChange: function ServerSync$_captureChange(change) {
		if (!this.isApplyingChanges() && this.isCapturingChanges()) {
			if (change.property) {
				var instance = fromExoModel(change.instance, this._translator);
				var property = instance.meta.property(change.property, true);

				if (property.get_jstype() === Date && change.newValue && property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
					var serverOffset = this.get_ServerTimezoneOffset();
					var localOffset = -(new Date().getTimezoneOffset() / 60);
					var difference = localOffset - serverOffset;
					change.newValue = change.newValue.addHours(difference);
				}
			}

			this._changeLog.add(change);

			Sys.Observer.raisePropertyChanged(this, "HasPendingChanges");

			if (this._saveInterval)
				this._queueAutoSave();
		}
	},
	get_Changes: function ServerSync$get_Changes(includeAllChanges/*, ignoreWarning*/) {
		if (arguments.length < 2 || arguments[1] !== true) {
			ExoWeb.trace.logWarning("server", "Method get_Changes is not intended for long-term use - it will be removed in the near future.");
		}

		var list = [];
		var sets = this._changeLog.serialize(includeAllChanges ? null : this.canSave, this);
		sets.forEach(function (set) {
			list.addRange(set.changes);
		});
		return list;
	},
	get_HasPendingChanges: function ServerSync$get_HasPendingChanges() {
		return this._changeLog.sets().some(function (set) {
			return set.changes().some(function (change) {
				return this.canSave(change);
			}, this);
		}, this);
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
	get_ServerTimezoneOffset: function ServerSync$get_ServerTimezoneOffset() {
		//if we have not set the server timezone offset yet, retrieve it from the server
		var timezoneOffset = 0;

		if (this._serverInfo !== null) {
			timezoneOffset = this._serverInfo.TimeZoneOffset;
		}

		return timezoneOffset;
	},
	set_ServerInfo: function ServerSync$set_ServerTimezoneOffset(newInfo) {
		//join the new server info with the information that you are adding.
		this._serverInfo = this._serverInfo ? $.extend(this._serverInfo, newInfo) : newInfo;
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

ServerSync.GetServerTimeZone = function ServerSync$GetServerTimeZone(root) {
	var model;
	if (root instanceof ExoWeb.Model.Entity) {
		model = root.meta.type.get_model();
	}

	if (model && model instanceof ExoWeb.Model.Model) {
		if (model._server) {
			return model._server.get_ServerTimezoneOffset(root);
		}
		else {
			// TODO
		}
	}
};
