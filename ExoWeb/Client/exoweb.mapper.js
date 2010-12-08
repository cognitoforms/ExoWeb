Type.registerNamespace("ExoWeb.Mapper");

(function() {

	function execute() {

		var dateRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})\.\d{3}Z$/g;
		var dateRegexReplace = "$2/$3/$1 $4:$5:$6 GMT";

		// Recursively searches throught the specified object and restores dates serialized as strings
		function RestoreDates(value) {
			if (value instanceof Array) {
				for (var i = 0; i < value.length; i++)
				{
					var element = value[i];
					if (element && element.constructor == String && dateRegex.test(element)) {
						dateRegex.lastIndex = 0;
						element = element.replace(dateRegex, dateRegexReplace);
						value[i] = new Date(element);
					}
				}
			}
			else if (value instanceof Object) {
				for (var field in value) {
					if (value.hasOwnProperty(field)) {
						var element = value[field];
						if (element && element.constructor == String && dateRegex.test(element)) {
							dateRegex.lastIndex = 0;
							element = element.replace(dateRegex, dateRegexReplace);
							value[field] = new Date(element);
						}
					}
				}
			}
		}

		var undefined;
		var STATIC_ID = "static";

		var log = ExoWeb.trace.log;
		var throwAndLog = ExoWeb.trace.throwAndLog;

		// Object Provider
		//----------------------------------------------------------
		var objectProviderFn = function objectProviderFn(type, ids, paths, changes, onSuccess, onFailure) {
			ExoWeb.WebService.Request({
				queries:[{type:type, ids:ids, paths:paths}],
				changes:changes
			}, onSuccess, onFailure);
		};
		function objectProvider(type, ids, paths, changes, onSuccess, onFailure) {
			var batch = ExoWeb.Batch.suspendCurrent("objectProvider");
			objectProviderFn.call(this, type, ids, paths, changes,
				function objectProviderSuccess() {
					ExoWeb.Batch.resume(batch);
					if (onSuccess) onSuccess.apply(this, arguments);
				},
				function objectProviderFailure() {
					ExoWeb.Batch.resume(batch);
					if (onFailure) onFailure.apply(this, arguments);
				});
		}
		ExoWeb.Mapper.setObjectProvider = function setObjectProvider(fn) {
			objectProviderFn = fn;
		};

		// Type Provider
		//----------------------------------------------------------
		var typeProviderFn = function typeProviderFn(type, onSuccess, onFailure) {
			ExoWeb.WebService.GetType(type, onSuccess, onFailure);
		};
		function typeProvider(type, onSuccess, onFailure) {
			var batch = ExoWeb.Batch.suspendCurrent("typeProvider");
			var cachedType = ExoWeb.cache(type);
			if (cachedType)
				onSuccess(cachedType);
			else
				typeProviderFn.call(this, type,
					function typeProviderSuccess() {
						ExoWeb.Batch.resume(batch);
						ExoWeb.cache(type, arguments[0]);
						if (onSuccess) onSuccess.apply(this, arguments);
					},
					function typeProviderFailure() {
						ExoWeb.Batch.resume(batch);
						if (onFailure) onFailure.apply(this, arguments);
					});
		}
		ExoWeb.Mapper.setTypeProvider = function setTypeProvider(fn) {
			typeProviderFn = fn;
		};

		// List Provider
		//----------------------------------------------------------
		var listProviderFn = function listProvider(ownerType, ownerId, paths, onSuccess, onFailure) {
			ExoWeb.WebService.Request({
				queries:[{type:ownerType, ids:[ownerId], paths:paths}]
			}, onSuccess, onFailure);
		};
		function listProvider(ownerType, ownerId, listProp, otherProps, onSuccess, onFailure) {
			var batch = ExoWeb.Batch.suspendCurrent("listProvider");

			var listPath = (ownerId == "static" ? ownerType : "this") + "." + listProp;
			var paths = [listPath];

			// prepend list prop to beginning of each other prop
			if (otherProps.length > 0) {
				Array.forEach(otherProps, function(p) {
					paths.push(p.startsWith("this.") ? listPath + "." + p.substring(5) : p);
				});
			}

			listProviderFn.call(this, ownerType, ownerId == "static" ? null : ownerId, paths,
				function listProviderSuccess() {
					ExoWeb.Batch.resume(batch);
					if (onSuccess) onSuccess.apply(this, arguments);
				},
				function listProviderFailure() {
					ExoWeb.Batch.resume(batch);
					if (onFailure) onFailure.apply(this, arguments);
				});
		}
		ExoWeb.Mapper.setListProvider = function setListProvider(fn) {
			listProviderFn = fn;
		};

		// Roundtrip Provider
		//----------------------------------------------------------
		var roundtripProviderFn = function roundtripProviderFn(changes, onSuccess, onFailure) {
			ExoWeb.WebService.Request({changes:changes}, onSuccess, onFailure);
		};
		function roundtripProvider(changes, onSuccess, onFailure) {
			var batch = ExoWeb.Batch.suspendCurrent("roundtripProvider");
			roundtripProviderFn.call(this, changes,
				function roundtripProviderSucess() {
					ExoWeb.Batch.resume(batch);
					if (onSuccess) onSuccess.apply(this, arguments);
				},
				function roundtripProviderFailure() {
					ExoWeb.Batch.resume(batch);
					if (onFailure) onFailure.apply(this, arguments);
				});
		}
		ExoWeb.Mapper.setRoundtripProvider = function setRoundtripProvider(fn) {
			roundtripProviderFn = fn;
		};

		// Save Provider
		//----------------------------------------------------------
		var saveProviderFn = function saveProviderFn(root, changes, onSuccess, onFailure) {
			ExoWeb.WebService.Request({
				events:[{type: 'Save', instance: root}],
				changes:changes
			}, onSuccess, onFailure);
		};
		function saveProvider(root, changes, onSuccess, onFailure) {
			var batch = ExoWeb.Batch.suspendCurrent("saveProvider");
			saveProviderFn.call(this, root, changes,
				function saveProviderSuccess() {
					ExoWeb.Batch.resume(batch);
					if (onSuccess) onSuccess.apply(this, arguments);
				},
				function saveProviderFailure() {
					ExoWeb.Batch.resume(batch);
					if (onFailure) onFailure.apply(this, arguments);
				});
		}
		ExoWeb.Mapper.setSaveProvider = function setSaveProvider(fn) {
			saveProviderFn = fn;
		};

		// Event Provider
		//----------------------------------------------------------
		var eventProviderFn = function eventProviderFn(eventType, instance, event, paths, changes, onSuccess, onFailure) {
			ExoWeb.WebService.Request({
				events:[{type: eventType, instance: instance, event: event}],
				paths:paths,
				changes:changes
			}, onSuccess, onFailure);
		};
		function eventProvider(eventType, instance, event, paths, changes, onSuccess, onFailure) {
			var batch = ExoWeb.Batch.suspendCurrent("eventProvider");
			eventProviderFn.call(this, eventType, instance, event, paths, changes,
				function eventProviderSuccess() {
					ExoWeb.Batch.resume(batch);
					if (onSuccess) onSuccess.apply(this, arguments);
				},
				function eventProviderFailure() {
					ExoWeb.Batch.resume(batch);
					if (onFailure) onFailure.apply(this, arguments);
				});
		}
		ExoWeb.Mapper.setEventProvider = function setEventProvider(fn) {
			eventProviderFn = fn;
		};

		ExoWeb.Model.Entity.formats.$load = new ExoWeb.Model.Format({
			convert: function(obj) {
				return obj.meta.type.toIdString(obj.meta.id);
			},
			convertBack: function(val) {
				var ids = val.split("|");
				var jstype = ExoWeb.Model.Model.getJsType(ids[0]);
				var obj = jstype.meta.get(ids[1]);

				if (!obj) {
					obj = new jstype(ids[1]);
					ObjectLazyLoader.register(obj);
//					log(["entity", "server"], "{0}({1})  (ghost)", [jstype.meta.get_fullName(), ids[1]]);
				}

				return obj;
			}
		});

		function toExoGraph(translator, val) {
			if (val === undefined || val === null)
				return;

			// entities only: translate forward to the server's id
			if (val instanceof ExoWeb.Model.Entity) {
				var result = {
					id: val.meta.id,
					type: val.meta.type.get_fullName()
				};

				if (val.meta.isNew) {
					result.isNew = true;
				}

				result.id = translator.forward(result.type, result.id) || result.id;
				return result;
			}

			return val;
		}

		function translateId(translator, type, id) {
			// get the server id, either translated or as the serialized entity id itself
			var serverId = translator.forward(type, id) || id;
			// get the client id, either a reverse translation of the server id or the server id itself
			var clientId = translator.reverse(type, serverId) || serverId;

			return clientId;
		}

		function fromExoGraph(val, translator) {
			if (val !== undefined && val !== null && val.type && val.id ) {
				var type = ExoWeb.Model.Model.getJsType(val.type);

				// Entities only: translate back to the client's id.  This is necessary to handle the fact that ids are created on 
				// both the client and server.  Also, in some cases a transaction references an entity that was created on the server 
				// and then committed, so that the id actually references an object that already exists on the client but with a different id.
				//--------------------------------------------------------------------------------------------------------
				if (type.meta && type.meta instanceof ExoWeb.Model.Type && translator) {
					// don't alter the original object
					var id = translateId(translator, val.type, val.id);

					var obj = type.meta.get(id);

					if (!obj) {
						obj = new type(id);
						ObjectLazyLoader.register(obj);
						log(["entity", "server"], "{0}({1})  (ghost)", [type.meta.get_fullName(), id]);
					}

					return obj;
				}

				// is this needed? Can the if statement that checks type.meta be removed?
				return val;
			}

			return val;
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

				// don't record changes to types or properties that didn't originate from the server
				if (property.get_containingType().get_origin() != "server" || property.get_origin() !== "server" || property.get_isStatic()) {
					return;
				}

				if (obj instanceof Function) {
//					log("server", "logging list change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
				}
				else {
//					log("server", "logging list change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
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
//					log("server", "logging new: {0}({1})", [obj.meta.type.get_fullName(), obj.meta.id]);

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

				throwAndLog("server", "Unregistering server-type objects is not currently supported: {type.fullName}({id})", obj.meta);
			},
			onPropertyChanged: function ExoGraphEventListener$onPropertyChanged(obj, property, newValue, oldValue) {

				// don't record changes to types or properties that didn't originate from the server
				if (property.get_containingType().get_origin() != "server" || property.get_origin() !== "server" || property.get_isStatic()) {
					return;
				}

				if (property.get_isValueType()) {
					if (obj instanceof Function) {
//						log("server", "logging value change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
					}
					else {
//						log("server", "logging value change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
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
//						log("server", "logging reference change: {0}.{1}", [obj.meta.get_fullName(), property.get_name()]);
					}
					else {
//						log("server", "logging reference change: {0}({1}).{2}", [obj.meta.type.get_fullName(), obj.meta.id, property.get_name()]);
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
//					log(["entity", "server"], "{0}({1})  (ghost)", [obj.meta.type.get_fullName(), obj.meta.id]);
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
//				log("server", "Forcing lazy loading of type \"{0}\".", [name]);
				ExoWeb.Model.LazyLoader.load(jstype.meta, property, callback, thisPtr);
			}
			else if (!jstype && forceLoad) {
//				log("server", "Force creating type \"{0}\".", [name]);
				ensureJsType(model, name, callback, thisPtr);
			}
			else {
//				log("server", "Waiting for existance of type \"{0}\".", [name]);
				$extend(name, function() {
//					log("server", "Type \"{0}\" was loaded, now continuing.", [name]);
					callback.apply(this, arguments);
				}, thisPtr);
			}
		}

		var entitySignals = [];

		function tryGetEntity(model, translator, type, id, property, forceLoad, callback, thisPtr) {
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

				if (obj && forceLoad) {
//					log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
					ExoWeb.Model.LazyLoader.load(obj, property, done, thisPtr);
				}
				else if (!obj && forceLoad) {
//					log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
					var obj = fromExoGraph({ type: type.meta.get_fullName(), id: id }, translator);
					ExoWeb.Model.LazyLoader.eval(obj, property, done);
				}
				else {
//					log("server", "Waiting for existance of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);

					var registeredHandler = function(obj) {
//						log("server", "Object \"{0}|{1}\" was created, now continuing.", [type.meta.get_fullName(), id]);
						if (obj.meta.type === type.meta && obj.meta.id === id) {
							if (property) {
								// if the property is not initialized then wait
								var prop = type.meta.property(property, true);
								if (prop.isInited(obj)) {
									done();
								}
								else {
//									log("server", "Waiting on \"{0}\" property init for object \"{1}|{2}\".", [property, type.meta.get_fullName(), id]);
									var initHandler = function() {
//										log("server", "Property \"{0}\" inited for object \"{1}|{2}\", now continuing.", [property, type.meta.get_fullName(), id]);
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
					};

					// Register the handler once.
					model.addObjectRegistered(registeredHandler, true);
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
			canSaveObject: function ServerSync$canSaveObject(obj) {
				if (!obj) {
					ExoWeb.trace.throwAndLog("server", "Unable to test whether object can be saved:  Object does not exist.");
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
				else {
					if (result.conditions) {
						conditionsFromJson(this._model, result.conditions);
					}
					if (result.changes && result.changes.length > 0) {
						this.applyChanges(result.changes, signal.pending());
					}
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
						RestoreDates(result.event);
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
//				log("server", "auto-roundtrip enabled - interval of {0} milliseconds", [interval]);

				// cancel any pending roundtrip schedule
				this.stopAutoRoundtrip();

				var _this = this;
				function doRoundtrip() {
//					log("server", "auto-roundtrip starting ({0})", [new Date()]);
					_this.roundtrip(function context$autoRoundtripCallback() {
//						log("server", "auto-roundtrip complete ({0})", [new Date()]);
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
//					log("server", "auto-save starting ({0})", [new Date()]);
					_this.save(_this._saveRoot, function ServerSync$doAutoSave$callback() {
//						log("server", "auto-save complete ({0})", [new Date()]);

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
//					log("server", "ServerSync.rollback() >> {0}", steps);

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
//						log("server", "done rolling back {0} changes", [steps]);
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
//				log("server", "rollbackValChange", change.instance);

				var obj = fromExoGraph(change.instance, this._translator);

				Sys.Observer.setValue(obj, change.property, change.oldValue);
				callback();
			},
			rollbackRefChange: function ServerSync$rollbackRefChange(change, callback) {
//				log("server", "rollbackRefChange: Type = {instance.type}, Id = {instance.id}, Property = {property}", change);

				var obj = fromExoGraph(change.instance, this._translator);
				var ref = fromExoGraph(change.oldValue, this._translator);

				Sys.Observer.setValue(obj, change.property, ref);
				callback();
			},
			rollbackInitChange: function ServerSync$rollbackInitChange(change, callback) {
//				log("server", "rollbackInitChange: Type = {type}, Id = {id}", change.instance);

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
//					log("server", "begin applying {length} changes", changes);

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
//						log("server", "done applying {0} changes: {1} captured", [totalChanges, newChanges]);
						this.endApplyingChanges();
						ExoWeb.Batch.end(batch);
						if (callback && callback instanceof Function) {
							callback();
						}
						if (newChanges > 0) {
//							log("server", "raising \"Changes\" property change event");
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
//				log("server", "applySaveChange: {0} changes", [change.idChanges ? change.idChanges.length : "0"]);

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
//				log("server", "applyInitChange: Type = {type}, Id = {id}", change.instance);

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
//				log("server", "applyRefChange: Type = {instance.type}, Id = {instance.id}, Property = {property}", change);

				var returnImmediately = !aggressiveLog;

				tryGetJsType(this._model, change.instance.type, change.property, aggressiveLog, function(srcType) {
					tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, aggressiveLog, function(srcObj) {

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
//				log("server", "applyValChange", change.instance);

				var returnImmediately = !aggressiveLog;

				tryGetJsType(this._model, change.instance.type, change.property, aggressiveLog, function(srcType) {
					tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, aggressiveLog, function(srcObj) {

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
//				log("server", "applyListChange", change.instance);

				var returnImmediately = !aggressiveLog;

				tryGetJsType(this._model, change.instance.type, change.property, aggressiveLog, function(srcType) {
					tryGetEntity(this._model, this._translator, srcType, change.instance.id, change.property, aggressiveLog, function(srcObj) {

						// Call ballback here if type and instance were
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
								tryGetEntity(this._model, this._translator, itemType, item.id, null, true, function(itemObj) {
									list.add(itemObj);
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
								tryGetEntity(this._model, this._translator, itemType, item.id, null, false, function(itemObj) {
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
		};

		ExoWeb.Mapper.TriggerRoundtripRule = ExoWeb.Model.Rule.triggerRoundtrip = TriggerRoundtripRule;

		ExoWeb.Model.Property.mixin({
			triggersRoundtrip: function() {
				var rule = new TriggerRoundtripRule(this);
			}
		});

		///////////////////////////////////////////////////////////////////////////
		function ensureJsType(model, typeName, callback, thisPtr) {
			var mtype = model.type(typeName);

			if (!mtype) {
				fetchType(model, typeName, function(jstype) {
					callback.apply(thisPtr || this, [jstype]);
				});
			}
			else if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
				ExoWeb.Model.LazyLoader.load(mtype, null, function(jstype) {
					callback.apply(thisPtr || this, [jstype]);
				});
			}
			else {
				callback.apply(thisPtr || this, [mtype.get_jstype()]);
			}
		}

		function conditionsFromJson(model, json, callback) {
			for (var code in json) {
				conditionFromJson(model, code, json[code]);
			}

			if (callback && callback instanceof Function) {
				callback();
			}
		}

		function conditionFromJson(model, code, json) {
			var type = ExoWeb.Model.ConditionType.get(code);

			if (!type) {
				ExoWeb.trace.logError(["server", "conditions"], "A condition type with code \"{0}\" could not be found.", [code]);
			}

			Array.forEach(json, function(condition) {

				Array.forEach(condition.targets, function(target) {
					var inst = fromExoGraph(target.instance, model._server._translator);
					if (inst)
					{
						var props = target.properties.map(function(p) { return inst.meta.type.property(p); });
						var c = new ExoWeb.Model.Condition(type, condition.message ? condition.message : type.get_message(), props);
						inst.meta.conditionIf(c, true);
					}
				});
			});
		}

		function objectsFromJson(model, json, callback, thisPtr) {
			var signal = new ExoWeb.Signal("objectsFromJson");

			try {
				for (var typeName in json) {
					var poolJson = json[typeName];
					for (var id in poolJson) {
						// locate the object's state in the json				
						objectFromJson(model, typeName, id, poolJson[id], signal.pending(), thisPtr);
					}
				}
			}
			finally {
				signal.waitForAll(function() {
					callback.apply(thisPtr || this, arguments);
				});
			}
		}

		function objectFromJson(model, typeName, id, json, callback, thisPtr) {
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
					objectFromJson(model, typeName, id, json, callback, thisPtr);
				});
				return;
			}

			// get target object to load
			if (id === STATIC_ID) {
				obj = null;
			}
			else {
				obj = getObject(model, typeName, id, null, true);
			}

//			log("objectInit", "{0}({1})   <.>", [typeName, id]);

			// Load object's properties
			for (var t = mtype; t !== null; t = t.baseType) {
				var props = obj ? t.get_instanceProperties() : t.get_staticProperties();

				for(var propName in props) {
					var prop = props[propName];
				
//					log("propInit", "{0}({1}).{2} = {3}", [typeName, id, propName, propData]);

					if (!prop) {
						throwAndLog(["objectInit"], "Cannot load object {0}({2}) because it has an unexpected property '{1}'", [typeName, propName, id]);
					}

					if(prop.get_origin() !== "server")
						continue;

					var propData;

					// instance fields have indexes, static fields use names
					if(obj) {
						propData = json[prop.get_index()]; 
					}
					else {
						propData = json[propName]; 

						// not all static fields may be present
						if(propData === undefined)
							continue;
					}

					if (propData === null) {
						prop.init(obj, null);
					}
					else {
						var propType = prop.get_jstype();

						 if (prop.get_isList()) {
							var list = prop.value(obj);

							if (propData == "?") {
								// don't overwrite list if its already a ghost
								if (!list) {
									list = ListLazyLoader.register(obj, prop);
									prop.init(obj, list, false);
								}
							}
							else {
								if (!list || !ExoWeb.Model.LazyLoader.isLoaded(list)) {

									var doInit = undefined;

									// json has list members
									if (list) {
										ListLazyLoader.unregister(list);
										doInit = false;
									}
									else {
										list = [];
										doInit = true;
									}

									for (var i = 0; i < propData.length; i++) {
										var ref = propData[i];
										list.push(getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType)));
									}

									if (doInit) {
										prop.init(obj, list);
									}
								}
							}
						}
						else {
							var ctor = prop.get_jstype(true);

							// assume if ctor is not found its a model type not an intrinsic
							if (!ctor || ctor.meta) {
								prop.init(obj, getObject(model, propType, (propData && propData.id || propData), (propData && propData.type || propType)));
							}
							else {
								// Coerce strings into dates
								if (ctor == Date && propData && propData.constructor == String && propData.length > 0) {
									propData = propData.replace(dateRegex, dateRegexReplace);
									propData = new Date(propData);
								}
								prop.init(obj, propData);
							}
						}
					}

					// static fields are potentially loaded one at a time
				}
			}

			if (obj) {
				ObjectLazyLoader.unregister(obj);
			}

			if (callback && callback instanceof Function) {
				callback(thisPtr || this);
			}
		}

		function typesFromJson(model, json) {
			for (var typeName in json) {
				typeFromJson(model, typeName, json[typeName]);
			}
		}

		function typeFromJson(model, typeName, json) {
//			log("typeInit", "{1}   <.>", arguments);

			// get model type. it may have already been created for lazy loading	
			var mtype = getType(model, typeName, json.baseType, true);

			// define properties
			for (var propName in json.properties) {
				var propJson = json.properties[propName];

				// Type
				var propType = propJson.type;
				if (propJson.type.endsWith("[]"))
				{
					propType = propType.toString().substring(0, propType.length - 2);
					propJson.isList = true;
				}
				propType = getJsType(model, propType);

				// Format
				var format = propJson.format ? propType.formats[propJson.format] : null;

				// Add the property
				var prop = mtype.addProperty({ name: propName, type: propType, isList: propJson.isList, label: propJson.label, format: format, isStatic: propJson.isStatic, index: propJson.index });


				// setup static properties for lazy loading
				if (propJson.isStatic) {
					if (propJson.isList) {
						prop.init(null, ListLazyLoader.register(null, prop));
					}
					//TODO
					//else {
					//	PropertyLazyLoader.register(mtype.get_jstype(), prop);
					//}
				}

				if (propJson.rules) {
					for (var i = 0; i < propJson.rules.length; ++i) {
						ruleFromJson(propJson.rules[i], prop);
					}
				}
			}

			// ensure all properties added from now on are considered client properties
			mtype.set_originForNewProperties("client");

			// define methods
			for (var methodName in json.methods) {
				var methodJson = json.methods[methodName];
				mtype.addMethod({ name: methodName, parameters: methodJson.parameters, isStatic: methodJson.isStatic });
			}

			// define condition types
			if (json.conditionTypes)
				conditionTypesFromJson(model, mtype, json.conditionTypes)
		}

		function conditionTypesFromJson(model, mtype, json) {
			for (var code in json) {
				conditionTypeFromJson(model, mtype, code, json[code]);
			}
		}

		function conditionTypeFromJson(model, mtype, code, json) {

			// Attempt to retrieve the condition type by code.
			var conditionType = ExoWeb.Model.ConditionType.get(code);

			// Create the condition type if it does not already exist.
			if (!conditionType) {
				// Get a list of condition type sets for this type.
				var sets = !json.sets ? [] : json.sets.map(function(name) {
					var set = ExoWeb.Model.ConditionTypeSet.get(name);
					if (!set) {
						set = new ExoWeb.Model.ConditionTypeSet(name);
					}
					return set;
				});

				// Create the appropriate condition type based on the category.
				if (json.category == "Error") {
					conditionType = new ExoWeb.Model.ConditionType.Error(code, json.message, sets);
				}
				else if (json.category == "Warning") {
					conditionType = new ExoWeb.Model.ConditionType.Warning(code, json.message, sets);
				}
				else if (json.category == "Permission") {
					conditionType = new ExoWeb.Model.ConditionType.Permission(code, json.message, sets, json.permissionType, json.isAllowed);
				}
				else {
					conditionType = new ExoWeb.Model.ConditionType(code, json.category, json.message, sets);
				}

				// Account for the potential for subclasses to be serialized with additional properties.
				conditionType.extend(json);
			}

			if (json.rule && json.rule.hasOwnProperty("type")) {
				var ruleType = ExoWeb.Model.Rule[json.rule.type];
				var rule = new ruleType(mtype, json.rule, conditionType);
				conditionType.get_rules().push(rule);
			}
		}

		function getJsType(model, typeName, forLoading) {
			// Get an array representing the type family.
			var family = typeName.split(">");

			// Try to get the js type from the window object.
			var jstype = ExoWeb.Model.Model.getJsType(family[0], true);

			// If its not defined, assume the type is a model type
			// that may eventually be fetched.
			if (jstype === undefined) {
				jstype = getType(model, null, family, forLoading).get_jstype();
			}

			return jstype;
		}

		function flattenTypes(types, flattened) {
			function add(item) {
				if (flattened.indexOf(item) < 0) {
					flattened.push(item);
				}
			}

			if (types instanceof Array) {
				Array.forEach(types, add);
			}
			else if (typeof (types) === "string") {
				Array.forEach(types.split(">"), add);
			}
			else if (types) {
				add(types);
			}
		}

		// Gets a reference to a type.  IMPORTANT: typeName must be the
		// family-qualified type name (ex: Employee>Person).
		function getType(model, finalType, propType) {
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

				if (type instanceof ExoWeb.Model.Type) {
					mtype = type;
				}
				else if (type.meta) {
					mtype = type.meta;
				}
				else {
					// type is a string
					mtype = model.type(type);

					// if type doesn't exist, setup a ghost type
					if (!mtype) {
						mtype = model.addType(type, baseType);
						mtype.set_origin("server");

						//if (!forLoading || family.length > 0) {
//							log("typeInit", "{0} (ghost)", [type]);
							TypeLazyLoader.register(mtype);
						//}
					}
				}
			}

			return mtype;
		}

		function getObject(model, propType, id, finalType, forLoading) {
			if (id === STATIC_ID) {
				throwAndLog(["objectInit", "lazyLoad"], "getObject() can only be called for instances (id='{0}')", [id]);
			}

			// get model type
			var mtype = getType(model, finalType, propType);

			// Try to locate object in pool
			var obj = mtype.get(id);

			// if it doesn't exist, create a ghost
			if (!obj) {
				obj = new (mtype.get_jstype())(id);

				if (!forLoading) {
					ObjectLazyLoader.register(obj);
//					log("entity", "{0}({1})  (ghost)", [mtype.get_fullName(), id]);
				}
			}

			return obj;
		}

		///////////////////////////////////////////////////////////////////////////////
		var fetchType = (function Mapper$fetchType(model, typeName, callback, thisPtr) {
			var signal = new ExoWeb.Signal("fetchType(" + typeName + ")");

			var errorObj;

			function success(result) {
				// load type(s)
				typesFromJson(model, result.types);

				// ensure base classes are loaded too
				model.type(typeName).eachBaseType(function(mtype) {
					if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
						ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
					}
				});
			}

			// Handle an error response.  Loading should
			// *NOT* continue as if the type is available.
			function error(error) {
				errorObj = error;
			}

			// request the type and handle the response
			typeProvider(typeName, signal.pending(success), signal.orPending(error));

			// after properties and base class are loaded, then return results
			signal.waitForAll(function() {
				if (errorObj !== undefined) {
					ExoWeb.trace.logError("typeInit",
						"Failed to load {typeName} (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
						{ typeName: typeName, error: errorObj });
				}

				var mtype = model.type(typeName);
				TypeLazyLoader.unregister(mtype);

				raiseExtensions(mtype);

				// done
				if (callback && callback instanceof Function) {
					callback.call(thisPtr || this, mtype.get_jstype());
				}
			});
		}).dontDoubleUp({ callbackArg: 2, thisPtrArg: 3 });

		function fetchPathTypes(model, jstype, path, callback) {
			var step = Array.dequeue(path.steps);
			while (step) {
				// locate property definition in model
				var prop = jstype.meta.property(step.property, true);

				if (!prop) {
					ExoWeb.trace.throwAndLog("typeInit", "Could not find property \"{0}\" on type \"{1}\".", [step.property, jstype.meta.get_fullName()]);
				}

				// don't need to fetch type information for value types
				if (prop.get_isValueType()) {
					break;
				}

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
				else {
					mtype = prop.get_jstype().meta;
				}

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

				step = Array.dequeue(path.steps);
			}

			// done walking path
			if (callback && callback instanceof Function) {
				callback();
			}
		}

		function fetchTypes(model, query, callback) {
			var signal = new ExoWeb.Signal("fetchTypes");

			function rootTypeLoaded(jstype) {
				if (query.and) {
					Array.forEach(query.and, function(path) {
						if (path.steps[0].property === "this") {
							var step = Array.dequeue(path.steps);
							var mtype = jstype.meta;

							var fetchRootTypePaths = function fetchRootTypePaths() {
								fetchPathTypes(model, mtype.get_jstype(), path, signal.pending());
							};

							// handle the case where the root object is cast to a derived type
							if (step.cast) {
								mtype = model.type(step.cast);
								if (!mtype) {
									fetchType(model, step.cast, signal.pending(function() {
										mtype = model.type(step.cast);
										fetchRootTypePaths();
									}));
								}
								else {
									fetchRootTypePaths();
								}
							}
							else {
								fetchRootTypePaths();
							}
						}
						else {
							// This is a static property.  Static property paths 
							// are currently limited to a single property.
							var step = null, typeName = "";
							while (path.steps.length > 1) {
								step = Array.dequeue(path.steps);
								typeName += (typeName.length > 0 ? "." : "") + step.property;
							}

							var mtype = model.type(typeName);

							var fetchStaticPathTypes = function fetchStaticPathTypes() {
								fetchPathTypes(model, (mtype || model.type(typeName)).get_jstype(), path, signal.pending());
							};

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
				}
			}

			// load root type, then load types referenced in paths
			var rootType = model.type(query.from);
			if (!rootType) {
				fetchType(model, query.from, signal.pending(rootTypeLoaded));
			}
			else {
				rootTypeLoaded(rootType.get_jstype());
			}

			signal.waitForAll(callback);
		}

		// {ruleName: ruleConfig}
		function ruleFromJson(rulesJson, prop) {
			for (var name in rulesJson) {
				var json = rulesJson[name];
				var ruleType = ExoWeb.Model.Rule[json.type];
				var rule = new ruleType(json, [prop]);
			}
		}

		///////////////////////////////////////////////////////////////////////////////
		// Type Loader
		function TypeLazyLoader() {
		}

		TypeLazyLoader.mixin({
			load: (function(mtype, propName, callback, thisPtr) {
//				log(["typeInit", "lazyLoad"], "Lazy load: {0}", [mtype.get_fullName()]);
				fetchType(mtype.get_model(), mtype.get_fullName(), callback, thisPtr);
			}).dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(mtype) { return [mtype]; } })
		});

		(function() {
			var instance = new TypeLazyLoader();

			TypeLazyLoader.register = function(obj) {
				ExoWeb.Model.LazyLoader.register(obj, instance);
			};

			TypeLazyLoader.unregister = function(obj) {
				ExoWeb.Model.LazyLoader.unregister(obj, instance);
			};
		})();

		///////////////////////////////////////////////////////////////////////////////
		// Object Loader
		function ObjectLazyLoader() {
			this._requests = {};
			this._typePaths = {};
		}

		ObjectLazyLoader.mixin({
			load: (function load(obj, propName, callback, thisPtr) {
				var signal = new ExoWeb.Signal("object lazy loader");

				var id = obj.meta.id || STATIC_ID;
				var mtype = obj.meta.type || obj.meta;

				// Get the paths from the original query(ies) that apply to this object (based on type).
				var paths = ObjectLazyLoader.getRelativePaths(obj);

				// Add the property to load if specified.  Assumes an instance property.
				if (propName && !Array.contains(paths, "this." + propName)) {
					paths.push("this." + propName);
				}

				// fetch object json
//				log(["objectInit", "lazyLoad"], "Lazy load: {0}({1})", [mtype.get_fullName(), id]);
				// NOTE: should changes be included here?
				objectProvider(mtype.get_fullName(), [id], paths, null,
					function(result) {
						mtype.get_model()._server._handleResult(result, true, function() {
							ExoWeb.Model.LazyLoader.unregister(obj, this);
							callback.call(thisPtr || this, obj);
						});
					},
					function(e) {
						var message = $format("Failed to load {0}({1}): ", [mtype.get_fullName(), id]);
						if (e !== undefined && e !== null &&
							e.get_message !== undefined && e.get_message !== null &&
							e.get_message instanceof Function) {

							message += e.get_message();
						}
						else {
							message += "unknown error";
						}
						ExoWeb.trace.logError("lazyLoad", message);
					});

				// does the object's type need to be loaded too?
				if (! ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
					ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
				}
			}).dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(obj) { return [obj]; } })
		});

		(function() {
			var instance = new ObjectLazyLoader();

			ObjectLazyLoader.addPaths = function ObjectLazyLoader$addPaths(rootType, paths) {
				var typePaths = instance._typePaths[rootType];
				if (!typePaths) {
					typePaths = instance._typePaths[rootType] = [];
				}
				for (var i = 0; i < paths.length; i++) {
					var path = paths[i];
					if (!Array.contains(typePaths, path)) {
						typePaths.push(path);
					}
				}
			};

			ObjectLazyLoader.getRelativePaths = function getRelativePaths(obj) {
				return ObjectLazyLoader.getRelativePathsForType(obj.meta.type);
			};

			ObjectLazyLoader.getRelativePathsForType = function getRelativePathsForType(type) {
				var relPaths = [];

				for (var typeName in instance._typePaths) {
					var jstype = ExoWeb.Model.Model.getJsType(typeName);

					if (jstype && jstype.meta) {
						var paths = instance._typePaths[typeName];
						for (var i = 0; i < paths.length; i++) {
							var path = paths[i].expression;
							var chain = ExoWeb.Model.Model.property(path, jstype.meta);
							// No need to include static paths since if they were 
							// cached then they were loaded previously.
							if (!chain.get_isStatic()) {
								var rootedPath = chain.rootedPath(type);
								if (rootedPath) {
									relPaths.push(rootedPath);
								}
							}
						}
					}
				}

				return relPaths;
			};

			ObjectLazyLoader.register = function(obj) {
				if (!ExoWeb.Model.LazyLoader.isRegistered(obj, instance)) {
					ExoWeb.Model.LazyLoader.register(obj, instance);
				}
			};

			ObjectLazyLoader.unregister = function(obj) {
				ExoWeb.Model.LazyLoader.unregister(obj, instance);
			};
		})();


		///////////////////////////////////////////////////////////////////////////////
		// List Loader
		function ListLazyLoader() {
		}

		ListLazyLoader.mixin({
			load: (function load(list, propName, callback, thisPtr) {
				var signal = new ExoWeb.Signal("list lazy loader");

				var model = list._ownerProperty.get_containingType().get_model();
				var ownerId = list._ownerId;
				var ownerType = list._ownerProperty.get_containingType().get_fullName();
				var prop = list._ownerProperty;
				var propIndex = list._ownerProperty.get_index();
				var propName = list._ownerProperty.get_name();
				var propType = list._ownerProperty.get_jstype().meta;

				// load the objects in the list
//				log(["listInit", "lazyLoad"], "Lazy load: {0}({1}).{2}", [ownerType, ownerId, propName]);

				var objectJson, conditionsJson;

				listProvider(ownerType, list._ownerId, propName, ObjectLazyLoader.getRelativePathsForType(propType),
					signal.pending(function(result) {
						objectJson = result.instances;
						conditionsJson = result.conditions;
					}),
					signal.orPending(function(e) {
						var message = $format("Failed to load {0}({1}).{2}: ", [ownerType, ownerId, propName]);
						if (e !== undefined && e !== null &&
								e.get_message !== undefined && e.get_message !== null &&
								e.get_message instanceof Function) {

							message += e.get_message();
						}
						else {
							message += "unknown error";
						}
						ExoWeb.trace.logError("lazyLoad", message);
					})
				);

				// ensure that the property type is loaded as well.
				// if the list has objects that are subtypes, those will be loaded later
				// when the instances are being loaded
				if (!ExoWeb.Model.LazyLoader.isLoaded(propType)) {
					ExoWeb.Model.LazyLoader.load(propType, null, signal.pending());
				}

				signal.waitForAll(function() {
					if (!objectJson) {
						return;
					}

//					log("list", "{0}({1}).{2}", [ownerType, ownerId, propName]);

					// The actual type name and id as found in the resulting json.
					var jsonId = ownerId;
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
							for (var varId in objectJson[mtype.get_fullName()]) {
								if (varId.toLowerCase() == id.toLowerCase()) {
									jsonType = mtype.get_fullName();
									jsonId = varId;
									return true;
								}
							}
						}

						// Check derived types recursively.
						for (var i = 0; i < mtype.derivedTypes.length; i++) {
							if (searchJson(mtype.derivedTypes[i], id)) {
								return true;
							}
						}
					}

					if (!searchJson(ExoWeb.Model.Model.getJsType(ownerType).meta, ownerId)) {
						ExoWeb.trace.throwAndLog(["list", "lazyLoad"], "Data could not be found for {0}:{1}.", [ownerType, ownerId]);
					}

					var listJson = list._ownerProperty.get_isStatic() ?
						objectJson[jsonType][jsonId][propName] :
						objectJson[jsonType][jsonId][propIndex];

					// populate the list with objects
					for (var i = 0; i < listJson.length; i++) {
						var ref = listJson[i];
						var item = getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType));
						list.push(item);

						// if the list item is already loaded ensure its data is not in the response
						// so that it won't be reloaded
						if (ExoWeb.Model.LazyLoader.isLoaded(item)) {
							delete objectJson[item.meta.type.get_fullName()][ref.id];
						}
					}

					// get the list owner type (static) or entity (non-static)
					var owner = ownerId === STATIC_ID ?
						propType.get_jstype() :
						getObject(model, ownerType, ownerId, null);

					// remove list from json and process the json.  there may be
					// instance data returned for the objects in the list
					if (ExoWeb.Model.LazyLoader.isLoaded(owner)) {
						delete objectJson[jsonType][jsonId];
					}

					ListLazyLoader.unregister(list, this);

					var batch = ExoWeb.Batch.start($format("{0}({1}).{2}", [ownerType, ownerId, propName]));

					var done = function() {
						// Collection change driven by user action or other behavior would result in the "change" event
						//	being raised for the list property.  Since we don't want to record this as a true observable
						//	change, raise the event manually so that rules will still run as needed.
						// This occurs before batch end so that it functions like normal object loading.
						prop._raiseEvent("changed", [owner, { property: prop, newValue: list, oldValue: undefined, wasInited: true, collectionChanged: true}]);

						ExoWeb.Batch.end(batch);
						callback.call(thisPtr || this, list);

					}

					objectsFromJson(model, objectJson, function() {
						if (conditionsJson) {
							conditionsFromJson(model, conditionsJson, done);
						}
						else {
							done();
						}
					});
				});
			}).dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, groupBy: function(list) { return [list]; } /*, debug: true, debugLabel: "ListLazyLoader"*/ })
		});

		(function() {
			var instance = new ListLazyLoader();

			ListLazyLoader.register = function(obj, prop) {
				var list = [];

				list._ownerId = prop.get_isStatic() ? STATIC_ID : obj.meta.id;
				list._ownerProperty = prop;

				ExoWeb.Model.LazyLoader.register(list, instance);

				return list;
			};

			ListLazyLoader.unregister = function(list) {
				ExoWeb.Model.LazyLoader.unregister(list, instance);

				delete list._ownerId;
				delete list._ownerType;
				delete list._ownerProperty;
			};
		})();

		var allSignals = new ExoWeb.Signal("ExoWeb.context allSignals");

		ExoWeb.registerActivity(function() {
			return allSignals.isActive();
		});

		ExoWeb.context = function context(options, context) {
			
			var model = context ? context.model.meta : new ExoWeb.Model.Model();

			var ret = context ? context :  {
				model: {
					meta: model
				},
				ready: function context$model$ready(callback) { allSignals.waitForAll(callback); },
				server: new ServerSync(model)
			};

			var state = {};

			var batch = ExoWeb.Batch.start("init context");

			if (options.model) {
				// start loading the instances first, then load type data concurrently.
				// this assumes that instances are slower to load than types due to caching
				for (var varNameLoad in options.model) {
					(function(varName) {
						state[varName] = { signal: new ExoWeb.Signal("ExoWeb.context." + varName) };
						allSignals.pending();

						var query = options.model[varName];

						query.and = ExoWeb.Model.PathTokens.normalizePaths(query.and);

						// store the paths for later use
						ObjectLazyLoader.addPaths(query.from, query.and);

						// only send properties to server
						query.serverPaths = query.and.map(function(path) {
							var strPath;
							path.steps.forEach(function(step) {
								if (!strPath) {
									strPath = step.property;
								}
								else {
									strPath += "." + step.property;
								}
							});
							return strPath;
						});

						if(query.load) {
							// bypass all server callbacks if data is embedded
							state[varName].objectJson = query.load.instances;
							state[varName].conditionsJson = query.load.conditions;
						}
						else {
							// need to load data from server
							// fetch object state if an id of a persisted object was specified
							if (query.id !== $newId() && query.id !== null && query.id !== undefined && query.id !== "") {
								objectProvider(query.from, [query.id], query.serverPaths, null,
									state[varName].signal.pending(function context$objects$callback(result) {
										state[varName].objectJson = result.instances;
										state[varName].conditionsJson = result.conditions;
									}),
									state[varName].signal.orPending(function context$objects$callback(error) {
										ExoWeb.trace.logError("objectInit",
											"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
											{ query: query, error: error });
									})
								);
							}
							else {
								
								if (query.serverPaths == null)
									query.serverPaths = [];

								// Remove instance paths when an id is not specified
								for (var i = query.serverPaths.length-1; i >= 0; i--) {
									if (query.serverPaths[i].startsWith("this."))
										query.serverPaths.splice(i, 1);	
								}

								// Only call the server if paths were specified
								if (query.serverPaths.length > 0)
								{
									objectProvider(null, null, query.serverPaths, null,
										allSignals.pending(function context$objects$callback(result) {
											// load the json. this may happen asynchronously to increment the signal just in case
											objectsFromJson(model, result.instances, allSignals.pending(function() {
												if (result.conditions) {
													conditionsFromJson(model, result.conditions);
												}
											}));
										}),
										allSignals.orPending(function context$objects$callback(error) {
											ExoWeb.trace.logError("objectInit",
												"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
												{ query: query, error: error });
										})
									);
								}
							}
						}
					})(varNameLoad);
				}

				// load types
				for (var varNameTypes in options.model) {
					fetchTypes(model, options.model[varNameTypes], state[varNameTypes].signal.pending());
				}

				// process instances as they finish loading
				for (var varNameFinish in options.model) {
					(function(varName) {
						state[varName].signal.waitForAll(function context$model() {

							var query = options.model[varName];

							// construct a new object if a "newId" was specified
							if (query.id === $newId()) {
								ret.model[varName] = new (model.type(query.from).get_jstype())();

								// model object has been successfully loaded!
								allSignals.oneDone();
							}

							// otherwise, load the object from json if an id was specified
							else if (query.id !== null && query.id !== undefined && query.id !== "") {
								// load the json. this may happen asynchronously so increment the signal just in case
								objectsFromJson(model, state[varName].objectJson, state[varName].signal.pending(function context$model$callback() {
									var query = options.model[varName];
									var mtype = model.type(query.from);

									var obj = mtype.get(query.id);

									if (obj === undefined) {
										throw new ReferenceError($format("Could not get {0} with id = {1}.", [mtype.get_fullName(), query.id]));
									}

									ret.model[varName] = obj;

									if (state[varName].conditionsJson) {
										conditionsFromJson(model, state[varName].conditionsJson, function() {
											// model object has been successfully loaded!
											allSignals.oneDone();
										});
									}
									else {
										// model object has been successfully loaded!
										allSignals.oneDone();
									}
								}));
							}

							else {
								// model object has been successfully loaded!
								allSignals.oneDone();
							}
						});
					})(varNameFinish);
				}
			}

			
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
							if (!strPath) {
								strPath = step.property;
							}
							else {
								strPath += "." + step.property;
							}
						});
						return strPath;
					});

					fetchTypes(model, typeQuery, allSignals.pending());

					if (typeQuery.serverPaths.length > 0) {
						objectProvider(typeQuery.from, null, typeQuery.serverPaths, null,
							allSignals.pending(function context$objects$callback(result) {
								// load the json. this may happen asynchronously to increment the signal just in case
								objectsFromJson(model, result.instances, allSignals.pending(function() {
									if (result.conditions) {
										conditionsFromJson(model, result.conditions);
									}
								}));
							}),
							allSignals.orPending(function context$objects$callback(error) {
								ExoWeb.trace.logError("objectInit",
									"Failed to load {query.from}({query.id}) (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
									{ query: typeQuery, error: error });
							})
						);
					}
				}
			}
			// setup lazy loading on the container object to control
			// lazy evaluation.  loading is considered complete at the same point
			// model.ready() fires
			ExoWeb.Model.LazyLoader.register(ret, {
				load: function context$load(obj, propName, callback) {
//					log(["context", "lazyLoad"], "caller is waiting for ExoWeb.context.ready(), propName={1}", arguments);

					// objects are already loading so just queue up the calls
					allSignals.waitForAll(function context$load$callback() {
//						log(["context", "lazyLoad"], "raising ExoWeb.context.ready()");

						ExoWeb.Model.LazyLoader.unregister(obj, this);
						callback();
					});
				}
			});

			allSignals.waitForAll(function() {
				model.notifyBeforeContextReady();

				ExoWeb.Batch.end(batch);

				// begin watching for existing objects that are created
				ret.server.beginCapturingRegisteredObjects();
			});

			return ret;
		};

		var pendingTypeExtensions = {};
		var pendingSubtypeExtensions = {};

		function raiseExtensions(mtype) {
			//ExoWeb.Batch.whenDone(function() { 
				// apply app-specific configuration
				// defer until loading is completed to reduce init events
				var exts = pendingTypeExtensions[mtype.get_fullName()];
				if (exts) {
					delete pendingTypeExtensions[mtype.get_fullName()];
					exts(mtype.get_jstype());
				}

				mtype.eachBaseType(function(baseType) {
					var subExts = pendingSubtypeExtensions[baseType.get_fullName()];
					if (subExts) {
						// don't delete subtype extensions since more subtypes may be created
						subExts(mtype.get_jstype());
					}
				});
			//});
		}

		function extendOne(typeName, callback, thisPtr) {
			var jstype = ExoWeb.Model.Model.getJsType(typeName, true);

			if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
				callback.call(thisPtr || this, jstype);
			}
			else {
				var pending = pendingTypeExtensions[typeName];

				if (!pending) {
					pending = pendingTypeExtensions[typeName] = ExoWeb.Functor();
				}

				pending.add(thisPtr ? callback.setScope(thisPtr) : callback);
			}
		}

		window.$extend = function Mapper$extend(typeInfo, callback, thisPtr) {
			if (!typeInfo) {
				ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extend, argument must be of type String or String[].");
			}

			// If typeInfo is an arry of type names, then use a signal to wait until all types are loaded.
			if (typeInfo instanceof Array) {
				var signal = new ExoWeb.Signal("extend");

				var types = [];
				Array.forEach(typeInfo, function(item, index) {
					if (item.constructor !== String) {
						ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extend, item in array must be of type String.");
					}

					extendOne(item, signal.pending(function(type) {
						types[index] = type;
					}), thisPtr);
				});

				signal.waitForAll(function() {
					// When all types are available, call the original callback.
					callback.apply(thisPtr || this, types);
				});
			}
			// Avoid the overhead of signal and just call extendOne directly.
			else {
				if (typeInfo.constructor !== String) {
					ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extend, argument must be of type String or String[].");
				}

				extendOne(typeInfo, callback, thisPtr);
			}
		};

		window.$extendSubtypes = function extendSubtypes(typeName, callback, thisPtr) {
			if (!typeName || typeName.constructor !== String) {
				ExoWeb.trace.throwAndLog("extend", "Invalid value passed into $extendSubtypes, argument must be of type String.");
			}

			var jstype = ExoWeb.Model.Model.getJsType(typeName, true);

			// Call for existing, loaded subtypes
			Array.forEach(jstype.meta.derivedTypes || [], function(mtype) {
				if (mtype && ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
					callback.call(thisPtr || this, mtype.get_jstype());
					Array.forEach(mtype.derivedTypes || [], arguments.callee.spliceArguments(1, 2, arr));
				}
			});
			
			var pending = pendingSubtypeExtensions[typeName];

			if (!pending) {
				pending = pendingSubtypeExtensions[typeName] = ExoWeb.Functor();
			}

			pending.add(thisPtr ? callback.setScope(thisPtr) : callback);
		};
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebMapper", null, execute);
	}
	else {
		execute();
	}

})();

