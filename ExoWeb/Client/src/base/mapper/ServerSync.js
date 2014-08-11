/// <reference path="../core/Array.js" />
/// <reference path="../core/Errors.js" />
/// <reference path="../core/Function.js" />
/// <reference path="../core/Functor.js" />
/// <reference path="../core/Signal.js" />
/// <reference path="../core/EventScope.js" />
/// <reference path="../core/Observer.js" />
/// <reference path="../core/Translator.js" />
/// <reference path="../model/Model.js" />
/// <reference path="../model/Entity.js" />
/// <reference path="../model/ObjectMeta.js" />
/// <reference path="../model/LazyLoader.js" />
/// <reference path="SaveProvider.js" />
/// <reference path="RoundtripProvider.js" />
/// <reference path="EventProvider.js" />
/// <reference path="ExoModelEventListener.js" />
/// <reference path="ObjectLazyLoader.js" />
/// <reference path="ChangeSet.js" />
/// <reference path="ChangeLog.js" />
/// <reference path="Internals.js" />

/*globals window, setTimeout, clearTimeout, context */
/*globals Functor, Translator, Observer, ArgumentNullError, ArgumentTypeError */
/*globals Model, Entity, LazyLoader, ObjectLazyLoader, ChangeLog, ExoModelEventListener, fromExoModel */
/*global saveProvider, roundtripProvider, eventProvider, objectProvider */

function ServerSync(model) {
	"use strict";

	// Basic argument validation.
	if (model === null || model === undefined) {
		throw new ArgumentNullError("model");
	}
	if (typeof (model) !== "object" || !(model instanceof Model)) {
		throw new ArgumentTypeError("model", "model", model);
	}

	// Create the necessary local variables.
	var changeLog = new ChangeLog(),
		translator = new Translator(),
		objectsDeleted = [],
		isObjectDeleted = function (deletedObjectsList, obj, isChange) {
			if (Array.contains(deletedObjectsList, obj)) {
				if (isChange) {
					logWarning($format("Object {0}|{1} was changed but has been deleted.", obj.meta.type.get_fullName(), obj.meta.id));
				}
				return true;
			}
			return false;
		},
		filterObjectEvent = function (obj) {
			return !isObjectDeleted(objectsDeleted, obj, false);
		},
		filterPropertyEvent = function (obj) {
			return !isObjectDeleted(objectsDeleted, obj, true);
		},
		listener = new ExoModelEventListener(model, translator, {
			listChanged: filterPropertyEvent,
			propertyChanged: filterPropertyEvent,
			objectRegistered: filterObjectEvent,
			objectUnregistered: filterObjectEvent
		}),
		applyingChanges = 0,
		isCapturingChanges = false,
		self = this;

	// When the event listener detects a change then pass it along to the change log.
	listener.addChangeDetected(function (change) {
		if (applyingChanges <= 0 && isCapturingChanges === true) {
			if (change.property) {
				var instance = fromExoModel(change.instance, translator);
				var property = instance.meta.property(change.property);

				if (property.get_jstype() === Date && change.newValue && property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
					var serverOffset = self.get_ServerTimezoneOffset();
					var localOffset = -(new Date().getTimezoneOffset() / 60);
					var difference = localOffset - serverOffset;
					change.newValue = change.newValue.addHours(difference);
				}
				else if (change.newValue && change.newValue instanceof TimeSpan) {
					change.newValue = change.newValue.toObject();
				}
			}

			changeLog.add(change);

			self._raiseEvent("changesDetected", [self, { reason: "listener.addChangeDetected", changes: [change] }]);

			// Restart auto-save interval if necessary.
			if (self._saveInterval && self.canSave(change) && isPropertyChangePersisted(change)) {
				self._queueAutoSave();
			}
		}
	});

	// Applying changes (e.g. via a server response change set).
	this.isApplyingChanges = function () {
		return applyingChanges > 0;
	};
	this.beginApplyingChanges = function () {
		applyingChanges += 1;
	};
	this.endApplyingChanges = function () {
		applyingChanges -= 1;

		if (applyingChanges < 0) {
			throw new Error("Error in transaction log processing: unmatched begin and end applying changes.");
		}
	};

	// Capturing changes (i.e. after context initialization has completed).
	this.isCapturingChanges = function () {
		return isCapturingChanges === true;
	};
	this.beginCapturingChanges = function () {
		if (!isCapturingChanges) {
			isCapturingChanges = true;
			changeLog.start({ user: this._localUser });
		}
	};
	this.ignoreChanges = function (before, callback, after, thisPtr) {
		if (arguments.length === 1) {
			callback = arguments[0];
			before = null;
		}

		return function () {
			var beforeCalled = false;

			try {
				applyingChanges += 1;

				if (before && before instanceof Function) {
					before();
				}

				beforeCalled = true;

				callback.apply(thisPtr || this, arguments);
			} finally {
				applyingChanges -= 1;

				if (beforeCalled === true && after && after instanceof Function) {
					after();
				}
			}
		};
	};

	this.isObjectDeleted = function (obj, isChange) {
		return isObjectDeleted(objectsDeleted, obj, isChange);
	};

	// If an existing object is registered then register it for lazy loading.
	model.addObjectRegistered(function (obj) {
		if (!obj.meta.isNew && obj.meta.type.get_origin() === "server" && isCapturingChanges === true && !applyingChanges) {
			ObjectLazyLoader.register(obj);
		}
	});

	// Link model and server objects.
	Object.defineProperty(this, "model", { value: model });
	Object.defineProperty(model, "server", { value: this });

	// Assign backing fields as needed
	this._changeLog = changeLog;
	this._scopeQueries = [];
	this._objectsExcludedFromSave = [];
	this._objectsDeleted = objectsDeleted;
	this._translator = translator;
	this._serverInfo = null;
	this._localUser = null;

	Observer.makeObservable(this);
}

function isPropertyChangePersisted(change) {
	if (change.property) {
		var jstype = Model.getJsType(change.instance.type, true);
		if (jstype) {
			var prop = jstype.meta.property(change.property);
			// Can't save non-persisted properties
			if (!prop.get_isPersisted()) {
				return false;
			}
		}
	}
	return true;
}

ServerSync.mixin(Functor.eventing);

var pendingRequests = 0;

registerActivity("ServerSync: request", function() {
	return pendingRequests > 0;
});

