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
	
	var objectProvider = ExoWeb.GetInstance;
	ExoWeb.Mapper.setObjectProvider = function(fn) {
		objectProvider = fn;
	}

	var typeProvider = ExoWeb.GetType;
	ExoWeb.Mapper.setTypeProvider = function(fn) {
		typeProvider = fn;
	}
	
	var listProvider = function() { throw "Not implemented" };
	ExoWeb.Mapper.setListProvider = function(fn) {
		listProvider = fn;
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
			var type = window[change.Instance.Type];
			var obj = new type(change.Instance.Id);

			// TODO: probably not needed, can tell from id?
			obj.meta.isNew = true;
		},
		applyInit: function ApplyCreateInstance(change) {
			var type = window[change.Instance.Type];
			var obj = new type(change.Instance.Id);

			// TODO: probably not needed, can tell from id?
			obj.meta.isNew = true;
		},
		applyRefChange: function ApplyReferenceChange(change) {
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
			var type = window[change.Instance.Type];
			var obj = type.meta.get(change.Instance.Id);

			// TODO: validate original value?

			Sys.Observer.setValue(obj, change.Property, change.CurrentValue);
		},
		applyListChange: function ApplyListChange(change) {
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
					entry.__type = "ValueChange:#ExoGraph";
					entry.CurrentValue = addl.value;
				}
				else {
					entry.__type = "ReferenceChange:#ExoGraph";
					entry.CurrentValue = addl.value ? 
						this._instanceJson(addl.value) :
						null;
				}
				
				this._queue.push(entry);
			}
			else if (oper == "new") {
				var entry = {
					__type: "Init:#ExoGraph",
					Instance: this._instanceJson(obj)
				};
				this._queue.push(entry);
			}
			else if (oper == "delete") {
				// TODO: delete JSON format?
				var entry = {
					__type: "Delete:#ExoGraph",
					Instance: this._instanceJson(obj)
				};
				this._queue.push(entry);
			}
			else if (oper == "list") {
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
			return /\+c[0-9]+/.test(id);
		},
		_instanceJson: function(obj) {
			return {
				Id: obj.meta.id,
				IsNew: this._isNew(obj.meta.id),
				Type: obj.meta.type.get_fullName()
			};
		}
	}
	ExoWeb.Mapper.ServerSync = ServerSync;
	ServerSync.registerClass("ExoWeb.Mapper.ServerSync");



	///////////////////////////////////////////////////////////////////////////	
	function objectsFromJson(model, json, callback){
		var signal = new ExoWeb.Signal("objectsFromJson");
		
		try {
			
			for (var typeName in json) {
				for (var id in json[typeName]) {
					// locate the object's state in the json				
					objectFromJson(model, typeName, id, json[typeName][id], signal.pending());
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
		var mtype;
		
		if(id == STATIC_ID) {
			obj = null;
			mtype = getType(model, typeName);
		}
		else {
			obj = getObject(model, typeName, id, true);
			mtype = obj.meta.type;
		}
		
		// Load object's type if needed
		if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
			ExoWeb.Model.LazyLoader.load(mtype, null, function() {
				objectFromJson(model, typeName, id, json, callback);
			});
		}
		else {
			console.log($format("Object: {0}({1})", [typeName, id]));
						
			// Load object's properties
			for (var propName in json) {			
				var prop = mtype.property(propName);
				var propData = json[propName];
				
				//console.log(propName + ": ", propData);

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
								var childId = propData[i];
								list.push(getObject(model, propType, childId));
							}									

						}
					}
				}
				else {
					var ctor = prop.get_jstype(true);
					
					// assume if ctor is not found its a model type not an intrinsic
					if(!ctor || ctor.meta) {
						prop.init(obj, getObject(model, propType, propData));
					}
					else {
						var format = ctor.formats.$wire;
						prop.init(obj, (format ? format.convertBack(propData) : propData));
					}
				}
			}
			
			ObjectLazyLoader.unregister(obj);
			
			if(callback)
				callback();
		}
	}
	
	function typesFromJson(model, json) {		
		for(var typeName in json)
			typeFromJson(model, typeName, json[typeName]);
	}
	
	function typeFromJson(model, typeName, json) {
		console.log("Type: " + typeName);

		// get model type. it may have already been created for lazy loading	
		var mtype = getType(model, (json.baseType ? typeName + ">" + json.baseType: typeName), true);
						
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
				else if(!ExoWeb.Model.LazyLoader.isRegistered(mtype.get_jstype())){
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
		
		var jstype = window[family[0]];
		return jstype ? jstype : getType(model, family, forLoading).get_jstype();
	}

	
	function getType(model, typeName, forLoading) {
		// ensure the entire type family is at least ghosted
		// so that javascript OO mechanisms work properly
		var family;
		
		if(typeName instanceof Array)
			family = typeName;
		else 
			family = typeName.split(">");
		
		
		var mtype;
		var baseType;
		
		for(var i=family.length-1; i>=0; --i) {
			var typeName = family[i];
			
			baseType = mtype;
			mtype = model.type(typeName);

			// if type doesn't exist, setup a ghost type
			if(!mtype) {
				mtype = model.addType(typeName, baseType);
								
				if(!forLoading || i > 0) {
					console.log("Type: " + typeName + " (ghost)");
					TypeLazyLoader.register(mtype);
				}				
			}
		}

		return mtype;
	}
	
	function getObject(model, type, id, forLoading) {
		if(id === STATIC_ID)
			throw $format("getObject() can only be called for instances (id='{0}')", [id]);
			
		// get model type
		var mtype;
		
		if (id.indexOf("|") > 0){
		    mtype = getType(model, id.substring(0, id.indexOf("|")));
		    id = id.substring(id.indexOf("|") + 1);
		}
		else if (type instanceof ExoWeb.Model.Type)
		    mtype = type;
		else if (type.meta)
		    mtype = type.meta;
		else
			mtype = getType(model, type);
		
		// Try to locate object in pool
		var obj = mtype.get(id);
		
		// if it doesn't exist, create a ghost
		if(!obj) {
			obj = new (mtype.get_jstype())(id);
			
			if(!forLoading) {
				ObjectLazyLoader.register(obj);
				console.log($format("Object: {0}({1})  (ghost)", [mtype.get_fullName(), id]));
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
				console.log(b.get_fullName() + " loaded = " + ExoWeb.Model.LazyLoader.isLoaded(b));
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
							fetchPathTypes(model, mtype.get_jstype(), steps, signal.pending(fetchStaticPathTypes));
						}
						
						if(!mtype) {
							// first time type has been seen, fetch it it
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
			console.log("Lazy load: " + mtype.get_fullName());
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
			console.log($format("Lazy load: {0}({1})", [mtype.get_fullName(), id]));
			objectProvider(mtype.get_fullName(), id, [], signal.pending(function(result) {
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
			console.log($format("Lazy load: {0}({1}).{2}", [ownerType, list._ownerId, propName]));

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
				console.log($format("List: {0}({1}).{2}", [ownerType, list._ownerId, propName]));
				
				var listJson = objectJson[ownerType][list._ownerId][propName];
				
				// populate the list with objects
				for (var i = 0; i < listJson.length; i++) {
					var itemId = listJson[i];
					var item = getObject(model, propType, itemId);
					list.push(item);
					
					// if the list item is already loaded ensure its data is not in the response
					// so that it won't be reloaded
					if(ExoWeb.Model.LazyLoader.isLoaded(item)) {
						delete objectJson[item.meta.type.get_fullName()][itemId];
					}
				}
				
				// remove list from json and process the json.  there may be
				// instance data returned for the objects in the list
				if(ExoWeb.Model.LazyLoader.isLoaded(list._ownerId === STATIC_ID ? 
					propType.get_jstype() : 
					getObject(model, ownerType, list._ownerId))) {
					
					delete objectJson[ownerType][list._ownerId];
				}
				
				ListLazyLoader.unregister(list);
				objectsFromJson(model, objectJson, callback);
			});
		}).dontDoubleUp({callbackArg: 2 /*, debug: true, debugLabel: "ListLazyLoader"*/})
	});
	
	(function() {
		var instance = new ListLazyLoader();
		var debugCounter =0;
		
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
	window.$model = function $model(options, callback) {
		var model = new ExoWeb.Model.Model();
		
		var allSignals = new ExoWeb.Signal("$model allSignals");
		
		var state = {};
		
		var ret = {
			meta: model,
			ready: function(callback) { allSignals.waitForAll(callback); }
		};
		
		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for(varName in options) {
			state[varName] = { signal: new ExoWeb.Signal("$model." + varName) };
			allSignals.pending();
			
			with({varName: varName}) {
				var query = options[varName];
				objectProvider(query.from, query.id, query.and, state[varName].signal.pending(function(objectJson) {
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
					
					objectsFromJson(model, state[varName].objectJson, allSignals.pending());
					
					var query = options[varName];
					var mtype = model.type(query.from);
					
					ret[varName] = mtype.get(query.id);
					
					allSignals.oneDone();
				})
			}
		}
		
		// setup lazy loading on the container object.
		ExoWeb.Model.LazyLoader.register(ret, {
			load: function(obj, propName, callback) {

				// objects are already loading so just queue up the calls
				(propName ? state[propName].signal : allSignals).waitForAll(function() {
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
