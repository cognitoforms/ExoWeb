Type.registerNamespace("ExoWeb.Mapper");

if (!ExoWeb.GetInstance){
	ExoWeb.GetInstance = function(type, id, paths, callback){
		console.log($format("stubbed fetching of data for type {0} with id {1} and paths {2}", [type, id, paths]));
		
		window.setTimeout(function() {
			//console.log("ExoWeb.GetInstance CALLBACK");
			callback(window.data.drivers.__data);	
		}, 2000);
	}
}

if (!ExoWeb.GetType){
	ExoWeb.GetType = function(type, callback){
		console.log($format("stubbed fetching of metadata for type {0}", [type]));
		
		window.setTimeout(function() {
			//console.log("fetchType " + typeName + " DONE");
			var stub = {};
			stub[type] = window.data.drivers.__metadata[type];
			callback(stub);
		}, 1000);
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
			
			if(this.enableConsole && console && console.log) {
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

	///////////////////////////////////////////////////////////////////////////////
	function CallbackSet(debugLabel) {
		this._waitForAll = [];
		this._pending = 0;
		var _this = this;
		this._oneDoneFn = function() { CallbackSet.prototype.oneDone.apply(_this, arguments); };
		//this._debugLabel = debugLabel;
	}
	
	CallbackSet.mixin({
		pending: function(callback) {
			this._pending++;
			if(console && this._debugLabel) console.log($format("{_debugLabel} (+) {_pending}", this));

			if (callback) {
				var _oneDoneFn = this._oneDoneFn;
				return function() {
					callback.apply(this, arguments);
					_oneDoneFn.apply(this, arguments);
				}
			}
			else
				return this._oneDoneFn;
		},
		waitForAll: function(callback) {
			if (!callback)
				return;

			if (this._pending == 0) {
				callback();
			} else
				this._waitForAll.push(callback);
		},
		oneDone: function() {
			if(console && this._debugLabel) console.log($format("{1} (-) {0}", [this._pending - 1, this._debugLabel]));
			
			if (--this._pending == 0) {
				while (this._waitForAll.length > 0)
					Array.dequeue(this._waitForAll).apply(this, arguments);
			}
		}
	});


	///////////////////////////////////////////////////////////////////////////
	function loadData(data){
		console.log("loading data");
		
		try {
			var getType = function(type, id){
				if (id.indexOf("|") > 0)
					return id.substring(0, id.indexOf("|"));
				else
					return type;
			}
		
			// Note: load object depends on local "data" variable to access data for related objects
			var loadObject = function(obj, type, id) {
				console.log("load", [type, id]);
									
				// locate the object in the data
				var typeData = data[type];

				if (!data[type]) {
					ObjectLazyLoader.register(obj);
					return;
				}

				var objectData = typeData[id];

				if (!objectData) {
					ObjectLazyLoader.register(obj);
					return;
				}
								
				// Load properties
				for (var propName in objectData) {
					var prop = obj.meta.property(propName);
					var propData = objectData[propName];
					
					console.log("    ." + propName, [propData]);

					if (!prop) {
						console.log($format("ERROR: unknown property {0}.{1}", [type, propName]));
						continue;
					}
					else {
						prop = prop.lastProperty();
					}

					var propType = prop.get_fullTypeName();
					
					if(propData === null) {
						prop.init(obj, null, false);
					}
					else if (prop.get_isList()) {
						var list;
						
						if (propData == "deferred") {
							list = ListLazyLoader.register(obj, prop);
							console.log("       deferred");
						}
						else {
							list = [];
							
							for (var i = 0; i < propData.length; i++) {
								var childId = propData[i];
								var childType = getType(propType, childId);
								var childCtor = resolveType(childType);
								var child = childCtor.meta.get(childId);
								
								if(!child) {
									child = new childCtor(childId);
									ObjectLazyLoader.register(child);
								}
																
								list.push(child);
							}									
						}
						
						// TODO: is it ok that child list is assigned after while child value is assigned before?
						prop.init(obj, list, false);
					}
					else {
						var ctor = prop.get_dataType(true);
						
						if (!ctor) 
							throw "Unknown type: " + prop.get_fullTypeName();
							
						if(ctor.meta) {
							var childType = getType(propType, propData);
							var childCtor = resolveType(childType);
							var child = childCtor.meta.get(propData);
							
							if(!child) {
								child = new childCtor(propData);
								ObjectLazyLoader.register(child);
							}
							
							prop.init(obj, child, false);
						}
						else {
							var format = ctor.formats.$wire;
							prop.init(obj, (format ? format.convertBack(propData) : propData), false);
						}
					}
				}
				
				// Object has been loaded
				ExoWeb.Model.LazyLoader.unregister(obj);

				return obj;
			}
	
			for (var typeVar in data) {
				for (var id in data[typeVar]) {
					// should be one and the same but use id type for consistency
					var type = getType(typeVar, id);
					var ctor = resolveType(type);
					if (!ctor) {
						// TODO: handle types that are not defined
						console.log($format("type \"{0}\" is not defined", [type]));
						continue;
					}

					var obj = new ctor(id);					
					loadObject(obj, type, id);
				}
			}
		}
		catch (e) {
			console.log("ERROR: " + e);
		}
	}


	///////////////////////////////////////////////////////////////////////////////
	function fetchDerivedTypes(model, typeName, derivedTypes, callback){
		if (derivedTypes && derivedTypes instanceof Array && derivedTypes.length > 0){
			var derivedSignals = new CallbackSet("fetchDerivedTypes");
			Array.forEach(derivedTypes, function(derivedType){
				console.log($format("{0} requires derived type {1}.", [typeName, derivedType]));
				if(!resolveType(derivedType))
					fetchType(model, derivedType, derivedSignals.pending());
			});
			derivedSignals.waitForAll(function(){
				console.log($format("{0} finished loading derived types.", [typeName]));
				callback();
			});
		}
		else {
			console.log($format("{0} no derived types required.", [typeName]));
			callback();
		}
	}
	
	function fetchBaseType(model, typeName, baseTypeName, callback){
		if (baseTypeName && !resolveType(baseTypeName)) {
			var baseSignal = new CallbackSet("fetchBaseType");
			console.log($format("{0} requires base type {1}.", [typeName, baseTypeName]));
			fetchType(model, baseTypeName, baseSignal.pending());
			baseSignal.waitForAll(function(){
				console.log($format("{0} got response that base type {1} is loaded.", [typeName, baseTypeName]));
				callback();
			});
		}
		else {
			console.log($format("{0} does not require a base type.", [typeName]));
			callback();
		}
	}

	function fetchType(model, typeName, callback) {
		// TODO: integrate with web service
		var requested = fetchType.requested[typeName];
		
		if(!requested) {
			requested = fetchType.requested[typeName] = new CallbackSet("fetchType(" + typeName + ")");
			var signalOthers = requested.pending();

			console.log($format("{0} has not been requested before.  fetching now.", [typeName]));
			typeProvider(typeName, function(typeJson) {
				if(console) console.log($format("{0} response recieved from web service", [typeName]));
				
				var _typeName = typeName;
				var _typeJson = typeJson;
				var load = function(){
					return model.addType(_typeName, _typeJson.baseType, _typeJson.derivedTypes, _typeJson.properties).get_jstype();
				}
				
				fetchBaseType(model, typeName, typeJson.baseType, function(){
					if (typeJson.baseType)
						console.log($format("{0} can be loaded now that base type {1} is present", [typeName, typeJson.baseType]));
					else
						console.log($format("{0} can be loaded since it doesn't require a base type", [typeName]));
					
					var jstype = load();
					signalOthers();
					delete fetchType.requested[typeName];
					callback(jstype);
				});
			});
		}
		else {
			console.log($format("{0} has been requested.  waiting.", [typeName]));
			requested.waitForAll(function() {
				console.log($format("{0} has been fetched.  done waiting.", [typeName]));
				callback(resolveType(typeName))
			});
		}
	}
	fetchType.requested = {};
	
	function resolveType(typeName) {
		return window[typeName];
	}

	function resolvePaths(model, jstype, props, callback) {
		try{
			var propName = Array.dequeue(props);
			var prop = jstype.meta.property(propName);
			
			if(!prop)
				throw $format("{type}.{property} doesn't exist", {type: jstype.meta.get_fullName(), property: propName});
			
			if(!resolveType(prop.get_fullTypeName())) {
				fetchType(model, prop.get_fullTypeName(), function(resolved) {
					//console.log($format("resolvePaths {0}.{1} callback", [jstype.meta.get_fullName(), props]));
					
					// TODO: fetch derived types
					fetchDerivedTypes(model, resolved.meta.get_fullName(), resolved.meta._derivedTypes, function(){
						console.log($format("{0} can resolve paths now that derived types are loaded.", [resolved.meta.get_fullName()]));
					
						if (props.length > 0)
							resolvePaths(model, resolved, props, callback);
						else if(callback)
							callback();
					});
				});
			}
			else
				callback();
	
			//console.log($format("resolvePaths {0}.{1} RETURN", [jstype.meta.get_fullName(), props]));
		}
		catch (e) {
			if(console) console.log("ERROR: " + e);
		}
	}

	function fetchTypes(model, query, callback) {
		var signal = new CallbackSet("fetchTypes");
		
		function processPaths(jstype) {
			fetchDerivedTypes(model, query.from, jstype.meta._derivedTypes, function(){
				//console.log("processPaths " + jstype.meta.get_fullName());
				console.log($format("{0} can process paths now that derived types are loaded.", [query.from]));
				if(query.and) {
					Array.forEach(query.and, function(path) {
						resolvePaths(model, jstype, path.split("."), signal.pending());
					});
				}
			});
		}
		
		var rootType = resolveType(query.from);
		if(!rootType)
			fetchType(model, query.from, signal.pending(processPaths));
		else
			processPaths(rootType);
			
		signal.waitForAll(callback);
	}

	///////////////////////////////////////////////////////////////////////////////
	// Object Loader
	function ObjectLazyLoader() {
	}
	
	ObjectLazyLoader.mixin({
		load: function(obj, propName, callback) {	
			if(console) console.log("LOADING: " + obj.meta.id);
			
			objectProvider(obj.meta.type.get_fullName(), obj.meta.id, [], function(objectJson) {
				// TODO: queue up multiple callers
				
				LazyLoader.unregister(obj);
				loadData(objectJson);
				callback();
			});				
		}
	});
	
	(function() {
		var instance = new ObjectLazyLoader();
		
		ObjectLazyLoader.register = function(obj) {
			ExoWeb.Model.LazyLoader.register(obj, instance);		
		}
	})();
	
	
	///////////////////////////////////////////////////////////////////////////////
	// List Loader
	function ListLazyLoader() {
	}
	
	ListLazyLoader.mixin({
		load: function(list, propName, callback) {	
			if(console) console.log("LOADING: list");
			
			var signal = new CallbackSet();
			
			var objectJson;
			
			listProvider(list._ownerType, list._ownerId, list._ownerProperty.get_name(), signal.pending(function(result) {
				objectJson = result;
			}));
			
			// TODO: load property type too??
			var propType = list._ownerProperty.get_fullTypeName();
			if(!resolveType(propType)) {
				fetchType(list._ownerProperty.get_containingType().get_model(), propType, signal.pending());
			}
			
			signal.waitForAll(function() {
				ExoWeb.Model.LazyLoader.unregister(list);				
				delete list._ownerId;
				delete list._ownerType;
				delete list._ownerProperty;

				loadData(objectJson);
								
				if(callback)
					callback();
			});
		}
	});
	
	(function() {
		var instance = new ListLazyLoader();
	
		ListLazyLoader.register = function(obj, prop) {
			var list = [];
			
			list._ownerId = obj.meta.id;
			list._ownerType = obj.meta.type.get_fullName();
			list._ownerProperty = prop;
			
			ExoWeb.Model.LazyLoader.register(list, instance);
			
			return list;
		}
	})();
	
	///////////////////////////////////////////////////////////////////////////////
	// Globals
	function $model(options, callback) {
		var model = new ExoWeb.Model.Model();
		
		var allSignals = new CallbackSet("$model allSignals");
		
		var state = {};
		
		var ret = {meta: model};
		
		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for(varName in options) {
			state[varName] = { signal: new CallbackSet("$model." + varName) };
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
					
					loadData(state[varName].objectJson);
					
					var query = options[varName];
					var type = model.get_type(query.from);
					
					ret[varName] = type.get(query.id);
					
					allSignals.oneDone();
				})
			})(varName);
		}
		
		allSignals.waitForAll(function() {			
			//finish up			
			if(callback)
				callback();
				
			if(console) console.log("$model completed");
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
