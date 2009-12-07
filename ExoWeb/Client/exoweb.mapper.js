Type.registerNamespace("ExoWeb.Mapper");

// TODO: logging strategy for other browsers
if (typeof(console) == "undefined"){
	console = {
		log: function(msg) {
			//alert(msg);
		},
		info: function(msg) {
			//alert("INFORMATION: " + msg);
		},
		warn: function(msg) {
			//alert("WARNING: " + msg);
		},
		error: function(msg) {
			alert("ERROR: " + msg);
		}
	}
}

(function() {
	var undefined;
	var STATIC_ID = "static";
	
	var log = ExoWeb.trace.log;

	var objectProvider = ExoWeb.GetInstance;
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
	
	var syncProvider = function() { throw "Not implemented" };
	ExoWeb.Mapper.setSyncProvider = function(fn) {
		syncProvider = fn;
	}
	
	function toWire(obj) {
		if (obj instanceof Array) {
			var wire = [];
			for (var i = 0; i < obj.length; ++i) {
				wire.push(toWire(obj[i]));
			}

			return wire;
		}
		else if (obj.constructor.formats && obj.constructor.formats.$wire) {
			return obj.constructor.formats.$wire.convert(obj);
		}
		else {
			return obj;
		}
	}

	function ServerSync(model) {
		this._queue = [];
		var _this = this;

		// update object
		model.addAfterPropertySet(function(obj, property, newVal) {
			_this.enqueue("update", obj, {
				property: property.get_name(),
				value: toWire(newVal)
			});
		});

		// add object
		model.addObjectRegistered(function(obj) {
			// TODO: New objects created from server response will not have
			// isNew attribute at this point.  Can we rely on id format?
			if (obj.meta.isNew || _this._isNew(obj.meta.id))
				_this.enqueue("new", obj);
		});

		// delete object
		model.addObjectUnregistered(function(obj) {
			_this.enqueue("delete", obj);
		});

		// lists
		model.addListChanged(function(obj, property, changes) {

			for (var i = 0; i < changes.length; ++i) {
				var change = changes[i];

				var addl = {
					property: property.get_name(),
				};
					
				if(change.newStartingIndex >= 0 || addl.newItems) {
					addl.newStartingIndex = change.newStartingIndex;
					addl.newItems = toWire(change.newItems);
				}
				if(change.oldStartingIndex >= 0 || addl.oldItems) {
					addl.oldStartingIndex = change.oldStartingIndex;
					addl.oldItems = toWire(change.oldItems);
				}

				// add changes, convert objects to values
				_this.enqueue("list", obj, addl);
			}
		});
	}

	ServerSync.prototype = {
		apply: function(changes) {
			ExoWeb.trace.log("sync", "applying changes");
		
			if (!changes)
				changes = [];
			else if (!(changes instanceof Array))
				changes = [changes];
		
			var _this = this;
			Array.forEach(changes, function(change) {
				if (change.__type == "Init:#ExoGraph")
					_this.applyInit(change);
				else if (change.__type == "Delete:#ExoGraph")
					_this.applyDelete(change);
				else if (change.__type == "ReferenceChange:#ExoGraph")
					_this.applyRefChange(change);
				else if (change.__type == "ValueChange:#ExoGraph")
					_this.applyValChange(change);
				else if (change.__type == "ListChange:#ExoGraph")
					_this.applyListChange(change);
			});
		},
		applyInit: function ApplyCreateInstance(change) {
			ExoWeb.trace.log("sync", "applyInit: Type = {Type}, Id = {Id}", change.Instance);
			
			var type = window[change.Instance.Type];
			var obj = new type(change.Instance.Id);
		
			obj.meta.isNew = true;
		},
		applyRefChange: function ApplyReferenceChange(change) {
			ExoWeb.trace.log("sync", "applyRefChange", change.Instance);
			
			var type = window[change.Instance.Type];
			var obj = type.meta.get(change.Instance.Id);

			// TODO: validate original value?

			if (change.CurrentValue) {
				var refType = window[change.CurrentValue.Type];
				var ref = refType.meta.get(change.CurrentValue.Id);
				// TODO: check for no ref
				Sys.Observer.setValue(obj, change.Property, ref);
			}
			else {
				Sys.Observer.setValue(obj, change.Property, null);
			}
		},
		applyValChange: function ApplyValueChange(change) {
			ExoWeb.trace.log("sync", "applyValChange", change.Instance);
			
			var type = window[change.Instance.Type];
			var obj = type.meta.get(change.Instance.Id);

			// TODO: validate original value?

			Sys.Observer.setValue(obj, change.Property, change.CurrentValue);
		},
		applyListChange: function ApplyListChange(change) {
			ExoWeb.trace.log("sync", "applyListChange", change.Instance);
			
			var type = window[change.Instance.Type];
			var obj = type.meta.get(change.Instance.Id);
			var prop = obj.meta.property(change.Property);
			var list = prop.value(obj);

			// apply added items
			Array.forEach(change.Added, function(item) {
				var type = window[item.Type];
				var obj = type.meta.get(item.Id);
				Sys.Observer.add(list, obj);
			});

			// apply removed items
			Array.forEach(change.Removed, function(item) {
				var type = window[item.Type];
				var obj = type.meta.get(item.Id);
				Sys.Observer.remove(list, obj);
			});
		},
		enqueue: function(oper, obj, addl) {
			if (oper == "update") {
				ExoWeb.trace.log("sync", "queuing update");
				
				var prop = obj.meta.property(addl.property).lastProperty();
				var entry = {
					__type: null,
					Instance: this._instanceJson(obj),
					Property: prop.get_name(),
					// TODO: original value?
					OriginalValue: null,
					CurrentValue: null
				};
				
				if (prop.get_isValueType()) {
					ExoWeb.trace.log("sync", "update is value type");
					entry.__type = "ValueChange:#ExoGraph";
					entry.CurrentValue = addl.value;
				}
				else {
					entry.__type = "ReferenceChange:#ExoGraph";
					ExoWeb.trace.log("sync", "update is reference type");
					entry.CurrentValue = addl.value ? 
						this._instanceJson(addl.value) :
						null;
				}
				
				this._queue.push(entry);
			}
			else if (oper == "new") {
				ExoWeb.trace.log("sync", "queuing new object");
				
				var entry = {
					__type: "Init:#ExoGraph",
					Instance: this._instanceJson(obj)
				};
				this._queue.push(entry);
			}
			else if (oper == "delete") {
				ExoWeb.trace.log("sync", "queuing delete object");
				
				// TODO: delete JSON format?
				var entry = {
					__type: "Delete:#ExoGraph",
					Instance: this._instanceJson(obj)
				};
				this._queue.push(entry);
			}
			else if (oper == "list") {
				ExoWeb.trace.log("sync", "queuing list change");
				
				var prop = obj.meta.property(addl.property).lastProperty();
				var entry = {
					__type: "ListChange:#ExoGraph",
					Instance: this._instanceJson(obj),
					Property: prop.get_name(),
					Added: [],
					Removed: []
				}
				
				// TODO: are list indices a factor?
				
				// include added items
				if (addl.newItems) {
					var _this = this;
					Array.forEach(addl.newItems, function(obj) {
						entry.Added.push(_this._instanceJson(obj));
					});
				}
				
				// include removed items
				if (addl.oldItems) {
					var _this = this;
					Array.forEach(addl.oldItems, function(obj) {
						entry.Removed.push(_this._instanceJson(obj));
					});
				}
				
				this._queue.push(entry);
			}
		},
		_isNew: function(id) {
			// TODO: handle new objects created at server
			return /\+c[0-9]+/.test(id);
		},
		_instanceJson: function(obj) {
			var ref = {
				id: obj.meta.id,
				type: obj.meta.type.get_fullName()
			};
			
			if(this._isNew(obj.meta.id))
				ref.isNew = true;
			
			return ref;
		}
	}
	ExoWeb.Mapper.ServerSync = ServerSync;
	ServerSync.registerClass("ExoWeb.Mapper.ServerSync");



	///////////////////////////////////////////////////////////////////////////	
	function objectsFromJson(model, json, callback){
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
		catch (e) {
			console.error(e);
		}
		
		signal.waitForAll(callback);
	}
	
	function objectFromJson(model, typeName, id, json, callback) {
		// get the object to load
		var obj;
		
		// family-qualified type name is not available so cann't use getType()
		var mtype = model.type(typeName);
		
		// if this type has never been seen, go and fetch it and resume later
		if(!mtype) {
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
		if(id === STATIC_ID)
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
				console.error($format("unknown property {0}.{1}", [typeName, propName]));
				continue;
			}
			else {
				prop = prop.lastProperty();
			}

			var propType = prop.get_jstype();
			
			if(propData === null) {
				prop.init(obj, null);
			}
			else if (prop.get_isList()) {
				var list = prop.value(obj);
				
				if (propData == "deferred") {
					// don't overwrite list if its already a ghost
					if(!list) {
						list = ListLazyLoader.register(obj, prop);
						prop.init(obj, list, false);
					}
				}
				else {
					if(!list || !ExoWeb.Model.LazyLoader.isLoaded(list)) {
						
						// json has list members
						if(list)
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
				if(!ctor || ctor.meta) {
					prop.init(obj, getObject(model, propType, propData.id, propData.type));
				}
				else {
					var format = ctor.formats.$wire;
					prop.init(obj, (format ? format.convertBack(propData) : propData));
				}
			}
		}
		
		if(obj)
			ObjectLazyLoader.unregister(obj);
		
		if(callback)
			callback();
	}
	
	function typesFromJson(model, json) {		
		for(var typeName in json)
			typeFromJson(model, typeName, json[typeName]);
	}
	
	function typeFromJson(model, typeName, json) {
		log("typeInit", "{1}   <.>", arguments);

		// get model type. it may have already been created for lazy loading	
		var mtype = getType(model, typeName, json.baseType, true);
						
		// define properties
		for(var propName in json.properties){
			var propJson = json.properties[propName];
			
			var propType = getJsType(model, propJson.type);
			var format = propJson.format ? propType.formats[propJson.format] : null;
			
			var prop = mtype.addProperty(propName, propType, propJson.label, format, propJson.isList, propJson.isStatic);
			
			// setup static properties for lazy loading
			if(propJson.isStatic) {
				if(propJson.isList) {
					prop.init(null, ListLazyLoader.register(null, prop));
				}
				else {
					ObjectLazyLoader.register(mtype.get_jstype());
				}
			}
			
			if(propJson.rules) {
				for(var i=0; i<propJson.rules.length; ++i) {
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
			if(flattened.indexOf(item) < 0)
				flattened.push(item);
		}
	
		if(types instanceof Array)
			Array.forEach(types, add);
		else if(typeof(types) === "string")
			Array.forEach(types.split(">"), add);
		else if(types)
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
		
		while(family.length > 0) {
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
				if(!mtype) {		
					mtype = model.addType(type, baseType);
					
					if(!forLoading || family.length > 0) {
						log("typeInit", "{0} (ghost)", [type]);
						TypeLazyLoader.register(mtype);
					}				
				}
			}
		}

		return mtype;
	}
	
	function getObject(model, propType, id, finalType, forLoading) {
		if(id === STATIC_ID)
			throw $format("getObject() can only be called for instances (id='{0}')", [id]);
			
		// get model type
		var mtype = getType(model, finalType, propType);
		
		// Try to locate object in pool
		var obj = mtype.get(id);
		
		// if it doesn't exist, create a ghost
		if(!obj) {
			obj = new (mtype.get_jstype())(id);
			
			if(!forLoading) {
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
		typeProvider(typeName, signal.pending(function(json) {
			
			// load type
			typesFromJson(model, json);
			
			// ensure base classes are loaded too
			for(var b = model.type(typeName).baseType; b; b = b.baseType) {
				if(!ExoWeb.Model.LazyLoader.isLoaded(b))
					ExoWeb.Model.LazyLoader.load(b, null, signal.pending());			
			}			
		}));
		
		// after properties and base class are loaded, then return results
		signal.waitForAll(function() {			
			var mtype = model.type(typeName);
			ExoWeb.Model.LazyLoader.unregister( mtype );
			
			// apply app-specific configuration
			var exts = pendingExtensions[typeName];

			if (exts) {
				delete pendingExtensions[typeName];
				exts(mtype.get_jstype());
			}

			// done
			if(callback)
				callback(mtype.get_jstype());
		});
	}).dontDoubleUp({callbackArg: 2});
	
	function fetchPathTypes(model, jstype, props, callback) {
		try{
			var propName = Array.dequeue(props);

			// locate property definition in model
			// If property is not yet in model skip it. It might be in a derived type and it will be lazy loaded.
			var prop = jstype.meta.property(propName);
			if(!prop) {
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
			if(prop) {
				var mtype = prop.get_jstype().meta;
				
				if(mtype && !ExoWeb.Model.LazyLoader.isLoaded(mtype) ) {
					fetchType(model, mtype.get_fullName(), function(jstype) {
						if (props.length > 0)
							fetchPathTypes(model, jstype, props, callback);
						else if(callback)
							callback();
					});
				}
				else if (callback)
					callback();
			}
			else if(callback)
				callback();	
		}
		catch (e) {
			console.error(e);
		}
	}

	function fetchTypes(model, query, callback) {
		var signal = new ExoWeb.Signal("fetchTypes");
		
		function rootTypeLoaded(jstype) {
			if(query.and) {
				Array.forEach(query.and, function(path) {
					var steps = path.split(".");
					
					if(steps[0] === "this") {
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
						
						if(!mtype) {
							// first time type has been seen, fetch it
							fetchType(model, typeName, signal.pending(fetchStaticPathTypes));
						}
						else if(!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
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
		if(!rootType)
			fetchType(model, query.from, signal.pending(rootTypeLoaded));
		else
			rootTypeLoaded(rootType.get_jstype());
			
		signal.waitForAll(callback);
	}
	
	// {ruleName: ruleConfig}
	function ruleFromJson(json, prop) {
		for(var name in json) {
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
			objectProvider(mtype.get_fullName(), id, true, [], signal.pending(function(result) {
				objectJson = result;
			}));
			
			// does the object's type need to be loaded too?
			if(!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
				ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
			}
			
			// wait for type and instance json to load
			signal.waitForAll(function() {			
				ExoWeb.Model.LazyLoader.unregister(obj);
				objectsFromJson(mtype.get_model(), objectJson);
				callback();
			});
		}).dontDoubleUp({callbackArg: 2, groupBy: function(obj) { return [obj]; } })
	});
	
	(function() {
		var instance = new ObjectLazyLoader();
		
		ObjectLazyLoader.register = function(obj) {
			if(!ExoWeb.Model.LazyLoader.isRegistered(obj, instance))
				ExoWeb.Model.LazyLoader.register(obj, instance);		
		}
		
		ObjectLazyLoader.unregister = function(obj) {
			ExoWeb.Model.LazyLoader.unregister(obj)
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
			if(!ExoWeb.Model.LazyLoader.isLoaded(propType)) {
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
					if(ExoWeb.Model.LazyLoader.isLoaded(item)) {
						delete objectJson[item.meta.type.get_fullName()][item.meta.id];
					}
				}
				
				// remove list from json and process the json.  there may be
				// instance data returned for the objects in the list
				if(ExoWeb.Model.LazyLoader.isLoaded(list._ownerId === STATIC_ID ? 
					propType.get_jstype() : 
					getObject(model, ownerType, list._ownerId, null))) {
					
					delete objectJson[ownerType][list._ownerId];
				}
				
				ListLazyLoader.unregister(list);
				objectsFromJson(model, objectJson, callback);
			});
		}).dontDoubleUp({callbackArg: 2 /*, debug: true, debugLabel: "ListLazyLoader"*/})
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
			ExoWeb.Model.LazyLoader.unregister(list);

			delete list._ownerId;
			delete list._ownerType;
			delete list._ownerProperty;
		}
	})();
	
	///////////////////////////////////////////////////////////////////////////////
	// Globals
	window.$model = function $model(options) {
		var model = new ExoWeb.Model.Model();
		var sync = new ServerSync(model);

		var allSignals = new ExoWeb.Signal("$model allSignals");
		
		var state = {};
		
		var ret = {
			meta: model,
			ready: function(callback) { allSignals.waitForAll(callback); },
			sync: sync,
			commit: function(varName, callback) {
				ExoWeb.trace.log("sync", "Commit");
			
				var _this = this;
				syncProvider(options[varName].from, options[varName].id, options[varName].and, this.sync._queue, function(response) {
					if (response.length) {
						ExoWeb.trace.log("sync", "applying changes from server");
						_this.sync.apply(response);
					}
					callback(response);
				});
			}
		};
		
		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for(varName in options) {
			state[varName] = { signal: new ExoWeb.Signal("$model." + varName) };
			allSignals.pending();
			
			with({varName: varName}) {
				var query = options[varName];
				objectProvider(query.from, query.id, true, query.and, state[varName].signal.pending(function(objectJson) {
					state[varName].objectJson = objectJson;
				}));
			}
		}
		
		// load types
		for(varName in options) {
			fetchTypes(model, options[varName], state[varName].signal.pending());
		}
		
		// process instances as they finish loading
		for(varName in options) {
			with({varName: varName}) {
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
					log(["$model", "lazyLoading"], "loaded");

					ExoWeb.Model.LazyLoader.unregister(obj);
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
