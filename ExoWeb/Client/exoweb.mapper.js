Type.registerNamespace("ExoWeb.Mapper");

(function() {
	var undefined;
	var STATIC_ID = "static";

	var log = ExoWeb.trace.log;

	var objectProvider = ExoWeb.Load;
	ExoWeb.Mapper.setObjectProvider = function(fn) {
		objectProvider = fn;
	}

	var typeProvider = ExoWeb.GetType;
	ExoWeb.Mapper.setTypeProvider = function(fn) {
		typeProvider = fn;
	}

	var listProvider = function(ownerType, ownerId, propName) {
		log("error", "NOT IMPLEMENTED: listProvider({0}, {1}, {2})", arguments);
		throw "Not implemented";
	};

	ExoWeb.Mapper.setListProvider = function(fn) {
		listProvider = fn;
	}

	var syncProvider = function(changes, callback) {
		ExoWeb.Load(null, null, false, false, null, changes, callback)
	};
	ExoWeb.Mapper.setSyncProvider = function(fn) {
		syncProvider = fn;
	}

	var saveProvider = ExoWeb.Save;
	ExoWeb.Mapper.setSaveProvider = function(fn) {
		saveProvider = fn;
	}

	Date.formats.$exograph = Date.formats.ShortDate;

	ExoWeb.Model.ObjectBase.formats.$exograph = new ExoWeb.Model.Format({
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
			return jstype.meta.get(val.id);
		}
	});

	function toExoGraph(translator, val) {
		if (val) {
			var type = val.constructor;
			var fmt = type.formats && type.formats.$exograph;
			var result = fmt ? fmt.convert(val) : val.toString();

			// entities only: translate forward to the server's id
			if (val instanceof ExoWeb.Model.ObjectBase)
				result.id = translator.forward(result.type, result.id) || result.id;

			return result;
		}
	}

	function fromExoGraph(translator, val) {
		if (val) {
			var type = window[val.type];
			
			// entities only: translate back to the client's id
			if (type.meta && type.meta instanceof ExoWeb.Model.Type) {
				// don't alter the original object
				val = Object.copy(val);
				val.id = translator.reverse(val.type, val.id) || val.id;
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
			log("sync", "queuing list changes");

			for (var i = 0; i < listChanges.length; ++i) {
				var listChange = listChanges[i];

				var change = {
					__type: "ListChange:#ExoGraph",
					instance: toExoGraph(this._translator, obj),
					property: property.get_name()
				}

				if (listChange.newStartingIndex >= 0 || listChange.newItems) {
					change.added = [];

					var _this = this;
					Array.forEach(listChange.newItems, function ExoGraphEventListener$onListChanged$addedItem(obj) {
						change.added.push(toExoGraph(_this._translator, obj));
					});
				}
				if (listChange.oldStartingIndex >= 0 || listChange.oldItems) {
					change.removed = [];

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
				log("sync", "queuing new object change");

				var change = {
					__type: "InitNew:#ExoGraph",
					instance: toExoGraph(this._translator, obj)
				};
				
				this._raiseEvent("changeCaptured", [change]);
			}
		},
		onObjectUnregistered: function ExoGraphEventListener$onObjectUnregistered(obj) {
			log("sync", "queuing delete object change");

			// TODO: delete JSON format?
			var change = {
				__type: "Delete:#ExoGraph",
				instance: toExoGraph(this._translator, obj)
			};
			
			this._raiseEvent("changeCaptured", [change]);
		},
		onPropertyChanged: function ExoGraphEventListener$onPropertyChanged(obj, property, newValue, oldValue) {
			log("sync", "queuing update");

			if (property.get_isValueType()) {
				log("sync", "queuing value change");
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
				log("sync", "queuing reference change");
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

		model._sync = this;

		this._listener.addChangeCaptured(this._onChangeCaptured.setScope(this));
	}

	ServerSync.mixin(ExoWeb.Functor.eventing);
	
	ServerSync.mixin({
		update: function ServerSync$update(callback) {
			log("sync", ".update() >> sending {0} changes", [this._changes.length]);
			syncProvider(
				{ changes: this._changes },										// changes
				this._onUpdateSuccess.setScope(this).appendArguments(callback)	// success callback
			);
		},
		_onUpdateSuccess: function ServerSync$_onUpdateSuccess(response, callback) {
			log("sync", "._onUpdateSuccess() >> applying {0} changes", [response.changes.length]);

			// apply changes from server
			if (response.changes.length)
				this.apply(response.changes);

			if (callback && callback instanceof Function)
				callback.call(this, response.changes);

			this._raiseEvent("updateSuccess");
		},
		_onUpdateFailed: function ServerSync$_onUpdateFailed() {
			// TODO
			this._raiseEvent("updateFailed");
		},

		commit: function ServerSync$commit(context, callback) {
			log("sync", ".commit() >> sending {0} changes", [this._changes.length]);
			saveProvider(
				{ type: context.meta.type.get_fullName(), id: context.meta.id },	// root
				{ changes: this._changes },											// changes
				this._onCommitSuccess.setScope(this).appendArguments(callback)		// success callback
			);
		},
		
		_onCommitSuccess: function ServerSync$_onCommitSuccess(response, callback) {
			// truncate the log after a commit has finished
			this._truncateLog();

			log("sync", "._onCommitSuccess() >> applying {0} changes", [response.changes.length]);

			// apply changes from server
			if (response.changes.length)
				this.apply(response.changes);

			if (callback && callback instanceof Function)
				callback.call(this, response.changes);

			this._raiseEvent("commitSuccess");
		},
		_onCommitFailed: function ServerSync$_onCommitFailed() {
			// TODO
			this._raiseEvent("commitFailed");
		},

		_onChangeCaptured: function ServerSync$_onChangeCaptured(change) {
			if (!this.isApplyingChanges())
				this._changes.push(change);
		},
		
		_truncateLog: function ServerSync$_truncateLog() {
			Array.clear(this._changes);
		},

		get_Changes: function ServerSync$get_Changes() {
			return this._changes;
		},

		apply: function ServerSync$_applyChanges(changes) {
			if (!changes || !(changes instanceof Array)) return;

			try {
				this.beginApplyingChanges();

				// apply each change
				Array.forEach(changes, this.applyChange.setScope(this));

				// add non-commit changes to the queue
				Array.addRange(this._changes, $transform(changes).where(function(e) {
					return e.__type != "Commit:#ExoGraph";
				}));
			}
			finally {
				this.endApplyingChanges();
			}
		},
		applyChange: function ServerSync$applyChange(change) {
			if (change.__type == "InitNew:#ExoGraph")
				this.applyInit(change);
			else if (change.__type == "Delete:#ExoGraph")
				this.applyDelete(change);
			else if (change.__type == "ReferenceChange:#ExoGraph")
				this.applyRefChange(change);
			else if (change.__type == "ValueChange:#ExoGraph")
				this.applyValChange(change);
			else if (change.__type == "ListChange:#ExoGraph")
				this.applyListChange(change);
			else if (change.__type == "Commit:#ExoGraph")
				this.applyCommitChange(change);
		},
		applyCommitChange: function ServerSync$applyCommitChange(change) {
			// previous changes should be discarded on commit
			this._raiseEvent("afterCommit");

			// update each object with its new id
			for (var i = 0; i < change.idChanges.length; i++) {
				var idChange = change.idChanges[i];

				var type = this._model.type(idChange.type);
				type.changeObjectId(idChange.from, idChange.to);
			}
		},
		applyInit: function ServerSync$applyInit(change) {
			log("sync", "applyInit: Type = {Type}, Id = {Id}", change.instance);

			var type = this._model.type(change.instance.type);

			if (!type)
				log("sync", "ERROR - type {Type} was not found in model", change.instance);

			var jstype = type.get_jstype();
			var newObj = new jstype();

			// remember new object's generated id
			this._translator.add(change.instance.type, newObj.meta.id, change.instance.id);
		},
		applyRefChange: function ServerSync$applyRefChange(change) {
			log("sync", "applyRefChange", change.instance);

			var obj = fromExoGraph(this._translator, change.instance);

			// TODO: validate original value?

			if (change.newValue) {
				var ref = fromExoGraph(this._translator, change.newValue);

				// TODO: check for no ref
				Sys.Observer.setValue(obj, change.property, ref);
			}
			else {
				Sys.Observer.setValue(obj, change.property, null);
			}
		},
		applyValChange: function ServerSync$applyValChange(change) {
			log("sync", "applyValChange", change.instance);

			var obj = fromExoGraph(this._translator, change.instance);

			// TODO: validate original value?

			Sys.Observer.setValue(obj, change.property, change.newValue);
		},
		applyListChange: function ServerSync$applyListChange(change) {
			log("sync", "applyListChange", change.instance);

			var obj = fromExoGraph(this._translator, change.instance);
			var prop = obj.meta.property(change.property);
			var list = prop.value(obj);

			var _this = this;
			// apply added items
			Array.forEach(change.added, function(item) {
				var obj = fromExoGraph(_this._translator, item);
				Sys.Observer.add(list, obj);
			});

			// apply removed items
			Array.forEach(change.removed, function(item) {
				var obj = fromExoGraph(_this._translator, item);
				Sys.Observer.remove(list, obj);
			});
		}
	});

	ServerSync.invokeUpdate = function ServerSync$invokeUpdate(context, callback) {
		if (context instanceof ExoWeb.Model.ObjectBase) {
			context = context.meta.type.get_model();
		}

		if (context instanceof ExoWeb.Model.Model) {
			if (context._sync)
				context._sync.update(callback);
			else
				// TODO
				;
		}
	}
	ServerSync.invokeCommit = function ServerSync$invokeCommit(context, callback) {
		var model;
		if (context instanceof ExoWeb.Model.ObjectBase) {
			model = context.meta.type.get_model();
		}
		
		if (model && model instanceof ExoWeb.Model.Model) {
			if (model._sync)
				model._sync.commit(context, callback);
			else
				// TODO
				;
		}
	}

	ExoWeb.Mapper.ServerSync = ServerSync;
	ServerSync.registerClass("ExoWeb.Mapper.ServerSync");



	///////////////////////////////////////////////////////////////////////////	
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
				throw $format("Cannot load object {0}({2}) because it has an unexpected property '{1}'", [typeName, propName, id]);
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

			var prop = mtype.addProperty(propName, propType, propJson.isList, propJson.label, format, propJson.isStatic);

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
			throw $format("getObject() can only be called for instances (id='{0}')", [id]);

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
		typeProvider(typeName, signal.pending(function(result) {

			// load type
			typesFromJson(model, result.types);

			// ensure base classes are loaded too
			for (var b = model.type(typeName).baseType; b; b = b.baseType) {
				if (!ExoWeb.Model.LazyLoader.isLoaded(b))
					ExoWeb.Model.LazyLoader.load(b, null, signal.pending());
			}
		}));

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

	function fetchPathTypes(model, jstype, props, callback) {
		var propName = Array.dequeue(props);

		// locate property definition in model
		// If property is not yet in model skip it. It might be in a derived type and it will be lazy loaded.
		var prop = jstype.meta.property(propName);
		if (!prop) {
			if (jstype.meta.derivedTypes) {
				// TODO: handle multiple levels of derived types
				for (var i = 0, len = jstype.meta.derivedTypes.length, derivedType = null; i < len; i++) {
					if (derivedType = jstype.meta.derivedTypes[i].get_jstype()) {
						if (prop = derivedType.meta.property(propName)) {
							break;
						}
					}
				}
			}
		}

		// Load the type of the property if its not yet loaded
		if (prop) {
			var mtype = prop.get_jstype().meta;

			if (mtype && !ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
				fetchType(model, mtype.get_fullName(), function(jstype) {
					if (props.length > 0)
						fetchPathTypes(model, jstype, props, callback);
					else if (callback)
						callback();
				});
			}
			else if (callback)
				callback();
		}
		else if (callback)
			callback();
	}

	function fetchTypes(model, query, callback) {
		var signal = new ExoWeb.Signal("fetchTypes");

		function rootTypeLoaded(jstype) {
			if (query.and) {
				Array.forEach(query.and, function(path) {
					var steps = path.split(".");

					if (steps[0] === "this") {
						Array.dequeue(steps);
						fetchPathTypes(model, jstype, steps, signal.pending());
					}
					else {
						// this is a static property

						var typeName = Array.dequeue(steps);
						var mtype = model.type(typeName);

						function fetchStaticPathTypes() {
							fetchPathTypes(model, (mtype || model.type(typeName)).get_jstype(), steps, signal.pending());
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
	}

	ObjectLazyLoader.mixin({
		load: (function load(obj, propName, callback) {
			var signal = new ExoWeb.Signal();

			var id = obj.meta.id || STATIC_ID;
			var mtype = obj.meta.type || obj.meta;

			var objectJson;

			// fetch object json
			log(["objectInit", "lazyLoad"], "Lazy load: {0}({1})", [mtype.get_fullName(), id]);
			objectProvider(mtype.get_fullName(), [id], true, false, [], null, signal.pending(function(result) {
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
				objectJson = result;
			}));

			// ensure that the property type is loaded as well.
			// if the list has objects that are subtypes, those will be loaded later
			// when the instances are being loaded
			if (!ExoWeb.Model.LazyLoader.isLoaded(propType)) {
				ExoWeb.Model.LazyLoader.load(propType, null, signal.pending());
			}

			signal.waitForAll(function() {
				log("list", "{0}({1}).{2}", [ownerType, list._ownerId, propName]);

				var listJson = objectJson[ownerType][list._ownerId][propName];

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

					delete objectJson[ownerType][list._ownerId];
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

	///////////////////////////////////////////////////////////////////////////////
	// Globals
	window.$model = function $model(options) {
		var model = new ExoWeb.Model.Model();

		var allSignals = new ExoWeb.Signal("$model allSignals");

		var sync = new ServerSync(model);

		var state = {};

		var ret = {
			meta: model,
			syncObject: sync,
			ready: function $model$ready(callback) { allSignals.waitForAll(callback); },
			startAutoUpdate: function $model$startAutoUpdate(interval) {
				log("sync", "auto-update enabled - interval of {0} milliseconds", [interval]);

				this.stopAutoUpdate();

				var _this = this;
				function doUpdate() {
					log("sync", "auto-update starting ({0})", [new Date()]);
					sync.update(function $model$autoUpdateCallback() {
						log("sync", "auto-update complete ({0})", [new Date()]);
						_this._timeout = window.setTimeout(doUpdate, interval);
					});
				}

				this._timeout = window.setTimeout(doUpdate, interval);
			},
			stopAutoUpdate: function $model$stopAutoUpdate() {
				if (this._timeout)
					window.clearTimeout(this._timeout);
			}
		};

		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for (varName in options) {
			state[varName] = { signal: new ExoWeb.Signal("$model." + varName) };
			allSignals.pending();

			with ({ varName: varName }) {
				var query = options[varName];
				objectProvider(query.from, [query.id], true, false, query.and, null, state[varName].signal.pending(function(result) {
					state[varName].objectJson = result.instances;
				}));
			}
		}

		// load types
		for (varName in options) {
			fetchTypes(model, options[varName], state[varName].signal.pending());
		}

		// process instances as they finish loading
		for (varName in options) {
			with ({ varName: varName }) {
				state[varName].signal.waitForAll(function() {

					// load the json. this may happen asynchronously to increment the signal just in case
					objectsFromJson(model, state[varName].objectJson, state[varName].signal.pending(function() {
						var query = options[varName];
						var mtype = model.type(query.from);
						ret[varName] = mtype.get(query.id);

						// model object has been successfully loaded!
						allSignals.oneDone();
					}));
				})
			}
		}

		// setup lazy loading on the container object to control
		// lazy evaluation.  loading is considered complete at the same point
		// model.ready() fires
		ExoWeb.Model.LazyLoader.register(ret, {
			load: function(obj, propName, callback) {
				log(["$model", "lazyLoading"], "caller is waiting for $model.ready(), propName={1}", arguments);

				// objects are already loading so just queue up the calls
				allSignals.waitForAll(function() {
					log(["$model", "lazyLoading"], "raising $model.ready()");

					ExoWeb.Model.LazyLoader.unregister(obj, this);
					callback();
				});
			}
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
})();
