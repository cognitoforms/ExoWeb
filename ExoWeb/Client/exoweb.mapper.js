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
			if (obj.meta.isNew)
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
		enqueue: function(oper, obj, addl) {
			var entry = { oper: oper, type: obj.meta.type.get_fullName(), id: toWire(obj) };

			if (addl) {
				for (var i in addl) {
					entry[i] = addl[i];
				}
			}
			this._queue.push(entry);
			
			if(this.enableConsole) {
				var s = "";
				
				if(addl && addl.property)
					s += "." + addl.property;

				for(var key in addl){
					if(key != "property")
						s += "; " + key + "=" + addl[key];
				}
				
				console.log($format("{oper}: {type}({id}){addl}", {oper: entry.oper, type: entry.type, id: entry.id, addl: s}));
			}
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
		var obj = getObject(model, typeName, id, true);
		
		// Load object's type if needed
		if (!ExoWeb.Model.LazyLoader.isLoaded(obj.meta)) {
			ExoWeb.Model.LazyLoader.load(obj.meta, null, function() {
				objectFromJson(model, typeName, id, objectJson, callback);
			});
		}
		else {
			console.groupCollapsed($format("Object: {0}({1})", [typeName, id]));
			
			// Load object's properties
			for (var propName in json) {
				var prop = obj.meta.property(propName);
				var propData = json[propName];
				
				console.log(propName + ": ", propData);

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
						if(!list || !ExoWeb.LazyLoader.isLoaded(list)) {
							
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

			console.groupEnd();
			
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
		var mtype = getType(model, typeName, true);
		
		// handle base class
		if(json.baseType)
			mtype.set_baseType(getType(model, json.baseType));
		else
			mtype.set_baseType(null);
				
		// define properties
		for(var propName in json.properties){
			var propJson = json.properties[propName];
			
			var propType = getJsType(model, propJson.type);
			var format = propJson.format ? propType.formats[propJson.format] : null;
			
			var prop = mtype.addProperty(propName, propType, propJson.label, format, propJson.isList);
			
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
		
		var jstype = window[typeName];
		return jstype ? jstype : getType(model, typeName, forLoading).get_jstype();
	}

	
	function getType(model, typeName, forLoading) {		
		// if type doesn't exist, setup a ghost type
		mtype = model.type(typeName);
		if(!mtype) {
			mtype = model.addType(typeName);
			
			if(!forLoading) {
				console.log("Type: " + typeName + " (ghost)");
				TypeLazyLoader.register(mtype);
			}
		}
		
		return mtype;
	}
	
	function getObject(model, type, id, forLoading) {
		// check the id to see if it has more specific type info in it
		if (id.indexOf("|") > 0)
			type = id.substring(0, id.indexOf("|"));

		// get model type
		var mtype = type instanceof ExoWeb.Model.Type ? type : type.meta || getType(model, type);
		
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
			for(var t in json) {
				if(json[t].baseType) {
					var baseType = getType(model, json[t].baseType)
					
					if(!ExoWeb.Model.LazyLoader.isLoaded(baseType))
						ExoWeb.Model.LazyLoader.load(baseType, null, signal.pending());
				}
			}
		}));
		
		// after properties and base class are loaded, then return results
		signal.waitForAll(function() {			
			var mtype = model.type(typeName);
			ExoWeb.Model.LazyLoader.unregister( mtype );
			
			if(callback)
				callback(mtype.get_jstype());
		});
	}).dontDoubleUp({callbackArg: 2});
	
	function resolveType(typeName) {
		return window[typeName];
	}
	
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
						if (derivedType = resolveType(jstype.meta.derivedTypes[i])) {
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
					fetchPathTypes(model, jstype, path.split("."), signal.pending());
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
			var objectJson;
			
			// fetch object json
			console.log($format("Lazy load: {0}({1})", [obj.meta.type.get_fullName(), obj.meta.id]));
			objectProvider(obj.meta.type.get_fullName(), obj.meta.id, [], signal.pending(function(result) {
				objectJson = result;
			}));
			
			// does the object's type need to be loaded too?
			if(!ExoWeb.Model.LazyLoader.isLoaded(obj.meta.type)) {
				ExoWeb.Model.LazyLoader.load(obj.meta.type, null, signal.pending());
			}
			
			// wait for type and instance json to load
			signal.waitForAll(function() {				
				ExoWeb.Model.LazyLoader.unregister(obj);
				objectsFromJson(obj.meta.type.get_model(), objectJson);
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
			
			// load the objects in the list
			console.log($format("Lazy load: {0}({1}).{2}", [list._ownerType, list._ownerId, propName]));

			var objectJson;
			
			listProvider(list._ownerType, list._ownerId, propName, signal.pending(function(result) {
				objectJson = result;
			}));
			
			// ensure that the property type is loaded as well.
			// if the list has objects that are subtypes, those will be loaded later
			// when the instances are being loaded
			if(!ExoWeb.Model.LazyLoader.isLoaded(propType)) {
				ExoWeb.Model.LazyLoader.load(propType, null, signal.pending());
			}
			
			signal.waitForAll(function() {
				console.log($format("List: {0}({1}).{2}", [list._ownerType, list._ownerId, propName]));
				
				var listJson = objectJson[list._ownerType][list._ownerId][propName];
				
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
				if(ExoWeb.Model.LazyLoader.isLoaded(getObject(model, list._ownerType, list._ownerId))) {
					delete objectJson[list._ownerType][list._ownerId];
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
			
			list._ownerId = obj.meta.id;
			list._ownerType = obj.meta.type.get_fullName();
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
	function $model(options, callback) {
		var model = new ExoWeb.Model.Model();
		
		var allSignals = new ExoWeb.Signal("$model allSignals");
		
		var state = {};
		
		var ret = {meta: model};
		
		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for(varName in options) {
			state[varName] = { signal: new ExoWeb.Signal("$model." + varName) };
			allSignals.pending();
			
			(function(varName) {
				var query = options[varName];
				objectProvider(query.from, query.id, query.and, state[varName].signal.pending(function(objectJson) {
					state[varName].objectJson = objectJson;
				}));
			})(varName);
		}
		
		// load types
		for(varName in options) {
			fetchTypes(model, options[varName], state[varName].signal.pending());
		}

		// process instances as they finish loading
		for(varName in options) {
			(function(varName) {
				state[varName].signal.waitForAll(function() {
					
					objectsFromJson(model, state[varName].objectJson, allSignals.pending());
					
					var query = options[varName];
					var mtype = model.type(query.from);
					
					ret[varName] = mtype.get(query.id);
					
					allSignals.oneDone();
				})
			})(varName);
		}
		
		allSignals.waitForAll(function() {			
			//finish up			
			if(callback)
				callback();
				
			console.log("$model completed");
		});
		
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
	
	window.$model = $model;
	
})();