function serializeChanges(includeAllChanges, simulateInitRoot) {
	var changes = this._changeLog.serialize(includeAllChanges ? this.canSend : this.canSave, this);

	// temporary HACK (no, really): splice InitNew changes into init transaction
	if (simulateInitRoot && simulateInitRoot.meta.isNew) {
		function isRootInitChange(change) {
			return change.type === "InitNew" && change.instance.type === simulateInitRoot.meta.type.get_fullName() &&
				(change.instance.id === simulateInitRoot.meta.id || this._translator.reverse(change.instance.type, change.instance.id) === simulateInitRoot.meta.id);
		}

		var found = false;
		var initSet = changes.filter(function(set) { return set.source === "init"; })[0];
		if (!initSet || !initSet.changes.some(isRootInitChange, this)) {
			changes.forEach(function(set) {
				if (found === true) return;
				set.changes.forEach(function(change, index) {
					if (found === true) return;
					else if (isRootInitChange.call(this, change)) {
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

// when ServerSync is made singleton, this data will be referenced via closure
function ServerSync$addScopeQuery(query) {
	this._scopeQueries.push(query);
}

function ServerSync$storeInitChanges(changes) {
	var activeSet = this._changeLog.activeSet;

	this._changeLog.addSet("init", null, null, changes);

	if (activeSet) {
		this._changeLog.start({ title: activeSet.title, user: activeSet.user });
	}
}

function ServerSync$retroactivelyFixChangeWhereIdChanged(changeInstance, obj) {
	// Update change to reflect the object's new id if it is referencing a legacy id
	if (changeInstance.id === obj.meta.legacyId) {
		changeInstance.id = obj.meta.id;
		changeInstance.isNew = false;
	}
}

ServerSync.mixin({
	// Enable/disable save & related functions
	///////////////////////////////////////////////////////////////////////
	enableSave: function ServerSync$enableSave(obj) {
		if (!(obj instanceof Entity)) {
			throw new Error("Can only enableSave on entity objects.");
		}

		if (Array.contains(this._objectsExcludedFromSave, obj)) {
			var oldPendingChanges;
			if (this._saveRoot) {
				// If autosave is enabled then determine if we need to queue a timeout
				oldPendingChanges = this.changes(false, this._saveRoot, true);
			}
			Array.remove(this._objectsExcludedFromSave, obj);

			this._raiseEvent("changesDetected", [this, { reason: "enableSave" }]);

			// Determine if ther are now pending changes
			if (oldPendingChanges && oldPendingChanges.length === 0 && this._saveInterval && !this._saveTimeout) {
				if (this.changes(false, this._saveRoot, true).length > 0) {
					this._queueAutoSave();
				}
			}
			return true;
		}
	},
	disableSave: function ServerSync$disableSave(obj) {
		if (!(obj instanceof Entity)) {
			throw new Error("Can only disableSave on entity objects.");
		}

		if (!Array.contains(this._objectsExcludedFromSave, obj)) {
			var oldPendingChanges;
			if (this._saveRoot) {
				// If autosave is enabled then determine if we need to queue a timeout
				oldPendingChanges = this.changes(false, this._saveRoot, true);
			}
			this._objectsExcludedFromSave.push(obj);

			this._raiseEvent("changesDetected", [this, { reason: "disableSave" }]);

			// Determine if ther are no longer pending changes
			if (oldPendingChanges && oldPendingChanges.length > 0 && this._saveInterval && this._saveTimeout) {
				if (this.changes(false, this._saveRoot, true).length === 0) {
					window.clearTimeout(this._saveTimeout);
					this._saveTimeout = null;
				}
			}
			return true;
		}
	},
	notifyDeleted: function ServerSync$notifyDeleted(obj) {
		if (!(obj instanceof Entity)) {
			throw new Error("Notified of deleted object that is not an entity.");
		}

		if (!Array.contains(this._objectsDeleted, obj)) {
			this._objectsDeleted.push(obj);
			return true;
		}

		return false;
	},
	canSend: function (change) {

		// Checkpoint is a client-only event type.
		if (change.type === "Checkpoint") {
			return false;
		}

		if (change.instance) {
			var type = Model.getJsType(change.instance.type, true);
			if (type && LazyLoader.isLoaded(type.meta)) {
				if (type.meta.get_origin() !== "server") {
					// Don't send change events for types that didn't originate from the server.
					return false;
				}

				if (change.property) {
					var property = type.meta.property(change.property);
					// Don't send property change events for properties that didn't originate from the server, or static properties.
					if (property.get_origin() !== "server" || property.get_isStatic()) {
						return false;
					}
				}

				// Don't send changes for deleted objects.
				var obj = fromExoModel(change.instance, this._translator, false, this._objectsDeleted);
				if (obj && this.isObjectDeleted(obj, false)) {
					return false;
				}
			}
		}

		// Event is ok to send.
		return true;
	},
	canSaveObject: function ServerSync$canSaveObject(objOrMeta) {
		var obj;
		var errorFmt = "Unable to test whether object can be saved:  {0}.";

		if (objOrMeta == null) {
			throw new ArgumentNullError("objOrMeta");
		}
		else if (objOrMeta instanceof ExoWeb.Model.ObjectMeta) {
			obj = objOrMeta._obj;
		}
		else if (objOrMeta instanceof Entity) {
			obj = objOrMeta;
		}
		else {
			throw new ArgumentTypeError("objOrMeta", "ObjectMeta|Entity", objOrMeta);
		}

		return !Array.contains(this._objectsExcludedFromSave, obj) && !Array.contains(this._objectsDeleted, obj);
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
					if (!item.type || !ExoWeb.Model.Model.getJsType(item.type, true)) {
						ignore = false;
					}
					else {
						var obj = fromExoModel(item, this._translator, false, this._objectsDeleted);
						// Only objects that exist can be disabled
						if (!obj || this.canSaveObject(obj)) {
							ignore = false;
						}
					}
				}, this);
				Array.forEach(change.removed, function (item) {
					// if the type doesn't exist then obviously the instance doesn't either
					if (!item.type || !ExoWeb.Model.Model.getJsType(item.type, true)) {
						ignore = false;
					}
					else {
						var obj = fromExoModel(item, this._translator, false, this._objectsDeleted);
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
				var oldValue = fromExoModel(change.oldValue, this._translator, false, this._objectsDeleted);
				if (oldValue && !this.canSaveObject(oldValue)) {
					return false;
				}
			}

			var newJsType = change.newValue && ExoWeb.Model.Model.getJsType(change.newValue.type, true);
			if (newJsType) {
				var newValue = fromExoModel(change.newValue, this._translator, false, this._objectsDeleted);
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
		var instanceObj = fromExoModel(change.instance, this._translator, false, this._objectsDeleted);
		return !instanceObj || this.canSaveObject(instanceObj);
	},

	_handleResult: function ServerSync$_handleResult(result, description, checkpoint, callbackOrOptions) {
		var callback, beforeApply = null, afterApply = null;

		if (callbackOrOptions instanceof Function) {
			callback = callbackOrOptions;
		}
		else {
			callback = callbackOrOptions.callback;
			beforeApply = callbackOrOptions.beforeApply;
			afterApply = callbackOrOptions.afterApply;
		}

		ResponseHandler.execute(this.model, this, {
			instances: result.instances,
			conditions: result.conditions,
			types: result.types && result.types instanceof Array ? null : result.types,
			changes: result.changes,
			source: "server",
			description: description,
			checkpoint: checkpoint,
			serverInfo: result.serverInfo,
			beforeApply: beforeApply,
			afterApply: afterApply
		}, callback, this);
	},

	// General events methods
	///////////////////////////////////////////////////////////////////////
	addRequestBegin: function (handler) {
		this._addEvent("requestBegin", handler);
	},
	removeRequestBegin: function (handler) {
		this._removeEvent("requestBegin", handler);
	},
	addRequestEnd: function (handler) {
		this._addEvent("requestEnd", handler);
	},
	removeRequestEnd: function (handler) {
		this._removeEvent("requestEnd", handler);
	},
	addRequestSuccess: function (handler) {
		this._addEvent("requestSuccess", handler);
	},
	removeRequestSuccess: function (handler) {
		this._removeEvent("requestSuccess", handler);
	},
	addRequestFailed: function (handler) {
		this._addEvent("requestFailed", handler);
	},
	removeRequestFailed: function (handler) {
		this._removeEvent("requestFailed", handler);
	},

	// Raise Server Event
	///////////////////////////////////////////////////////////////////////
	raiseServerEvent: function ServerSync$raiseServerEvent(name, target, event, includeAllChanges, success, failed, paths) {
		/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.save">
		/// Raise a server event on the given target. The given success or failure callback is invoked
		/// when the request is complete.
		/// </summary>
		/// <param name="name" optional="false" mayBeNull="false" type="String"></param>
		/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity"></param>
		/// <param name="event" optional="true" mayBeNull="null" type="Object"></param>
		/// <param name="success" optional="true" mayBeNull="true" type="Function"></param>
		/// <param name="failed" optional="true" mayBeNull="true" type="Function"></param>
		/// <param name="paths" optional="true" mayBeNull="true" isArray="true" type="String"></param>

		var args, checkpoint, serializedEvent, serializedEventTarget, eventPropName;

		pendingRequests++;

		// Checkpoint the log to ensure that we only truncate changes that were saved.
		checkpoint = this._changeLog.checkpoint("raiseServerEvent(" + name + ")-" + +(new Date()));

		args = {
			type: "raiseServerEvent",
			target: target,
			checkpoint: checkpoint,
			includeAllChanges: includeAllChanges
		};

		args.eventName = name;
		args.eventObject = event;

		this._raiseEvent("raiseServerEventBegin", [this, args]);

		serializedEvent = {};

		// If an event object is provided then convert its entity properties into their serialized form.
		if (event !== undefined && event !== null) {
			for (eventPropName in event) {
				var arg = event[eventPropName];

				if (arg instanceof Array) {
					serializedEvent[eventPropName] = arg.map(function (a) { return toExoModel(a, this._translator); }, this);
				} else {
					serializedEvent[eventPropName] = toExoModel(arg, this._translator);
				}
			}
		}

		serializedEventTarget = toExoModel(target, this._translator);

		args.root = serializedEventTarget;
		args.eventData = serializedEvent;

		this._raiseEvent("requestBegin", [this, args]);

		eventProvider(
			name,
			serializedEventTarget,
			serializedEvent,
			paths,
			serializeChanges.call(this, includeAllChanges, target),
			this._onRaiseServerEventSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onRaiseServerEventFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onRaiseServerEventSuccess: function ServerSync$_onRaiseServerEventSuccess(result, args, checkpoint, callback) {
		args.responseObject = result;
		args.requestSucceeded = true;

		this._raiseEvent("requestEnd", [this, args]);

		this._handleResult(result, "raiseServerEvent(" + args.eventName + ")", checkpoint, function () {
			this._raiseEvent("requestSuccess", [this, args]);

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

			args.eventResult = event;

			this._raiseEvent("raiseServerEventEnd", [this, args]);
			this._raiseEvent("raiseServerEventSuccess", [this, args]);

			if (callback && callback instanceof Function) {
				callback(result);
			}

			pendingRequests--;
		});
	},
	_onRaiseServerEventFailed: function ServerSync$_onRaiseServerEventFailed(error, args, callback) {
		args.responseObject = error;
		args.requestSucceeded = false;

		this._raiseEvent("requestEnd", [this, args]);
		this._raiseEvent("requestFailed", [this, args]);

		this._raiseEvent("raiseServerEventEnd", [this, args]);
		this._raiseEvent("raiseServerEventFailed", [this, args]);

		if (callback && callback instanceof Function) {
			callback(error);
		}

		pendingRequests--;
	},
	addRaiseServerEventBegin: function (handler) {
		this._addEvent("raiseServerEventBegin", handler);
	},
	removeRaiseServerEventBegin: function (handler) {
		this._removeEvent("raiseServerEventBegin", handler);
	},
	addRaiseServerEventEnd: function (handler) {
		this._addEvent("raiseServerEventEnd", handler);
	},
	removeRaiseServerEventEnd: function (handler) {
		this._removeEvent("raiseServerEventEnd", handler);
	},
	addRaiseServerEventSuccess: function (handler) {
		this._addEvent("raiseServerEventSuccess", handler);
	},
	removeRaiseServerEventSuccess: function (handler) {
		this._removeEvent("raiseServerEventSuccess", handler);
	},
	addRaiseServerEventFailed: function (handler) {
		this._addEvent("raiseServerEventFailed", handler);
	},
	removeRaiseServerEventFailed: function (handler) {
		this._removeEvent("raiseServerEventFailed", handler);
	},

	// Roundtrip
	///////////////////////////////////////////////////////////////////////
	roundtrip: function ServerSync$roundtrip(target, paths, success, failed) {
		/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.save">
		/// Roundtrips the current changes to the server. The given success or failure callback is
		/// invoked when the request is complete.
		/// </summary>
		/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity"></param>
		/// <param name="paths" optional="false" mayBeNull="true" isArray="true" type="String"></param>
		/// <param name="success" optional="false" mayBeNull="true" type="Function"></param>
		/// <param name="failed" optional="false" mayBeNull="true" type="Function"></param>

		var args, checkpoint, serializedTarget, includeAllChanges;

		pendingRequests++;

		if (target && target instanceof Function) {
			success = target;
			failed = paths;
			target = null;
			paths = null;
		}

		checkpoint = this._changeLog.checkpoint("roundtrip-" + +(new Date()));

		if (target) {
			includeAllChanges = true;
		} else {
			includeAllChanges = false;
		}

		args = {
			type: "roundtrip",
			target: target || null,
			checkpoint: checkpoint,
			includeAllChanges: includeAllChanges
		};

		this._raiseEvent("roundtripBegin", [this, args]);

		if (target) {
			serializedTarget = toExoModel(target, this._translator);
		} else {
			serializedTarget = null;
		}

		args.root = serializedTarget;

		this._raiseEvent("requestBegin", [this, args]);

		roundtripProvider(
			serializedTarget,
			paths,
			serializeChanges.call(this, includeAllChanges, target),
			this._onRoundtripSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onRoundtripFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onRoundtripSuccess: function ServerSync$_onRoundtripSuccess(result, args, checkpoint, callback) {
		args.responseObject = result;
		args.requestSucceeded = true;

		this._raiseEvent("requestEnd", [this, args]);

		this._handleResult(result, "roundtrip", checkpoint, function () {
			this._raiseEvent("requestSuccess", [this, args]);
			this._raiseEvent("roundtripEnd", [this, args]);
			this._raiseEvent("roundtripSuccess", [this, args]);

			if (callback && callback instanceof Function) {
				callback(result);
			}

			pendingRequests--;
		});
	},
	_onRoundtripFailed: function ServerSync$_onRoundtripFailed(error, args, callback) {
		args.responseObject = error;
		args.requestSucceeded = false;

		this._raiseEvent("requestEnd", [this, args]);
		this._raiseEvent("requestFailed", [this, args]);

		this._raiseEvent("roundtripEnd", [this, args]);
		this._raiseEvent("roundtripFailed", [this, args]);

		if (callback && callback instanceof Function) {
			callback(error);
		}

		pendingRequests--;
	},
	startAutoRoundtrip: function (interval) {
		if (!interval || typeof(interval) !== "number" || interval <= 0) {
			throw new Error("An interval must be specified for auto-save.");
		}

		// cancel any pending roundtrip schedule
		this.stopAutoRoundtrip();

		function doRoundtrip() {
			this.roundtrip(function () {
				this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
			});
		}

		this._roundtripTimeout = window.setTimeout(doRoundtrip.bind(this), interval);
	},
	stopAutoRoundtrip: function () {
		if (this._roundtripTimeout) {
			window.clearTimeout(this._roundtripTimeout);
		}
	},
	addRoundtripBegin: function (handler) {
		this._addEvent("roundtripBegin", handler);
	},
	removeRoundtripBegin: function (handler) {
		this._removeEvent("roundtripBegin", handler);
	},
	addRoundtripEnd: function (handler) {
		this._addEvent("roundtripEnd", handler);
	},
	removeRoundtripEnd: function (handler) {
		this._removeEvent("roundtripEnd", handler);
	},
	addRoundtripSuccess: function (handler) {
		this._addEvent("roundtripSuccess", handler);
	},
	removeRoundtripSuccess: function (handler) {
		this._removeEvent("roundtripSuccess", handler);
	},
	addRoundtripFailed: function (handler) {
		this._addEvent("roundtripFailed", handler);
	},
	removeRoundtripFailed: function (handler) {
		this._removeEvent("roundtripFailed", handler);
	},

	// Save
	///////////////////////////////////////////////////////////////////////
	save: function (target, success, failed) {
		/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.save">
		/// Saves changes to the given target and related entities. The given success or failure
		/// callback is invoked when the request is complete.
		/// </summary>
		/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity"></param>
		/// <param name="success" optional="false" mayBeNull="true" type="Function"></param>
		/// <param name="failed" optional="false" mayBeNull="true" type="Function"></param>

		var args, checkpoint, serializedTarget;

		pendingRequests++;

		// Checkpoint the log to ensure that we only truncate changes that were saved.
		checkpoint = this._changeLog.checkpoint("save-" + +(new Date()));

		args = {
			type: "save",
			target: target,
			checkpoint: checkpoint,
			includeAllChanges: false
		};

		this._raiseEvent("saveBegin", [this, args]);

		serializedTarget = toExoModel(target, this._translator);

		args.root = serializedTarget;

		this._raiseEvent("requestBegin", [this, args]);

		saveProvider(
			serializedTarget,
			serializeChanges.call(this, false, target),
			this._onSaveSuccess.bind(this).appendArguments(args, checkpoint, success),
			this._onSaveFailed.bind(this).appendArguments(args, failed || success)
		);
	},
	_onSaveSuccess: function ServerSync$_onSaveSuccess(result, args, checkpoint, callback) {
		args.responseObject = result;
		args.requestSucceeded = true;

		this._raiseEvent("requestEnd", [this, args]);

		this._handleResult(result, "save", checkpoint, function () {
			this._raiseEvent("requestSuccess", [this, args]);
			this._raiseEvent("saveEnd", [this, args]);
			this._raiseEvent("saveSuccess", [this, args]);

			if (callback && callback instanceof Function) {
				callback(result);
			}

			pendingRequests--;
		});
	},
	_onSaveFailed: function (error, args, callback) {
		args.responseObject = error;
		args.requestSucceeded = false;

		this._raiseEvent("requestEnd", [this, args]);
		this._raiseEvent("requestFailed", [this, args]);

		this._raiseEvent("saveEnd", [this, args]);
		this._raiseEvent("saveFailed", [this, args]);

		if (callback && callback instanceof Function) {
			callback(error);
		}

		pendingRequests--;
	},
	startAutoSave: function ServerSync$startAutoSave(root, interval) {
		if (!root || !(root instanceof Entity)) {
			throw new Error("A root object must be specified for auto-save.");
		}

		if (!interval || typeof(interval) !== "number" || interval <= 0) {
			throw new Error("An interval must be specified for auto-save.");
		}

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
			this.save(this._saveRoot, function ServerSync$doAutoSave$callback() {
				// wait for the next change before next auto save
				this._saveTimeout = null;
			});
		}

		this._saveTimeout = window.setTimeout(doAutoSave.bind(this), this._saveInterval);
	},
	addSaveBegin: function (handler) {
		this._addEvent("saveBegin", handler);
	},
	removeSaveBegin: function (handler) {
		this._removeEvent("saveBegin", handler);
	},
	addSaveEnd: function (handler) {
		this._addEvent("saveEnd", handler);
	},
	removeSaveEnd: function (handler) {
		this._removeEvent("saveEnd", handler);
	},
	addSaveSuccess: function (handler) {
		this._addEvent("saveSuccess", handler);
	},
	removeSaveSuccess: function (handler) {
		this._removeEvent("saveSuccess", handler);
	},
	addSaveFailed: function (handler) {
		this._addEvent("saveFailed", handler);
	},
	removeSaveFailed: function (handler) {
		this._removeEvent("saveFailed", handler);
	},

	// EnsureLoaded
	///////////////////////////////////////////////////////////////////////
	ensureLoaded: function (target, paths, includePathsFromQueries, success, failed) {
		/// <summary locid="M:J#ExoWeb.Mapper.ServerSync.ensureLoaded">
		/// Loads the given entity (and optionally a set of relative paths) if necessary. The given success or failure
		/// callback is invoked when the request is complete if loading was required. If no loading was required, the
		/// success callback is invoked after a short period of time. This artifical asynchronicity is introduced
		/// primarily to limit call stack size, and in the case of loading a consistent asynchronous experience is
		/// acceptable and perhaps even expected to some extent.
		/// </summary>
		/// <param name="target" optional="false" mayBeNull="false" type="ExoWeb.Model.Entity|ExoWeb.Model.Type"></param>
		/// <param name="paths" optional="false" mayBeNull="true" isArray="true" type="String"></param>
		/// <param name="includePathsFromQueries" mayBeNull="true" type="Boolean" optional="false"></param>
		/// <param name="success" optional="false" mayBeNull="true" type="Function"></param>
		/// <param name="failed" optional="false" mayBeNull="true" type="Function"></param>

		var args, checkpoint, serializedTarget, queryPaths, pathsToLoad, staticPath, staticProperty;

		pendingRequests++;

		if (target === null || target === undefined) {
			throw new Error("Method ensureLoaded requires a target argument.");
		}

		if (target instanceof Entity) {
			if (includePathsFromQueries) {
				// Get the paths from the original query(ies) that apply to the target object (based on type).
				queryPaths = ObjectLazyLoader.getRelativePaths(target);
				if (paths) {
					pathsToLoad = paths.concat(queryPaths);
				} else {
					pathsToLoad = queryPaths;
				}
			} else {
				pathsToLoad = paths || [];
			}
		} else {
			// For static loading a single array or object will be loaded with no additional paths.
			pathsToLoad = [];

			// Use the meta type if a type constructor was used as the target.
			if (target instanceof Function && target.meta && target.meta && target.meta instanceof Type) {
				target = target.meta;
			}

			if (!(target instanceof Type)) {
				throw new Error($format("Method ensureLoaded expects target of type Entity or Type, but found type \"{0}\".", parseFunctionName(target.constructor)));
			}

			if (paths === null || paths === undefined) {
				throw new Error("Method ensureLoaded requires a paths argument for static property loading.");
			}

			if (Object.prototype.toString.call(paths) === "[object String]") {
				staticPath = paths;
			} else if (Object.prototype.toString.call(paths) === "[object Array]") {
				if (paths.length === 1) {
					staticPath = paths[0];
				} else {
					throw new Error($format("Multiple paths cannot be specified when ensuring that static property information is loaded: \"{0}.[{1}]\".", target.get_fullName(), paths.join(",")));
				}
			} else {
				throw new Error($format("Argument \"paths\" was expected to be a string or array of strings, but found type \"{0}\" instead.", parseFunctionName(target.constructor)));
			}

			// Static property path can only be a single property name, not a multi-step path.
			if (staticPath.indexOf(".") >= 0) {
				throw new Error($format("Multiple path steps cannot be specified when ensuring that static property information is loaded: \"{0}.{1}\".", target.get_fullName(), staticPath));
			}

			// Get the meta property for the given single path.
			staticProperty = target.property(staticPath);

			// Prepend the target type name to the static path for later use in logging and errors, etc.
			staticPath = target.get_fullName() + "." + staticPath;

			// Get the static path value and verify that there is a value in order to ensure loading.
			target = staticProperty.value(target);
			if (target === null || target === undefined) {
				throw new Error($format("Unable to ensure that static path \"{0}\" is loaded because it evaluates to a null or undefined value.", staticPath));
			}
		}

		// Checkpoint the log to ensure that we only truncate changes that were saved.
		checkpoint = this._changeLog.checkpoint("ensureLoaded" + +(new Date()));

		args = {
			type: "ensureLoaded",
			target: target instanceof Entity ? target : null,
			checkpoint: checkpoint,
			includeAllChanges: true
		};

		this._raiseEvent("ensureLoadedBegin", [this, args]);

		// Check if the object or any of the paths require loading. Apply the array of paths to the
		// isLoaded call, since the paths will be obtained as "rest" parameters.
		if (!LazyLoader.isLoaded.apply(null, [target].concat(pathsToLoad))) {
			serializedTarget = target instanceof Entity ? toExoModel(target, this._translator) : null;

			args.root = serializedTarget;

			this._raiseEvent("requestBegin", [this, args]);

			// TODO: reference to server will be a singleton, not context
			objectProvider(
				target instanceof Entity ? target.meta.type.get_fullName() : target.get_fullName(),
				target instanceof Entity ? [target.meta.id] : [],
				pathsToLoad,
				false, // in scope?
				serializeChanges.call(this, true),
				this._onEnsureLoadedSuccess.bind(this).appendArguments(args, checkpoint, success),
				this._onEnsureLoadedFailed.bind(this).appendArguments(args, failed || success));
		} else {
			var self = this;
			window.setTimeout(function () {
				args.requiredLoading = false;

				self._raiseEvent("ensureLoadedEnd", [self, args]);
				self._raiseEvent("ensureLoadedSuccess", [self, args]);

				if (success && success instanceof Function) {
					success();
				}

				pendingRequests--;
			}, 1);
		}
	},
	_onEnsureLoadedSuccess: function (result, args, checkpoint, callback) {
		args.responseObject = result;
		args.requestSucceeded = true;

		this._raiseEvent("requestEnd", [this, args]);

		this._handleResult(result, "ensureLoaded", checkpoint, function () {
			this._raiseEvent("requestSuccess", [this, args]);

			args.requiredLoading = true;

			this._raiseEvent("ensureLoadedEnd", [this, args]);
			this._raiseEvent("ensureLoadedSuccess", [this, args]);

			if (callback && callback instanceof Function) {
				callback(result);
			}

			pendingRequests--;
		});
	},
	_onEnsureLoadedFailed: function (error, args, callback) {
		args.responseObject = error;
		args.requestSucceeded = false;

		this._raiseEvent("requestEnd", [this, args]);
		this._raiseEvent("requestFailed", [this, args]);

		args.requiredLoading = true;

		this._raiseEvent("ensureLoadedEnd", [this, args]);
		this._raiseEvent("ensureLoadedFailed", [this, args]);

		if (callback && callback instanceof Function) {
			callback(error);
		}

		pendingRequests--;
	},
	addEnsureLoadedBegin: function (handler) {
		this._addEvent("ensureLoadedBegin", handler);
	},
	removeEnsureLoadedBegin: function (handler) {
		this._removeEvent("ensureLoadedBegin", handler);
	},
	addEnsureLoadedEnd: function (handler) {
		this._addEvent("ensureLoadedEnd", handler);
	},
	removeEnsureLoadedEnd: function (handler) {
		this._removeEvent("ensureLoadedEnd", handler);
	},
	addEnsureLoadedSuccess: function (handler) {
		this._addEvent("ensureLoadedSuccess", handler);
	},
	removeEnsureLoadedSuccess: function (handler) {
		this._removeEvent("ensureLoadedSuccess", handler);
	},
	addEnsureLoadedFailed: function (handler) {
		this._addEvent("ensureLoadedFailed", handler);
	},
	removeEnsureLoadedFailed: function (handler) {
		this._removeEvent("ensureLoadedFailed", handler);
	},

	// Apply Changes
	///////////////////////////////////////////////////////////////////////
	applyChanges: function (checkpoint, changes, source, user, setId, filter, beforeApply, afterApply, callback, thisPtr) {
		if (!changes || !(changes instanceof Array)) {
			if (callback) {
				callback.call(thisPtr || this);
			}
			return;
		}

		if (source == null) throw new ArgumentNullError("source");

		var newChanges = [];

		var signal = new Signal("applyChanges");
		var waitForAllRegistered = false;
		var batchStarted = false;
		var changesApplying = false;
		var callbackInvoked = false;
		var methodExited = false;

		try {
			var batch = ExoWeb.Batch.start("apply changes");
			batchStarted = true;

			this.beginApplyingChanges();
			changesApplying = true;

			if (this._changeLog.activeSet) {
				this._changeLog.stop();
			}

			var changeSet = this._changeLog.addSet(source, null, user, null, setId);

			// Determine that the target of a change is a new instance
			var instanceIsNew = function (change) {
				if (ExoWeb.Model.Model.getJsType(change.instance.type, true)) {
					var obj = fromExoModel(change.instance, this._translator);
					return obj && obj.meta.isNew;
				}
				return false;
			};

			// truncate change log up-front if save occurred
			var shouldDiscardChange;
			var saveChanges = changes.filter(function (c, i) { return c.type === "Save"; });
			var numSaveChanges = saveChanges.length;
			if (numSaveChanges > 0) {
				// Collect all of the id changes in the response. Multiple saves could occur.
				var idChanges = saveChanges.mapToArray(function (change) { return change.added || []; });

				// Create a list of new instances that were saved. Use a typed identifier form since the id stored
				// in changes in the change log will be a server id rather than client id (if there is a distinction)
				// and using the typed identifier approach allows for a straightforward search of the array.
				var newInstancesSaved = idChanges.map(function (idChange) { return idChange.type + "|" + idChange.oldId; });

				// Truncate changes that we believe were actually saved based on the response
				shouldDiscardChange = function (change) {
					var couldHaveBeenSaved, isNewObjectNotYetSaved;

					// Determine if the change could have been saved in the first place
					couldHaveBeenSaved = this.canSave(change);

					// Determine if the change targets a new object that has not been saved
					isNewObjectNotYetSaved = change.instance && (change.instance.isNew || instanceIsNew.call(this, change)) && !newInstancesSaved.contains(change.instance.type + "|" + change.instance.id);

					// Return a value indicating whether or not the change should be removed
					return couldHaveBeenSaved && !isNewObjectNotYetSaved;
				};

				// Truncate changes that we believe were actually saved based on the response
				this._changeLog.truncate(checkpoint, shouldDiscardChange.bind(this));
				this._changeLog.start({ user: this._localUser });

				// Update affected scope queries
				idChanges.forEach(function (idChange) {
					var jstype = ExoWeb.Model.Model.getJsType(idChange.type, true);
					if (jstype && LazyLoader.isLoaded(jstype.meta)) {
						var serverOldId = idChange.oldId;
						var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
							this._translator.reverse(idChange.type, serverOldId) :
							idChange.oldId;
						this._scopeQueries.forEach(function (query) {
							query.ids = query.ids.map(function (id) {
								return (id === clientOldId) ? idChange.newId : id;
							}, this);
						}, this);
					}
				}, this);
			}

			var numPendingSaveChanges = numSaveChanges;

			changes.forEach(function (change) {
				if (change.type === "InitNew") {
					this.applyInitChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "ReferenceChange") {
					this.applyRefChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "ValueChange") {
					this.applyValChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "ListChange") {
					this.applyListChange(change, beforeApply, afterApply, signal.pending());
				}
				else if (change.type === "Save") {
					this.applySaveChange(change, beforeApply, afterApply, signal.pending());
					numPendingSaveChanges--;
				}

				if (change.type !== "Save") {
					var noObjectsWereSaved = numSaveChanges === 0;
					var hasPendingSaveChanges = numPendingSaveChanges > 0;

					// Only record a change if there is not a pending save change, also take into account new instances that are not saved
					if (noObjectsWereSaved || !hasPendingSaveChanges || !shouldDiscardChange.call(this, change)) {
						// Apply additional filter
						if (!filter || filter(change) === true) {
							newChanges.push(change);
							changeSet.add(change);
						}
					}
				}
			}, this);

			// Start a new change set to capture future changes.
			if (this.isCapturingChanges()) {
				this._changeLog.start({ user: this._localUser });
			}

			waitForAllRegistered = true;
			signal.waitForAll(function () {
				// The method has not yet exited, which means that teardown is happening
				// synchronously, so end applying changes before invoking the callback.
				if (!methodExited) {
					this.endApplyingChanges();
				}

				ExoWeb.Batch.end(batch);

				if (callback) {
					callback.call(thisPtr || this);
				}

				callbackInvoked = true;
			}, this, true);
		}
		finally {
			// The 'teardown' callback was not invoked, either because of an error or because
			// of delayed execution of the teardown routine, so end applying changes immediately.
			if (changesApplying && !callbackInvoked) {
				this.endApplyingChanges();
			}

			// An error occurred after the batch was started but before the 'teardown' callback
			// was registered (which would normally end the batch) so end it immediately.
			if (batchStarted && !waitForAllRegistered) {
				ExoWeb.Batch.end(batch);
			}
		}

		if (newChanges.length > 0) {
			this._raiseEvent("changesDetected", [this, { reason: "applyChanges", changes: newChanges }]);
		}

		// Allow potentially asynchronous callbacks to detect that the
		// method has already exited via a closure on this variable.
		methodExited = true;
	},
	applySaveChange: function (change, before, after, callback, thisPtr) {
		if (!(change.added || change.deleted)) {
			if (callback) {
				callback.call(thisPtr || this);
			}
			return;
		}

		change.deleted.forEach(function (instance) {
			tryGetJsType(this.model, instance.type, null, false, function (type) {
				tryGetEntity(this.model, this._translator, type, instance.id, null, LazyLoadEnum.None, this.ignoreChanges(before, function (obj) {
					// Notify server object that the instance is deleted
					this.notifyDeleted(obj);
					// Simply a marker flag for debugging purposes
					obj.meta.isDeleted = true;
					// Unregister the object so that it can't be retrieved via get, known, or have rules execute against it
					type.meta.unregister(obj);
					// Remove affected scope queries
					this._scopeQueries.purge(function (query) {
						// Remove the deleted object's id from the scope query
						query.ids.purge(function (id) {
							return (id === obj.meta.id);
						}, this);
						// Remove the scope query if it is empty
						return query.ids.length === 0;
					}, this);
				}, after), this);
			}, this);
		}, this);

		change.added.forEach(function (idChange, idChangeIndex) {
			ensureJsType(this.model, idChange.type, this.ignoreChanges(before, function (jstype) {
				var serverOldId = idChange.oldId;
				var clientOldId = !(idChange.oldId in jstype.meta._pool) ?
						this._translator.reverse(idChange.type, serverOldId) :
						idChange.oldId;

				// If the client recognizes the old id then this is an object we have seen before
				if (clientOldId) {
					var type = this.model.type(idChange.type);

					// Attempt to load the object whos id is changing.
					var obj = type.get(
						// Load the object using the object's id prior to saving.
						clientOldId,

						// When processing server-side changes we can expect that the type of the instance
						// is exactly the type specified in the change object, not a base type. 
						true
					);

					// Ensure that the object exists.
					if (!obj) {
						throw new Error($format(
							"Unable to change id for object of type \"{0}\" from \"{1}\" to \"{2}\" since the object could not be found.",
							jstype.meta.get_fullName(), idChange.oldId, idChange.newId));
					}

					// Change the id and make non-new.
					type.changeObjectId(clientOldId, idChange.newId);
					Observer.setValue(obj.meta, "isNew", false);

					// Update affected scope queries
					this._scopeQueries.forEach(function (query) {
						query.ids = query.ids.map(function (id) {
							return (id === clientOldId) ? idChange.newId : id;
						}, this);
					}, this);

					// Update post-save changes with new id
					function fixChangeInstanceDueToIdChange(inst) {
						if (inst) {
							var jstype = Model.getJsType(inst.type, true);
							if (jstype && obj === fromExoModel(inst, this._translator)) {
								inst.id = idChange.newId;
								inst.isNew = false;
							}
						}
					}

					this._changeLog.sets.forEach(function (set) {
						set.changes.forEach(function (change) {
							// Only process changes to model instances
							if (!change.instance) return;

							fixChangeInstanceDueToIdChange.call(this, change.instance);

							// For list changes additionally check added and removed objects.
							if (change.type === "ListChange") {
								// get the jsType of the object that contains the list
								var jsType = Model.getJsType(change.instance.type, true);

								if (jsType) {
									if (jsType.meta.property(change.property).get_isEntityListType()) {
										if (change.added.length > 0)
											change.added.forEach(fixChangeInstanceDueToIdChange, this);
										if (change.removed.length > 0)
											change.removed.forEach(fixChangeInstanceDueToIdChange, this);
									}
								}
							}
							// For reference changes additionally check oldValue/newValue
							else if (change.type === "ReferenceChange") {
								fixChangeInstanceDueToIdChange.call(this, change.oldValue);
								fixChangeInstanceDueToIdChange.call(this, change.newValue);
							}
						}, this);
					}, this);
				}
				// Otherwise, log an error.
				else {
					logWarning($format("Cannot apply id change on type \"{0}\" since old id \"{1}\" was not found.", idChange.type, idChange.oldId));
				}
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	applyInitChange: function (change, before, after, callback, thisPtr) {
		tryGetJsType(this.model, change.instance.type, null, false, this.ignoreChanges(before, function (jstype) {

			// Attempt to fetch the object in case it has already been created.
			var newObj = jstype.meta.get(
				// Since the object is being newly created, we can use the server-generated id.
				change.instance.id,

				// When processing server-side changes we can expect that the type of the instance
				// is exactly the type specified in the change object, not a base type. 
				true
			);

			if (!newObj) {
				// Check for a translation between the old id that was reported and an actual old id.  This is
				// needed since new objects that are created on the server and then committed will result in an accurate
				// id change record, but "instance.id" for this change will actually be the persisted id.
				var serverOldId = this._translator.forward(change.instance.type, change.instance.id) || change.instance.id;

				lazyCreateEntity(change.instance.type, serverOldId, this.ignoreChanges(before, function () {
					// Create the new object (supress events)
					newObj = new jstype(null, null, true);

					// Remember the object's client-generated new id and the corresponding server-generated new id
					this._translator.add(change.instance.type, newObj.meta.id, serverOldId);

					// Raise event after recording id mapping so that listeners can leverage it
					this.model.notifyObjectRegistered(newObj);

					return newObj;
				}, after), this);
			}
		}, after), this);

		// Callback immediately since nothing will be force loaded
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	applyRefChange: function (change, before, after, callback, thisPtr) {
		var hasExited = false;
		var callBeforeExiting = true;

		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
				// Update change to reflect the object's new id
				ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

				// Cache the property since it is not a simple property access.
				var property = srcObj.meta.property(change.property);
				if (!property) {
					throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
				}

				// Apply change
				if (change.newValue) {
					// Don't call immediately since we may need to lazy load the type
					if (!hasExited) {
						callBeforeExiting = false;
					}

					tryGetJsType(this.model, change.newValue.type, null, true, this.ignoreChanges(before, function (refType) {
						tryGetEntity(this.model, this._translator, refType, change.newValue.id, null, LazyLoadEnum.Lazy, this.ignoreChanges(before, function (refObj) {
							// Update change to reflect the object's new id
							ServerSync$retroactivelyFixChangeWhereIdChanged(change.newValue, refObj);

							// Update change to reflect the object's new id
							if (change.newValue.id === refObj.meta.legacyId) {
								change.newValue.id = refObj.meta.id;
							}

							// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
							Property$_ensureInited.call(property, srcObj);

							// Mark the property as no longer pending init since its value is being established
							srcObj.meta.pendingInit(property, false);

							// Set the property value
							Observer.setValue(srcObj, change.property, refObj);

							// Callback once the type has been loaded
							if (!callBeforeExiting && callback) {
								callback.call(thisPtr || this);
							}
						}, after), this);
					}, after), this);
				}
				else {
					// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
					Property$_ensureInited.call(property, srcObj);

					// Mark the property as no longer pending init since its value is being established
					srcObj.meta.pendingInit(property, false);

					// Set the property value
					Observer.setValue(srcObj, change.property, null);
				}

				// Update oldValue's id in change object
				if (change.oldValue) {
					tryGetJsType(this.model, change.oldValue.type, null, true, this.ignoreChanges(before, function (refType) {
						// Update change to reflect the object's new id
						var refObj = fromExoModel(change.oldValue, this._translator, true);
						ServerSync$retroactivelyFixChangeWhereIdChanged(change.oldValue, refObj);
					}, after), this);
				}
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded...yet
		if (callBeforeExiting && callback) {
			callback.call(thisPtr || this);
		}

		hasExited = true;
	},
	applyValChange: function (change, before, after, callback, thisPtr) {
		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
				// Update change to reflect the object's new id
				ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

				// Cache the new value, becuase we access it many times and also it may be modified below
				// to account for timezone differences, but we don't want to modify the actual change object.
				var newValue = change.newValue;

				// Cache the property since it is not a simple property access.
				var property = srcObj.meta.property(change.property);
				if (!property) {
					throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
				}

				if (property.get_jstype() === Date && newValue && newValue.constructor == String && newValue.length > 0) {

					// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
					dateRegex.lastIndex = 0;
					newValue = new Date(newValue.replace(dateRegex, dateRegexReplace));

					//now that we have the value set for the date.
					//if the underlying property datatype is actually a date and not a datetime
					//then we need to add the local timezone offset to make sure that the date is displayed acurately.
					if (property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
						var serverOffset = this.get_ServerTimezoneOffset();
						var localOffset = -(new Date().getTimezoneOffset() / 60);
						newValue = newValue.addHours(serverOffset - localOffset);
					}
				}
				else if (newValue && newValue instanceof TimeSpan) {
					newValue = newValue.toObject();
				}

				// Manually ensure a property value, if it doesn't have one then it will be marked as pendingInit
				Property$_ensureInited.call(property, srcObj);

				// Mark the property as no longer pending init since its value is being established
				srcObj.meta.pendingInit(property, false);

				// Set the property value
				Observer.setValue(srcObj, change.property, newValue);
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	applyListChange: function (change, before, after, callback, thisPtr) {
		var hasExited = false;
		var callBeforeExiting = true;

		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, this.ignoreChanges(before, function (srcObj) {
				// Update change to reflect the object's new id
				ServerSync$retroactivelyFixChangeWhereIdChanged(change.instance, srcObj);

				var property = srcObj.meta.property(change.property);
				if (!property) {
					throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
				}

				var isEntityList = property.get_isEntityListType();
				var list = property.value(srcObj);

				list.beginUpdate();

				var listSignal = new ExoWeb.Signal("applyListChange-items");

				// apply added items
				if (change.added.length > 0) {
					// Don't call immediately since we may need to lazy load the type
					if (!hasExited) {
						callBeforeExiting = false;
					}

					// Add each item to the list after ensuring that the type is loaded
					change.added.forEach(function (item) {
						if (isEntityList) {
							tryGetJsType(this.model, item.type, null, true, listSignal.pending(this.ignoreChanges(before, function (itemType) {
								tryGetEntity(this.model, this._translator, itemType, item.id, null, LazyLoadEnum.Lazy, this.ignoreChanges(before, function (itemObj) {
									// Update change to reflect the object's new id
									ServerSync$retroactivelyFixChangeWhereIdChanged(item, itemObj);

									if (!list.contains(itemObj)) {
										ListLazyLoader.allowModification(list, function () {
											list.add(itemObj);
										});
									}
								}, after), this);
							}, after)), this, true);
						} else {
							ListLazyLoader.allowModification(list, function () {
								list.add(item);
							});
						}
					}, this);
				}

				// apply removed items
				change.removed.forEach(function (item) {
					if (isEntityList) {
						// no need to load instance only to remove it from a list when it can't possibly exist
						tryGetJsType(this.model, item.type, null, false, this.ignoreChanges(before, function (itemType) {
							tryGetEntity(this.model, this._translator, itemType, item.id, null, LazyLoadEnum.Lazy, this.ignoreChanges(before, function (itemObj) {
								// Update change to reflect the object's new id
								ServerSync$retroactivelyFixChangeWhereIdChanged(item, itemObj);

								ListLazyLoader.allowModification(list, function () {
									list.remove(itemObj);
								});
							}, after), this);
						}, after), this, true);
					} else {
						ListLazyLoader.allowModification(list, function () {
							list.remove(item);
						});
					}
				}, this);

				// don't end update until the items have been loaded
				listSignal.waitForAll(this.ignoreChanges(before, function () {
					try {
						var listUpdateEnded = false;
						if (hasExited) {
							this.beginApplyingChanges();
						}
						try {
							ListLazyLoader.allowModification(list, function () {
								// Update variable first to indicate that endUpdate was at least attempted.
								// If the call to endUpdate generates an error we would not want to attempt
								// again and potentially generate a different error because of side-effects.
								listUpdateEnded = true;

								list.endUpdate();
							});
						} finally {
							if (!listUpdateEnded) {
								list.endUpdate();
							}
						}
					} finally {
						if (hasExited) {
							this.endApplyingChanges();
						}
					}

					// Callback once all instances have been added
					if (!callBeforeExiting && callback) {
						callback.call(thisPtr || this);
					}
				}, after), this, true);
			}, after), this);
		}, this);

		// Callback immediately since nothing will be force loaded...yet
		if (callBeforeExiting && callback) {
			callback.call(thisPtr || this);
		}

		hasExited = true;
	},

	// Checkpoint
	///////////////////////////////////////////////////////////////////////
	checkpoint: function ServerSync$checkpoint() {
		return this._changeLog.checkpoint();
	},

	// Rollback
	///////////////////////////////////////////////////////////////////////
	rollback: function ServerSync$rollback(checkpoint, callback, thisPtr) {
		var signal = new Signal("rollback");
		var waitForAllRegistered = false;

		try {
			var batch = ExoWeb.Batch.start("rollback changes");

			this.beginApplyingChanges();

			var change = this._changeLog.undo();
			while (change && !(change.type === "Checkpoint" && change.code === checkpoint)) {
				if (change.type == "InitNew") {
					this.rollbackInitChange(change, signal.pending());
				}
				else if (change.type == "ReferenceChange") {
					this.rollbackRefChange(change, signal.pending());
				}
				else if (change.type == "ValueChange") {
					this.rollbackValChange(change, signal.pending());
				}
				else if (change.type == "ListChange") {
					this.rollbackListChange(change, signal.pending());
				}

				change = this._changeLog.undo();
			}

			waitForAllRegistered = true;
			signal.waitForAll(function () {
				this.endApplyingChanges();
				ExoWeb.Batch.end(batch);
				if (callback) {
					callback.call(thisPtr || this);
				}
				this._raiseEvent("changesDetected", [this, { reason: "rollback" }]);
			}, this, true);
		}
		finally {
			// the signal was not registered, therefore we need to handle endApplyingChanges call here
			if (!waitForAllRegistered) {
				this.endApplyingChanges();
				ExoWeb.Batch.end(batch);
			}
		}
	},
	rollbackValChange: function ServerSync$rollbackValChange(change, callback, thisPtr) {
		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, function (srcObj) {

				// Cache the new value, becuase we access it many times and also it may be modified below
				// to account for timezone differences, but we don't want to modify the actual change object.
				var oldValue = change.oldValue;

				// Cache the property since it is not a simple property access.
				var property = srcObj.meta.property(change.property);
				if (!property) {
					throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
				}

				if (property.get_jstype() === Date && oldValue && oldValue.constructor == String && oldValue.length > 0) {

					// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
					dateRegex.lastIndex = 0;
					oldValue = new Date(oldValue.replace(dateRegex, dateRegexReplace));

					//now that we have the value set for the date.
					//if the underlying property datatype is actually a date and not a datetime
					//then we need to add the local timezone offset to make sure that the date is displayed acurately.
					if (property.get_format() && !hasTimeFormat.test(property.get_format().toString())) {
						var serverOffset = this.get_ServerTimezoneOffset();
						var localOffset = -(new Date().getTimezoneOffset() / 60);
						oldValue = oldValue.addHours(serverOffset - localOffset);
					}
				}
				else if (oldValue && oldValue instanceof TimeSpan) {
					oldValue = oldValue.toObject();
				}

				// Set the property value
				Observer.setValue(srcObj, change.property, oldValue);
			}, this);
		}, this);

		// Callback immediately since nothing will be force loaded
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	rollbackRefChange: function ServerSync$rollbackRefChange(change, callback, thisPtr) {
		var hasExited = false;
		var callBeforeExiting = true;

		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, null, LazyLoadEnum.None, function (srcObj) {
				if (change.oldValue) {
					// Don't call immediately since we may need to lazy load the type
					if (!hasExited) {
						callBeforeExiting = false;
					}

					tryGetJsType(this.model, change.oldValue.type, null, true, function (refType) {
						tryGetEntity(this.model, this._translator, refType, change.oldValue.id, null, LazyLoadEnum.None, function (refObj) {
							Observer.setValue(srcObj, change.property, refObj);

							// Callback once the type has been loaded
							if (!callBeforeExiting && callback) {
								callback.call(thisPtr || this);
							}
						}, this);
					}, this);
				}
				else {
					Observer.setValue(srcObj, change.property, null);
				}
			}, this);
		}, this);

		// Callback immediately since nothing will be force loaded...yet
		if (callBeforeExiting && callback) {
			callback.call(thisPtr || this);
		}

		hasExited = true;
	},
	rollbackInitChange: function ServerSync$rollbackInitChange(change, callback, thisPtr) {
		//TODO: need to remove from the translator
		if (callback) {
			callback.call(thisPtr || this);
		}
	},
	rollbackListChange: function ServerSync$rollbackListChange(change, callback, thisPtr) {
		var hasExited = false;
		var callBeforeExiting = true;

		tryGetJsType(this.model, change.instance.type, change.property, false, function (srcType) {
			tryGetEntity(this.model, this._translator, srcType, change.instance.id, change.property, LazyLoadEnum.None, function (srcObj) {
				var property = srcObj.meta.property(change.property);
				if (!property) {
					throw new Error("Property \"" + change.property + "\" could not be found on type \"" + srcType.meta.get_fullName() + "\".");
				}

				var isEntityList = property.get_isEntityListType();
				var list = property.value(srcObj);
				var translator = this._translator;

				list.beginUpdate();

				var listSignal = new ExoWeb.Signal("rollbackListChange-items");

				// Rollback added items
				change.added.forEach(function rollbackListChanges$added(item) {
					if (isEntityList) {
						tryGetJsType(this.model, item.type, null, false, function (itemType) {
							var childObj = fromExoModel(item, translator);
							if (childObj) {
								list.remove(childObj);
							}
						}, this);
					} else {
						list.remove(item);
					}
				}, this);

				// Rollback removed items
				if (change.removed.length > 0) {
					// Don't call immediately since we may need to lazy load the type
					if (!hasExited) {
						callBeforeExiting = false;
					}

					change.removed.forEach(function rollbackListChanges$added(item) {
						if (isEntityList) {
							tryGetJsType(this.model, item.type, null, true, listSignal.pending(function (itemType) {
								var childObj = fromExoModel(item, translator, true);
								list.add(childObj);
							}, this, true), this);
						} else {
							list.add(item);
						}
					}, this);
				}

				// don't end update until the items have been loaded
				listSignal.waitForAll(function () {
					if (hasExited) {
						this.beginApplyingChanges();
					}
					ListLazyLoader.allowModification(list, function () {
						list.endUpdate();
					});
					if (hasExited) {
						this.endApplyingChanges();
					}
					// Callback once all instances have been added
					if (!callBeforeExiting && callback) {
						callback.call(thisPtr || this);
					}
				}, this);
			}, this);
		}, this);

		// Callback immediately since nothing will be force loaded...yet
		if (callBeforeExiting && callback) {
			callback.call(thisPtr || this);
		}

		hasExited = true;
	},

	// Various
	///////////////////////////////////////////////////////////////////////
	addChangesDetected: function (handler) {
		this._addEvent("changesDetected", handler);
	},
	batchChanges: function (description, callback, thisPtr) {
		// Remove empty batches if a descriptive title or user is not specified.
		// If a title or user is specified then it may be desireable to keep it for diagnostic purposes.
		var removeIfEmpty = !description && !this._localUser;

		this._changeLog.batchChanges(description, this._localUser, thisPtr ? callback.bind(thisPtr) : callback, removeIfEmpty);
	},
	changes: function ServerSync$changes(includeAllChanges, simulateInitRoot, excludeNonPersisted) {
		var list = [];
		var sets = serializeChanges.call(this, includeAllChanges, simulateInitRoot);
		sets.forEach(function (set) {
			if (excludeNonPersisted) {
				list.addRange(set.changes.filter(isPropertyChangePersisted));
			}
			else {
				list.addRange(set.changes);
			}
		});
		return list;
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
		this._serverInfo = this._serverInfo ? jQuery.extend(this._serverInfo, newInfo) : newInfo;
	},
	get_localUser: function ServerSync$get_localUser(user) {
		return this._localUser;
	},
	set_localUser: function ServerSync$set_localUser(user) {
		this._localUser = user;
	}
});

Property.prototype.triggersRoundtrip = function (paths) {
	this.addChanged(function (sender) {
		if (!context.server.isApplyingChanges()) {
			EventScope$onExit(function() {
				setTimeout(function () {
					sender.meta.type.model.server.roundtrip(sender, paths);
				}, 100);
			});
		}
	});
};

exports.ServerSync = ServerSync; // IGNORE
