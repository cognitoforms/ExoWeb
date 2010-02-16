Type.registerNamespace("ExoWeb.Mapper");

(function() {

	function execute() {

		var undefined;
		var STATIC_ID = "static";

		var log = ExoWeb.trace.log;
		var throwAndLog = ExoWeb.trace.throwAndLog;

		var objectProvider = ExoWeb.Load;
		ExoWeb.Mapper.setObjectProvider = function setObjectProvider(fn) {
			objectProvider = fn;
		}

		var typeProvider = ExoWeb.GetType;
		ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
			typeProvider = fn;
		}

		var listProvider = function listProvider(ownerType, ownerId, propName, success, failed) {
			ExoWeb.Load(ownerType, [ownerId], true, false, ["this." + propName], null, success, failed)
		};
		ExoWeb.Mapper.setListProvider = function setListProvider(fn) {
			listProvider = fn;
		}

		var roundtripProvider = function roundtripProvider(changes, success, failed) {
			ExoWeb.Load(null, null, false, false, null, changes, success, failed);
		};
		ExoWeb.Mapper.setRoundtripProvider = function setRoundtripProvider(fn) {
			roundtripProvider = fn;
		}

		var saveProvider = ExoWeb.Save;
		ExoWeb.Mapper.setSaveProvider = function setSaveProvider(fn) {
			saveProvider = fn;
		}

		var eventProvider = ExoWeb.RaiseEvent;
		ExoWeb.Mapper.setEventProvider = function setEventProvider(fn) {
			eventProvider = fn;
		}

		ExoWeb.Model.Entity.formats.$exograph = new ExoWeb.Model.Format({
			convert: function(val) {
				var json = {
					id: val.meta.id,
					type: val.meta.type.get_fullName()
				};

				if (val.meta.isNew)
					json.isNew = true;

				return json;
			},
			convertBack: function(val) {
				var jstype = window[val.type];

				var obj = jstype.meta.get(val.id);

				if (!obj) {
					obj = new jstype(val.id);
					ObjectLazyLoader.register(obj);
					log(["entity", "server"], "{0}({1})  (ghost)", [jstype.meta.get_fullName(), val.id]);
				}

				return obj;
			}
		});

		function toExoGraph(translator, val) {
			if (val !== undefined && val !== null) {
				var type = val.constructor;
				var fmt = type.formats && type.formats.$exograph;
				var result = fmt ? fmt.convert(val) : val;

				// entities only: translate forward to the server's id
				if (val instanceof ExoWeb.Model.Entity)
					result.id = translator.forward(result.type, result.id) || result.id;

				return result;
			}
		}

		function fromExoGraph(translator, val) {
			if (val !== undefined && val !== null) {
				var type = window[val.type];

				// Entities only: translate back to the client's id.  This is necessary to handle the fact that ids are created on 
				// both the client and server.  Also, in some cases a transaction references an entity that was created on the server 
				// and then committed, so that the id actually references an object that already exists on the client but with a different id.
				//--------------------------------------------------------------------------------------------------------
				if (type.meta && type.meta instanceof ExoWeb.Model.Type) {
					// don't alter the original object
					val = Object.copy(val);

					// get the server id, either translated or as the serialized entity id itself
					var serverId = translator.forward(val.type, val.id) || val.id;
					// get the client id, either a reverse translation of the server id or the server id itself
					var clientId = translator.reverse(val.type, serverId) || serverId;

					val.id = clientId;
				}

				var fmt = type.formats && type.formats.$exograph;
				return fmt ? fmt.convertBack(val) : val;
			}
		}


		///////////////////////////////////////////////////////////////////////////
		function ExoGraphEventListener(model, translator) {
			this._model = model;
			this._translator = translator;

			// listen for events
			model.addListChanged(this.onListChanged.setScope(this));
			model.addAfterPropertySet(this.onPropertyChanged.setScope(this));
			model.addObjectRegistered(this.onObjectRegistered.setScope(this));
			model.addObjectUnregistered(this.onObjectUnregistered.setScope(this));
		}

		ExoGraphEventListener.mixin(ExoWeb.Functor.eventing);

		ExoGraphEventListener.mixin({
			addChangeCaptured: function ExoGraphEventListener$onEvent(handler) {
				this._addEvent("changeCaptured", handler);
			},

			// Model event handlers
			onListChanged: function ExoGraphEventListener$onListChanged(obj, property, listChanges) {

				if (property.get_origin() !== "server")
					return;

				if (obj instanceof Function)
					log("server", "logging list change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
				else
					log("server", "logging list change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);


				for (var i = 0; i < listChanges.length; ++i) {
					var listChange = listChanges[i];

					var change = {
						__type: "ListChange:#ExoGraph",
						instance: toExoGraph(this._translator, obj),
						property: property.get_name(),
						added: [],
						removed: []
					}

					if (listChange.newStartingIndex >= 0 || listChange.newItems) {
						var _this = this;
						Array.forEach(listChange.newItems, function ExoGraphEventListener$onListChanged$addedItem(obj) {
							change.added.push(toExoGraph(_this._translator, obj));
						});
					}
					if (listChange.oldStartingIndex >= 0 || listChange.oldItems) {
						var _this = this;
						Array.forEach(listChange.oldItems, function ExoGraphEventListener$onListChanged$removedItem(obj) {
							change.removed.push(toExoGraph(_this._translator, obj));
						});
					}

					this._raiseEvent("changeCaptured", [change]);
				}
			},
			onObjectRegistered: function ExoGraphEventListener$onObjectRegistered(obj) {
				if (obj.meta.isNew) {
					log("server", "logging new: {0}({1})", [obj.meta.type.get_fullName(), obj.meta.id]);

					var change = {
						__type: "InitNew:#ExoGraph",
						instance: toExoGraph(this._translator, obj)
					};

					this._raiseEvent("changeCaptured", [change]);
				}
			},
			onObjectUnregistered: function ExoGraphEventListener$onObjectUnregistered(obj) {
				log("server", "logging delete: {0}({1})", [obj.meta.type.get_fullName(), obj.meta.id]);

				// TODO: delete JSON format?
				var change = {
					__type: "Delete:#ExoGraph",
					instance: toExoGraph(this._translator, obj)
				};

				this._raiseEvent("changeCaptured", [change]);
			},
			onPropertyChanged: function ExoGraphEventListener$onPropertyChanged(obj, property, newValue, oldValue) {
				if (property.get_origin() !== "server")
					return;

				if (property.get_isValueType()) {
					if (obj instanceof Function)
						log("server", "logging value change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
					else
						log("server", "logging value change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);

					var change = {
						__type: "ValueChange:#ExoGraph",
						instance: toExoGraph(this._translator, obj),
						property: property.get_name(),
						oldValue: toExoGraph(this._translator, oldValue),
						newValue: toExoGraph(this._translator, newValue)
					};

					this._raiseEvent("changeCaptured", [change]);
				}
				else {
					if (obj instanceof Function)
						log("server", "logging reference change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
					else
						log("server", "logging reference change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);

					var change = {
						__type: "ReferenceChange:#ExoGraph",
						instance: toExoGraph(this._translator, obj),
						property: property.get_name(),
						oldValue: toExoGraph(this._translator, oldValue),
						newValue: toExoGraph(this._translator, newValue)
					};

					this._raiseEvent("changeCaptured", [change]);
				}
			}
		});


		///////////////////////////////////////////////////////////////////////////
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
			}
			this.beginApplyingChanges = function ServerSync$beginApplyingChanges() {
				applyingChanges = true;
			}
			this.endApplyingChanges = function ServerSync$endApplyingChanges() {
				applyingChanges = false;
			}

			var captureRegisteredObjects = false;
			model.addObjectRegistered(function(obj) {
				// if an existing object is registered then register for lazy loading
				if (!obj.meta.isNew && captureRegisteredObjects && !applyingChanges) {
					ObjectLazyLoader.register(obj);
					log(["entity", "server"], "{0}({1})  (ghost)", [obj.meta.type.get_fullName(), obj.meta.id]);
				}
			});
			this.isCapturingRegisteredObjects = function ServerSync$isCapturingRegisteredObjects() {
				return captureRegisteredObjects;
			}
			this.beginCapturingRegisteredObjects = function ServerSync$beginCapturingRegisteredObjects() {
				captureRegisteredObjects = true;
			}

			model._server = this;

			this._listener.addChangeCaptured(this._captureChange.setScope(this));

			Sys.Observer.makeObservable(this);
		}

		ServerSync.mixin(ExoWeb.Functor.eventing);

		ServerSync.mixin({
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
			canSave: function ServerSync$canSave(change) {
				var obj = fromExoGraph(this._translator, change.instance);
				if (obj && Array.contains(this._objectsExcludedFromSave, obj))
					return false;

				return true;
			},

			// Raise Server Event
			///////////////////////////////////////////////////////////////////////
			raiseServerEvent: function ServerSync$raiseServerEvent(name, obj, event, success, failed/*, automatic */) {
				Sys.Observer.setValue(this, "PendingServerEvent", true);

				log("server", "ServerSync.raiseServerEvent() >> {0}", [name]);

				var automatic = arguments.length == 6 && arguments[5] === true;

				this._raiseEvent("raiseServerEventBegin", [automatic]);

				// if no event object is provided then use an empty object
				if (event === undefined || event === null)
					event = {};

				eventProvider(
					name, 																												// event name
					toExoGraph(this._translator, obj), 																					// instance
					event, 																												// custom event object
					{changes: this._changes }, 																							// changes
					this._onRaiseServerEventSuccess.setScope(this).appendArguments(success, automatic).sliceArguments(0, 1), 		// success callback
					this._onRaiseServerEventFailed.setScope(this).appendArguments(failed || success, automatic).sliceArguments(0, 1)	// failed callback
				);
			},
			addRaiseServerEventBegin: function ServerSync$addRaiseServerEventBegin(handler, includeAutomatic) {
				this._addEvent("raiseServerEventBegin", function(automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			_onRaiseServerEventSuccess: function ServerSync$_onRaiseServerEventSuccess(response, callback, automatic) {
				Sys.Observer.setValue(this, "PendingServerEvent", false);

				if (response.instances) {
					objectsFromJson(this._model, response.instances);
				}

				if (response.changes) {
					log("server", "ServerSync._onRaiseServerEventSuccess() >> applying {0} changes", [response.changes.length]);

					if (response.changes.length > 0)
						this.apply(response.changes);
				}
				else {
					log("server", "._onRaiseServerEventSuccess() >> no changes");
				}

				this._raiseEvent("raiseServerEventSuccess", [automatic]);

				if (callback && callback instanceof Function)
					callback.call(this, response.result);
			},
			addRaiseServerEventSuccess: function ServerSync$addRaiseServerEventSuccess(handler, includeAutomatic) {
				this._addEvent("raiseServerEventSuccess", function(automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			_onRaiseServerEventFailed: function ServerSync$_onRaiseServerEventFailed(e, callback, automatic) {
				Sys.Observer.setValue(this, "PendingServerEvent", false);

				log("error", "Raise Server Event Failed (HTTP: {_statusCode}, Timeout: {_timedOut}) - {_message}", e);

				this._raiseEvent("raiseServerEventFailed", [e, automatic]);

				if (callback && callback instanceof Function)
					callback.call(this);
			},
			addRaiseServerEventFailed: function ServerSync$addRaiseServerEventFailed(handler, includeAutomatic) {
				this._addEvent("raiseServerEventFailed", function(e, automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},

			// Roundtrip
			///////////////////////////////////////////////////////////////////////
			roundtrip: function ServerSync$roundtrip(success, failed/*, automatic */) {
				Sys.Observer.setValue(this, "PendingRoundtrip", true);

				log("server", "ServerSync.roundtrip() >> sending {0} changes", [this._changes.length]);

				var automatic = arguments.length == 3 && arguments[2] === true;

				this._raiseEvent("roundtripBegin", [automatic]);

				roundtripProvider(
					{ changes: this._changes }, 																				// changes
					this._onRoundtripSuccess.setScope(this).appendArguments(success, automatic).sliceArguments(0, 1), 		// success callback
					this._onRoundtripFailed.setScope(this).appendArguments(failed || success, automatic).sliceArguments(0, 1)	// failed callback
				);
			},
			addRoundtripBegin: function ServerSync$addRoundtripBegin(handler, includeAutomatic) {
				this._addEvent("roundtripBegin", function(automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			_onRoundtripSuccess: function ServerSync$_onRoundtripSuccess(response, callback, automatic) {
				Sys.Observer.setValue(this, "PendingRoundtrip", false);

				if (response.changes) {
					log("server", "ServerSync._onRoundtripSuccess() >> applying {0} changes", [response.changes.length]);

					if (response.changes.length > 0)
						this.apply(response.changes);
				}
				else {
					log("server", "._onRoundtripSuccess() >> no changes");
				}

				this._raiseEvent("roundtripSuccess", [automatic]);

				if (callback && callback instanceof Function)
					callback.call(this, response.changes);
			},
			addRoundtripSuccess: function ServerSync$addRoundtripSuccess(handler, includeAutomatic) {
				this._addEvent("roundtripSuccess", function(automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			_onRoundtripFailed: function ServerSync$_onRoundtripFailed(e, callback, automatic) {
				Sys.Observer.setValue(this, "PendingRoundtrip", false);

				log("error", "Roundtrip Failed (HTTP: {_statusCode}, Timeout: {_timedOut}) - {_message}", e);

				this._raiseEvent("roundtripFailed", [e, automatic]);

				if (callback && callback instanceof Function)
					callback.call(this);
			},
			addRoundtripFailed: function ServerSync$addRoundtripFailed(handler, includeAutomatic) {
				this._addEvent("roundtripFailed", function(e, automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			startAutoRoundtrip: function ServerSync$startAutoRoundtrip(interval) {
				log("server", "auto-roundtrip enabled - interval of {0} milliseconds", [interval]);

				// cancel any pending roundtrip schedule
				this.stopAutoRoundtrip();

				var _this = this;
				function doRoundtrip() {
					log("server", "auto-roundtrip starting ({0})", [new Date()]);
					_this.roundtrip(function context$autoRoundtripCallback() {
						log("server", "auto-roundtrip complete ({0})", [new Date()]);
						_this._roundtripTimeout = window.setTimeout(doRoundtrip, interval);
					}, null, true);
				}

				this._roundtripTimeout = window.setTimeout(doRoundtrip, interval);
			},
			stopAutoRoundtrip: function ServerSync$stopAutoRoundtrip() {
				if (this._roundtripTimeout)
					window.clearTimeout(this._roundtripTimeout);
			},

			// Save
			///////////////////////////////////////////////////////////////////////
			save: function ServerSync$save(root, success, failed/*, automatic*/) {
				Sys.Observer.setValue(this, "PendingSave", true);

				log("server", ".save() >> sending {0} changes", [this._changes.length]);

				var automatic = arguments.length == 4 && arguments[3] === true;

				this._raiseEvent("saveBegin", [automatic]);

				saveProvider(
					{ type: root.meta.type.get_fullName(), id: root.meta.id }, 												// root
					{changes: this.get_Changes() }, 																		// changes
					this._onSaveSuccess.setScope(this).appendArguments(success, automatic).sliceArguments(0, 1), 		// success callback
					this._onSaveFailed.setScope(this).appendArguments(failed || success, automatic).sliceArguments(0, 1)	// failed callback
				);
			},
			addSaveBegin: function ServerSync$addSaveBegin(handler, includeAutomatic) {
				this._addEvent("saveBegin", function(automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			_onSaveSuccess: function ServerSync$_onSaveSuccess(response, callback, automatic) {
				Sys.Observer.setValue(this, "PendingSave", false);

				if (response.changes) {
					log("server", "._onSaveSuccess() >> applying {0} changes", [response.changes.length]);

					// apply changes from server
					if (response.changes.length > 0)
						this.apply(response.changes);
				}
				else {
					log("server", "._onSaveSuccess() >> no changes");
				}

				this._raiseEvent("saveSuccess", [automatic]);

				if (callback && callback instanceof Function)
					callback.call(this, response.changes);
			},
			addSaveSuccess: function ServerSync$addSaveSuccess(handler, includeAutomatic) {
				this._addEvent("saveSuccess", function(automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			_onSaveFailed: function ServerSync$_onSaveFailed(e, callback, automatic) {
				Sys.Observer.setValue(this, "PendingSave", false);

				log("error", "Save Failed (HTTP: {_statusCode}, Timeout: {_timedOut}) - {_message}", e);

				this._raiseEvent("saveFailed", [e, automatic]);

				if (callback && callback instanceof Function)
					callback.call(this);
			},
			addSaveFailed: function ServerSync$addSaveFailed(handler, includeAutomatic) {
				this._addEvent("saveFailed", function(e, automatic) {
					// only raise automated events if the subscriber requests them
					if (!automatic || includeAutomatic)
						handler.apply(this, arguments);
				});
			},
			startAutoSave: function ServerSync$startAutoSave(root, interval) {
				log("server", "auto-save enabled - interval of {0} milliseconds", [interval]);

				// cancel any pending save schedule
				this.stopAutoSave();

				var _this = this;
				function doSave() {
					if (_this.get_Changes().length > 0) {
						log("server", "auto-save starting ({0})", [new Date()]);
						_this.save(root, function context$autoSaveCallback() {
							log("server", "auto-save complete ({0})", [new Date()]);
							_this._saveTimeout = window.setTimeout(doSave, interval);
						}, null, true);
					}
					else {
						_this._saveTimeout = window.setTimeout(doSave, interval);
					}
				}

				this._saveTimeout = window.setTimeout(doSave, interval);
			},
			stopAutoSave: function ServerSync$stopAutoSave() {
				if (this._saveTimeout)
					window.clearTimeout(this._saveTimeout);
			},

			// Various
			///////////////////////////////////////////////////////////////////////
			_captureChange: function ServerSync$_captureChange(change) {
				if (!this.isApplyingChanges()) {
					this._changes.push(change);
					Sys.Observer.raisePropertyChanged(this, "Changes");
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

				if (changed)
					Sys.Observer.raisePropertyChanged(this, "Changes");
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

				if (oldValue !== value)
					Sys.Observer.raisePropertyChanged(this, "PendingAction");
			},
			get_PendingRoundtrip: function ServerSync$get_PendingRoundtrip() {
				return this._pendingRoundtrip;
			},
			set_PendingRoundtrip: function ServerSync$set_PendingRoundtrip(value) {
				var oldValue = this._pendingRoundtrip;
				this._pendingRoundtrip = value;

				if (oldValue !== value)
					Sys.Observer.raisePropertyChanged(this, "PendingAction");
			},
			get_PendingSave: function ServerSync$get_PendingSave() {
				return this._pendingSave;
			},
			set_PendingSave: function ServerSync$set_PendingSave(value) {
				var oldValue = this._pendingSave;
				this._pendingSave = value;

				if (oldValue !== value)
					Sys.Observer.raisePropertyChanged(this, "PendingAction");
			},

			// APPLY CHANGES
			///////////////////////////////////////////////////////////////////////
			apply: function ServerSync$apply(changes) {
				if (!changes || !(changes instanceof Array)) return;

				try {
					log("server", "begin applying {length} changes", changes);

					this.beginApplyingChanges();

					var signal = new ExoWeb.Signal();

					var server = this;

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
						var recordChange = (ignoreCount == 0);

						// look for remaining changes that are save changes, but only if 
						// we are finished processing changes that occurred before a save
						var saveChanges = null;
						if (ignoreCount == 0) {
							saveChanges = $transform(changes).where(function(c) {
								return c.__type === "Save:#ExoGraph";
							});
						}

						// process the next save change
						if (saveChanges && saveChanges.length > 0) {
							// get the first save change
							change = saveChanges[0];
							// don't record changes before changes were saved
							ignoreCount = Array.indexOf(changes, change);
							// remove the save change from the underlying array if there are no preceeding changes
							if (ignoreCount == 0)
								Array.remove(changes, change);
						}
						// process the next change of any kind
						else {
							// decrement ignore count until it reaches zero
							ignoreCount = ignoreCount > 0 ? ignoreCount - 1 : 0;
							// pull off the next change to process
							change = Array.dequeue(changes);
						}

						if (change) {
							if (change.__type != "Save:#ExoGraph") {
								newChanges++;

								if (recordChange)
									server._changes.push(change);
							}

							var callback = signal.pending(processNextChange);

							if (change.__type == "InitNew:#ExoGraph") {
								server.applyInitChange(change, callback);
							}
							else if (change.__type == "ReferenceChange:#ExoGraph") {
								server.applyRefChange(change, callback);
							}
							else if (change.__type == "ValueChange:#ExoGraph") {
								server.applyValChange(change, callback);
							}
							else if (change.__type == "ListChange:#ExoGraph") {
								server.applyListChange(change, callback);
							}
							else if (change.__type == "Save:#ExoGraph") {
								server.applySaveChange(change, function() {
									// changes have been applied so truncate the log to this point
									server._truncateLog(server.canSave.setScope(server));

									callback.apply(this, arguments);
								});
							}
						}
					}

					processNextChange();

					signal.waitForAll(function() {
						log("server", "done applying {0} changes: {1} captured", [totalChanges, newChanges]);
						server.endApplyingChanges();
						if (newChanges > 0) {
							log("server", "raising \"Changes\" property change event");
							Sys.Observer.raisePropertyChanged(server, "Changes");
						}
					});
				}
				catch (e) {
					ExoWeb.trace.throwAndLog(["server"], e);
					this.endApplyingChanges();
				}
			},
			applySaveChange: function ServerSync$applySaveChange(change, callback) {
				log("server", "applySaveChange: {length} changes", change.idChanges);

				if (change.idChanges) {
					// update each object with its new id
					for (var i = 0; i < change.idChanges.length; i++) {
						var idChange = change.idChanges[i];

						var serverOldId = idChange.oldId;
						var clientOldId = this._translator.reverse(idChange.type, serverOldId);

						// If the client recognizes the old id then this is an object we have seen before
						if (clientOldId) {
							var type = this._model.type(idChange.type);
							type.changeObjectId(clientOldId, idChange.newId)
							Array.remove(change.idChanges, idChange);
							i--;
						}
						// Otherwise, make a note of the new object created on the server so that we can correct the ids later
						else {
							// The server knows the correct old id, but the client will see a new object created with a persisted id 
							// since it was created and then committed.  Translate from the persisted id to the server's old id so that 
							// we can reverse it when creating new objects from the server.  Also, a reverse record should not be added.
							var serverOldId = idChange.oldId;
							var clientOldId = idChange.newId;
							this._translator.add(idChange.type, clientOldId, serverOldId, true);
						}
					}
				}

				callback();
			},
			applyInitChange: function ServerSync$applyInitChange(change, callback) {
				log("server", "applyInitChange: Type = {type}, Id = {id}", change.instance);

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

						callback();
					});
			},
			applyRefChange: function ServerSync$applyRefChange(change, callback) {
				log("server", "applyRefChange: Type = {instance.type}, Id = {instance.id}, Property = {property}", change);

				var obj = fromExoGraph(this._translator, change.instance);

				var translator = this._translator;
				var model = this._model;

				function applyRefChange$execute() {
					if (change.newValue) {
						ensureJsType(model, change.newValue.type,
							function applyRefChange$typeLoaded(mtype) {
								var ref = fromExoGraph(translator, change.newValue);

								Sys.Observer.setValue(obj, change.property, ref);

								callback();
							});
					}
					else {
						Sys.Observer.setValue(obj, change.property, null);

						callback();
					}
				}

				if (!ExoWeb.Model.LazyLoader.isLoaded(obj, change.property)) {
					ExoWeb.Model.LazyLoader.eval(obj, change.property, function() {
						applyRefChange$execute();
					});
				}
				else {
					applyRefChange$execute();
				}
			},
			applyValChange: function ServerSync$applyValChange(change, callback) {
				log("server", "applyValChange", change.instance);

				var obj = fromExoGraph(this._translator, change.instance);

				function applyValChange$execute() {
					Sys.Observer.setValue(obj, change.property, change.newValue);
					callback();
				}

				if (!ExoWeb.Model.LazyLoader.isLoaded(obj, change.property)) {
					ExoWeb.Model.LazyLoader.eval(obj, change.property, function() {
						applyValChange$execute();
					});
				}
				else {
					applyValChange$execute();
				}
			},
			applyListChange: function ServerSync$applyListChange(change, callback) {
				log("server", "applyListChange", change.instance);

				var obj = fromExoGraph(this._translator, change.instance);

				var translator = this._translator;

				function applyListChange$execute() {
					var prop = obj.meta.property(change.property);
					var list = prop.value(obj);

					// apply added items
					Array.forEach(change.added, function ServerSync$applyListChanges$added(item) {
						var childObj = fromExoGraph(translator, item);
						Sys.Observer.add(list, childObj);
					});

					// apply removed items
					Array.forEach(change.removed, function ServerSync$applyListChanges$removed(item) {
						var childObj = fromExoGraph(translator, item);
						Sys.Observer.remove(list, childObj);
					});

					callback();
				}

				if (!ExoWeb.Model.LazyLoader.isLoaded(obj, change.property)) {
					ExoWeb.Model.LazyLoader.eval(obj, change.property, function() {
						applyListChange$execute();
					});
				}
				else {
					applyListChange$execute();
				}
			}
		});

		ServerSync.Roundtrip = function ServerSync$Roundtrip(root, success, failed) {
			if (root instanceof ExoWeb.Model.Entity) {
				root = root.meta.type.get_model();
			}

			if (root instanceof ExoWeb.Model.Model) {
				if (root._server)
					root._server.roundtrip(success, failed);
				else
				// TODO
					;
			}
		}
		ServerSync.Save = function ServerSync$Save(root, success, failed) {
			var model;
			if (root instanceof ExoWeb.Model.ObjectBase) {
				model = root.meta.type.get_model();
			}

			if (model && model instanceof ExoWeb.Model.Model) {
				if (model._server)
					model._server.save(root, success, failed);
				else
				// TODO
					;
			}
		}

		//////////////////////////////////////////////////////////////////////////////////////
		function TriggerRoundtripRule(property) {
			var prop = this.prop = property;

			ExoWeb.Model.Rule.register(this, [property], true);
		}

		TriggerRoundtripRule.prototype = {
			execute: function(obj, callback) {
				ServerSync.Roundtrip(obj, callback, callback);
			},
			toString: function() {
				return "trigger roundtrip";
			}
		}

		ExoWeb.Mapper.TriggerRoundtripRule = ExoWeb.Model.Rule.triggerRoundtrip = TriggerRoundtripRule;

		ExoWeb.Model.Property.mixin({
			triggersRoundtrip: function() {
				var rule = new TriggerRoundtripRule(this);
			}
		});

		///////////////////////////////////////////////////////////////////////////	
		function ensureJsType(model, typeName, callback) {
			var mtype = model.type(typeName);

			if (!mtype) {
				fetchType(model, typeName, function(jstype) {
					callback.apply(this, [jstype]);
				});
			}
			else if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
				ExoWeb.Model.LazyLoader.load(mtype, null, function(jstype) {
					callback.apply(this, [jstype]);
				});
			}
			else {
				callback.apply(this, [mtype.get_jstype()]);
			}
		}

		function objectsFromJson(model, json, callback) {
			var signal = new ExoWeb.Signal("objectsFromJson");

			try {
				for (var typeName in json) {
					var poolJson = json[typeName];
					for (var id in poolJson) {
						// locate the object's state in the json				
						objectFromJson(model, typeName, id, poolJson[id], signal.pending());
					}
				}
			}
			finally {
				signal.waitForAll(callback);
			}
		}

		function objectFromJson(model, typeName, id, json, callback) {
			// get the object to load
			var obj;

			// family-qualified type name is not available so can't use getType()
			var mtype = model.type(typeName);

			// if this type has never been seen, go and fetch it and resume later
			if (!mtype) {
				fetchType(model, typeName, function() {
					objectFromJson(model, typeName, id, json, callback);
				});
				return;
			}

			// Load object's type if needed
			if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
				ExoWeb.Model.LazyLoader.load(mtype, null, function() {
					objectFromJson(model, typeName, id, json, callback);
				});
				return;
			}

			// get target object to load
			if (id === STATIC_ID)
				obj = null;
			else
				obj = getObject(model, typeName, id, null, true);

			log("objectInit", "{0}({1})   <.>", [typeName, id]);

			// Load object's properties
			for (var propName in json) {
				var prop = mtype.property(propName);
				var propData = json[propName];

				log("propInit", "{0}({1}).{2} = {3}", [typeName, id, propName, propData]);

				if (!prop) {
					throwAndLog(["objectInit"], "Cannot load object {0}({2}) because it has an unexpected property '{1}'", [typeName, propName, id]);
				}
				else {
					prop = prop.lastProperty();
				}

				var propType = prop.get_jstype();

				if (propData === null) {
					prop.init(obj, null);
				}
				else if (prop.get_isList()) {
					var list = prop.value(obj);

					if (propData == "deferred") {
						// don't overwrite list if its already a ghost
						if (!list) {
							list = ListLazyLoader.register(obj, prop);
							prop.init(obj, list, false);
						}
					}
					else {
						if (!list || !ExoWeb.Model.LazyLoader.isLoaded(list)) {

							// json has list members
							if (list)
								ListLazyLoader.unregister(list);
							else {
								list = [];
								prop.init(obj, list);
							}

							for (var i = 0; i < propData.length; i++) {
								var ref = propData[i];
								list.push(getObject(model, propType, ref.id, ref.type));
							}

						}
					}
				}
				else {
					var ctor = prop.get_jstype(true);

					// assume if ctor is not found its a model type not an intrinsic
					if (!ctor || ctor.meta) {
						prop.init(obj, getObject(model, propType, propData.id, propData.type));
					}
					else {
						var format = ctor.formats.$wire;
						prop.init(obj, (format ? format.convertBack(propData) : propData));
					}
				}

				// static fields are potentially loaded one at a time
			}

			if (obj)
				ObjectLazyLoader.unregister(obj);

			if (callback)
				callback();
		}

		function typesFromJson(model, json) {
			for (var typeName in json)
				typeFromJson(model, typeName, json[typeName]);
		}

		function typeFromJson(model, typeName, json) {
			log("typeInit", "{1}   <.>", arguments);

			// get model type. it may have already been created for lazy loading	
			var mtype = getType(model, typeName, json.baseType, true);

			// define properties
			for (var propName in json.properties) {
				var propJson = json.properties[propName];

				var propType = getJsType(model, propJson.type);
				var format = propJson.format ? propType.formats[propJson.format] : null;

				var prop = mtype.addProperty({ name: propName, type: propType, isList: propJson.isList, label: propJson.label, format: format, isStatic: propJson.isStatic });


				// setup static properties for lazy loading
				if (propJson.isStatic) {
					if (propJson.isList)
						prop.init(null, ListLazyLoader.register(null, prop));
					//else
					//	PropertyLazyLoader.register(mtype.get_jstype(), prop);
				}

				if (propJson.rules) {
					for (var i = 0; i < propJson.rules.length; ++i) {
						ruleFromJson(propJson.rules[i], prop);
					}
				}
			}
			mtype.set_originForNewProperties("client");
		}

		function getJsType(model, typeName, forLoading) {
			// try to get the js type from the window object.
			// if its not defined, assume the type is a model type
			// that may eventually be fetched
			var family = typeName.split(">");

			return window[family[0]] || getType(model, null, family, forLoading).get_jstype();
		}

		function flattenTypes(types, flattened) {
			function add(item) {
				if (flattened.indexOf(item) < 0)
					flattened.push(item);
			}

			if (types instanceof Array)
				Array.forEach(types, add);
			else if (typeof (types) === "string")
				Array.forEach(types.split(">"), add);
			else if (types)
				add(types);
		}

		// Gets a reference to a type.  IMPORTANT: typeName must be the
		// family-qualified type name (ex: Employee>Person).
		function getType(model, finalType, propType, forLoading) {
			// ensure the entire type family is at least ghosted
			// so that javascript OO mechanisms work properly		
			var family = [];

			flattenTypes(finalType, family);
			flattenTypes(propType, family);

			var mtype;
			var baseType;

			while (family.length > 0) {
				baseType = mtype;

				var type = family.pop();

				if (type instanceof ExoWeb.Model.Type)
					mtype = type;
				else if (type.meta)
					mtype = type.meta;
				else {
					// type is a string
					mtype = model.type(type);

					// if type doesn't exist, setup a ghost type
					if (!mtype) {
						mtype = model.addType(type, baseType);
						mtype.set_origin("server");

						if (!forLoading || family.length > 0) {
							log("typeInit", "{0} (ghost)", [type]);
							TypeLazyLoader.register(mtype);
						}
					}
				}
			}

			return mtype;
		}

		function getObject(model, propType, id, finalType, forLoading) {
			if (id === STATIC_ID)
				throwAndLog(["objectInit", "lazyLoad"], "getObject() can only be called for instances (id='{0}')", [id]);

			// get model type
			var mtype = getType(model, finalType, propType);

			// Try to locate object in pool
			var obj = mtype.get(id);

			// if it doesn't exist, create a ghost
			if (!obj) {
				obj = new (mtype.get_jstype())(id);

				if (!forLoading) {
					ObjectLazyLoader.register(obj);
					log("entity", "{0}({1})  (ghost)", [mtype.get_fullName(), id]);
				}
			}

			return obj;
		}

		///////////////////////////////////////////////////////////////////////////////
		var fetchType = (function fetchType(model, typeName, callback) {
			var signal = new ExoWeb.Signal("fetchType(" + typeName + ")");

			// request the type
			typeProvider(typeName,
				signal.pending(function(result) {

					// load type
					typesFromJson(model, result.types);

					// ensure base classes are loaded too
					for (var b = model.type(typeName).baseType; b; b = b.baseType) {
						if (!ExoWeb.Model.LazyLoader.isLoaded(b))
							ExoWeb.Model.LazyLoader.load(b, null, signal.pending());
					}
				}),
				signal.orPending(function(error) {
					ExoWeb.trace.logError("typeInit",
						"Failed to load {typeName} (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
						{ typeName: typeName, error: error });
				})
			);

			// after properties and base class are loaded, then return results
			signal.waitForAll(function() {
				var mtype = model.type(typeName);
				TypeLazyLoader.unregister(mtype);

				// apply app-specific configuration
				var exts = pendingExtensions[typeName];

				if (exts) {
					delete pendingExtensions[typeName];
					exts(mtype.get_jstype());
				}

				// done
				if (callback)
					callback(mtype.get_jstype());
			});
		}).dontDoubleUp({ callbackArg: 2 });

		function fetchPathTypes(model, jstype, path, callback) {
			var step;

			while (step = Array.dequeue(path.steps)) {
				// locate property definition in model
				var prop = jstype.meta.property(step.property);

				if (prop.get_isValueType())
					break;

				// Load the type of the property if its not yet loaded
				var mtype;
				if (step.cast) {
					mtype = model.type(step.cast);

					// if this type has never been seen, go and fetch it and resume later
					if (!mtype) {
						Array.insert(path.steps, 0, step);
						fetchType(model, step.cast, function() {
							fetchPathTypes(model, jstype, path, callback);
						});
						return;
					}
				}
				else
					mtype = prop.get_jstype().meta;

				// if property's type isn't load it, then fetch it
				if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
					fetchType(model, mtype.get_fullName(), function(jstype) {
						fetchPathTypes(model, jstype, path, callback);
					});

					// path walking will resume with callback
					return;
				}

				// keep walking the path
				jstype = mtype.get_jstype();
			}

			// done walking path
			if (callback)
				callback();
		}

		function fetchTypes(model, query, callback) {
			var signal = new ExoWeb.Signal("fetchTypes");

			function rootTypeLoaded(jstype) {
				if (query.and) {
					Array.forEach(query.and, function(path) {
						if (path.steps[0].property === "this") {
							var step = Array.dequeue(path.steps);
							var mtype = jstype.meta;

							function fetchRootTypePaths() {
								fetchPathTypes(model, mtype.get_jstype(), path, signal.pending());
							}

							// handle the case where the root object is cast to a derived type
							if (step.cast) {
								mtype = model.type(step.cast);
								if (!mtype)
									fetchType(model, step.cast, signal.pending(function() {
										mtype = model.type(step.cast);
										fetchRootTypePaths();
									}));
								else
									fetchRootTypePaths();
							}
							else {
								fetchRootTypePaths();
							}
						}
						else {
							// this is a static property

							var typeName = Array.dequeue(path.steps).property;
							var mtype = model.type(typeName);

							function fetchStaticPathTypes() {
								fetchPathTypes(model, (mtype || model.type(typeName)).get_jstype(), path, signal.pending());
							}

							if (!mtype) {
								// first time type has been seen, fetch it
								fetchType(model, typeName, signal.pending(fetchStaticPathTypes));
							}
							else if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
								// lazy load type and continue walking the path
								ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending(fetchStaticPathTypes));
							}
							else {
								fetchStaticPathTypes();
							}
						}
					});
				};
			}

			// load root type, then load types referenced in paths
			var rootType = model.type(query.from);
			if (!rootType)
				fetchType(model, query.from, signal.pending(rootTypeLoaded));
			else
				rootTypeLoaded(rootType.get_jstype());

			signal.waitForAll(callback);
		}

		// {ruleName: ruleConfig}
		function ruleFromJson(json, prop) {
			for (var name in json) {
				var ruleType = ExoWeb.Model.Rule[name];
				var rule = new ruleType(json[name], [prop]);
			}
		}

		///////////////////////////////////////////////////////////////////////////////
		// Type Loader
		function TypeLazyLoader() {
		}

		TypeLazyLoader.mixin({
			load: function(mtype, propName, callback) {
				log(["typeInit", "lazyLoad"], "Lazy load: {0}", [mtype.get_fullName()]);
				fetchType(mtype.get_model(), mtype.get_fullName(), callback);
			}
		});

		(function() {
			var instance = new TypeLazyLoader();

			TypeLazyLoader.register = function(obj) {
				ExoWeb.Model.LazyLoader.register(obj, instance);
			}

			TypeLazyLoader.unregister = function(obj) {
				ExoWeb.Model.LazyLoader.unregister(obj, instance);
			}
		})();

		///////////////////////////////////////////////////////////////////////////////
		// Object Loader
		function ObjectLazyLoader() {
			this._requests = {};
			this._typePaths = {};
		}

		ObjectLazyLoader.mixin({
			load: (function load(obj, propName, callback) {
				var signal = new ExoWeb.Signal();

				var id = obj.meta.id || STATIC_ID;
				var mtype = obj.meta.type || obj.meta;

				var objectJson;

				// fetch object json
				log(["objectInit", "lazyLoad"], "Lazy load: {0}({1})", [mtype.get_fullName(), id]);
				// NOTE: should changes be included here?
				objectProvider(mtype.get_fullName(), [id], true, false, ObjectLazyLoader.getRelativePaths(obj), null, signal.pending(function(result) {
					objectJson = result.instances;
				}));

				// does the object's type need to be loaded too?
				if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
					ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
				}

				// wait for type and instance json to load
				signal.waitForAll(function() {
					ExoWeb.Model.LazyLoader.unregister(obj, this);
					objectsFromJson(mtype.get_model(), objectJson);
					callback();
				});
			}).dontDoubleUp({ callbackArg: 2, groupBy: function(obj) { return [obj]; } })
		});

		(function() {
			var instance = new ObjectLazyLoader();

			ObjectLazyLoader.addPaths = function ObjectLazyLoader$addPaths(rootType, paths) {
				var typePaths = instance._typePaths[rootType];
				if (!typePaths)
					typePaths = instance._typePaths[rootType] = [];
				for (var i = 0; i < paths.length; i++) {
					var path = paths[i];
					if (!Array.contains(typePaths, path))
						typePaths.push(path);
				}
			}

			ObjectLazyLoader.getRelativePaths = function getRelativePaths(obj) {
				var relPaths = [];

				for (var typeName in instance._typePaths) {
					var jstype = window[typeName];

					if (jstype && jstype.meta) {
						var paths = instance._typePaths[typeName];
						for (var i = 0; i < paths.length; i++) {
							var path = paths[i].expression;
							var chain = ExoWeb.Model.Model.property(path, jstype.meta);
							var rootedPath = chain.rootedPath(obj.meta.type);
							if (rootedPath)
								relPaths.push(rootedPath);
						}
					}
				}

				return relPaths;
			}

			ObjectLazyLoader.register = function(obj) {
				if (!ExoWeb.Model.LazyLoader.isRegistered(obj, instance))
					ExoWeb.Model.LazyLoader.register(obj, instance);
			}

			ObjectLazyLoader.unregister = function(obj) {
				ExoWeb.Model.LazyLoader.unregister(obj, instance)
			}
		})();


		///////////////////////////////////////////////////////////////////////////////
		// Single Property Loader
		function PropertyLazyLoader() {
			this._requests = {};
		}

		PropertyLazyLoader.mixin({
			load: (function load(obj, propName, callback) {
				var signal = new ExoWeb.Signal();

				var id = obj.meta.id || STATIC_ID;
				var mtype = obj.meta.type || obj.meta;

				var objectJson;

				// fetch object json
				log(["propInit", "lazyLoad"], "Lazy load: {0}({1}).{2}", [mtype.get_fullName(), id, propName]);
				propertyProvider(mtype.get_fullName(), id, true, [], signal.pending(function(result) {
					objectJson = result;
				}));

				// does the object's type need to be loaded too?
				if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
					ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
				}

				// wait for type and instance json to load
				signal.waitForAll(function() {
					ExoWeb.Model.LazyLoader.unregister(obj, this);
					objectsFromJson(mtype.get_model(), objectJson);
					callback();
				});
			}).dontDoubleUp({ callbackArg: 2, groupBy: function(obj) { return [obj]; } })
		});

		(function() {
			var instance = new ObjectLazyLoader();

			PropertyLazyLoader.register = function(obj, prop) {
				if (!ExoWeb.Model.LazyLoader.isRegistered(obj, instance, prop.get_name()))
					ExoWeb.Model.LazyLoader.register(obj, instance, prop.get_name());
			}

			PropertyLazyLoader.unregister = function(obj, prop) {
				ExoWeb.Model.LazyLoader.unregister(obj, instance, prop.get_name())
			}
		})();

		///////////////////////////////////////////////////////////////////////////////
		// List Loader
		function ListLazyLoader() {
		}

		ListLazyLoader.mixin({
			load: (function load(list, propName, callback) {
				var signal = new ExoWeb.Signal();

				var model = list._ownerProperty.get_containingType().get_model();
				var propType = list._ownerProperty.get_jstype().meta;
				var propName = list._ownerProperty.get_name();
				var ownerType = list._ownerProperty.get_containingType().get_fullName();

				// load the objects in the list
				log(["listInit", "lazyLoad"], "Lazy load: {0}({1}).{2}", [ownerType, list._ownerId, propName]);

				var objectJson;

				listProvider(ownerType, list._ownerId, propName, signal.pending(function(result) {
					objectJson = result.instances;
				}));

				// ensure that the property type is loaded as well.
				// if the list has objects that are subtypes, those will be loaded later
				// when the instances are being loaded
				if (!ExoWeb.Model.LazyLoader.isLoaded(propType)) {
					ExoWeb.Model.LazyLoader.load(propType, null, signal.pending());
				}

				signal.waitForAll(function() {
					log("list", "{0}({1}).{2}", [ownerType, list._ownerId, propName]);

					// The actual type name and id as found in the resulting json.
					var jsonId = list._ownerId;
					var jsonType = ownerType;

					// Find the given type and id in the object json.  The type key may be a dervied type.
					function searchJson(mtype, id) {
						// The given type is a key that is present in the result json.
						if (objectJson[mtype.get_fullName()]) {

							// The id is also a key.
							if (objectJson[mtype.get_fullName()][id]) {
								jsonType = mtype.get_fullName();
								jsonId = id;
								return true;
							}

							// Ids returned from the server are not always in the same case as ids on the client, so check one-by-one.
							for (varId in objectJson[mtype.get_fullName()]) {
								if (varId.toLowerCase() == id.toLowerCase()) {
									jsonType = mtype.get_fullName();
									jsonId = varId;
									return true;
								}
							}
						}

						// Check derived types recursively.
						for (var i = 0; i < mtype.derivedTypes.length; i++) {
							if (searchJson(mtype.derivedTypes[i], id))
								return true;
						}
					}

					if (!searchJson(window[ownerType].meta, list._ownerId))
						ExoWeb.trace.throwAndLog(["list", "lazyLoad"], "Data could not be found for {0}:{1}.", [ownerType, list._ownerId]);

					var listJson = objectJson[jsonType][jsonId][propName];

					// populate the list with objects
					for (var i = 0; i < listJson.length; i++) {
						var ref = listJson[i];
						var item = getObject(model, propType, ref.id, ref.type);
						list.push(item);

						// if the list item is already loaded ensure its data is not in the response
						// so that it won't be reloaded
						if (ExoWeb.Model.LazyLoader.isLoaded(item)) {
							delete objectJson[item.meta.type.get_fullName()][ref.id];
						}
					}

					// remove list from json and process the json.  there may be
					// instance data returned for the objects in the list
					if (ExoWeb.Model.LazyLoader.isLoaded(list._ownerId === STATIC_ID ?
						propType.get_jstype() :
						getObject(model, ownerType, list._ownerId, null))) {

						delete objectJson[jsonType][jsonId];
					}

					ListLazyLoader.unregister(list, this);
					objectsFromJson(model, objectJson, callback);
				});
			}).dontDoubleUp({ callbackArg: 2 /*, debug: true, debugLabel: "ListLazyLoader"*/ })
		});

		(function() {
			var instance = new ListLazyLoader();

			ListLazyLoader.register = function(obj, prop) {
				var list = [];

				list._ownerId = prop.get_isStatic() ? STATIC_ID : obj.meta.id;
				list._ownerProperty = prop;

				ExoWeb.Model.LazyLoader.register(list, instance);

				return list;
			}

			ListLazyLoader.unregister = function(list) {
				ExoWeb.Model.LazyLoader.unregister(list, instance);

				delete list._ownerId;
				delete list._ownerType;
				delete list._ownerProperty;
			}
		})();

		ExoWeb.context = function context(options) {
			var model = new ExoWeb.Model.Model();

			var allSignals = new ExoWeb.Signal("ExoWeb.context allSignals");

			var state = {};

			var ret = {
				model: {
					meta: model
				},
				ready: function context$model$ready(callback) { allSignals.waitForAll(callback); },
				server: new ServerSync(model)
			};

			if (options.types) {
				// allow specifying types and paths apart from instance data
				for (var i = 0; i < options.types.length; i++) {
					var typeQuery = options.types[i];

					typeQuery.and = ExoWeb.Model.PathTokens.normalizePaths(typeQuery.and);

					// store the paths for later use
					ObjectLazyLoader.addPaths(typeQuery.from, typeQuery.and);

					// only send properties to server
					typeQuery.serverPaths = typeQuery.and.map(function(path) {
						var strPath;
						path.steps.forEach(function(step) {
							if (!strPath)
								strPath = step.property;
							else
								strPath += "." + step.property;
						});
						return strPath;
					});

					fetchTypes(model, typeQuery, allSignals.pending());

					objectProvider(typeQuery.from, null, true, false, typeQuery.serverPaths, null,
						allSignals.pending(function context$objects$callback(result) {
							// load the json. this may happen asynchronously to increment the signal just in case
							objectsFromJson(model, result.instances, allSignals.pending());
						}),
						allSignals.orPending(function context$objects$callback(error) {
							ExoWeb.trace.logError("objectInit",
								"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
								{ query: query, error: error });
						})
					);
				}
			}

			if (options.model) {
				// start loading the instances first, then load type data concurrently.
				// this assumes that instances are slower to load than types due to caching
				for (varName in options.model) {
					state[varName] = { signal: new ExoWeb.Signal("ExoWeb.context." + varName) };
					allSignals.pending();

					with ({ varName: varName }) {
						var query = options.model[varName];

						query.and = ExoWeb.Model.PathTokens.normalizePaths(query.and);

						// store the paths for later use
						ObjectLazyLoader.addPaths(query.from, query.and);

						// only send properties to server
						query.serverPaths = query.and.map(function(path) {
							var strPath;
							path.steps.forEach(function(step) {
								if (!strPath)
									strPath = step.property;
								else
									strPath += "." + step.property;
							});
							return strPath;
						});

						objectProvider(query.from, [query.id], true, false, query.serverPaths, null,
							state[varName].signal.pending(function context$objects$callback(result) {
								state[varName].objectJson = result.instances;
							}),
							state[varName].signal.orPending(function context$objects$callback(error) {
								ExoWeb.trace.logError("objectInit",
									"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
									{ query: query, error: error });
							})
						);
					}
				}

				// load types
				for (varName in options.model) {
					fetchTypes(model, options.model[varName], state[varName].signal.pending());
				}

				// process instances as they finish loading
				for (varName in options.model) {
					with ({ varName: varName }) {
						state[varName].signal.waitForAll(function context$model() {

							// load the json. this may happen asynchronously to increment the signal just in case
							objectsFromJson(model, state[varName].objectJson, state[varName].signal.pending(function context$model$callback() {
								var query = options.model[varName];
								var mtype = model.type(query.from);
								ret.model[varName] = mtype.get(query.id);

								// model object has been successfully loaded!
								allSignals.oneDone();
							}));
						})
					}
				}
			}

			// setup lazy loading on the container object to control
			// lazy evaluation.  loading is considered complete at the same point
			// model.ready() fires
			ExoWeb.Model.LazyLoader.register(ret, {
				load: function context$load(obj, propName, callback) {
					log(["context", "lazyLoad"], "caller is waiting for ExoWeb.context.ready(), propName={1}", arguments);

					// objects are already loading so just queue up the calls
					allSignals.waitForAll(function context$load$callback() {
						log(["context", "lazyLoad"], "raising ExoWeb.context.ready()");

						ExoWeb.Model.LazyLoader.unregister(obj, this);
						callback();
					});
				}
			});

			allSignals.waitForAll(function() {
				// begin watching for existing objects that are created
				ret.server.beginCapturingRegisteredObjects();
			});

			return ret;
		}

		var pendingExtensions = {};

		window.$extend = function $extend(typeName, callback) {
			var jstype = window[typeName];

			if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
				callback(jstype);
			}
			else {
				var pending = pendingExtensions[typeName];

				if (!pending)
					pending = pendingExtensions[typeName] = ExoWeb.Functor();

				pending.add(callback);
			}
		}
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebMapper", null, execute);
	}
	else {
		execute();
	}

})();
