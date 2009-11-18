Type.registerNamespace("ExoWeb.Mapper");

(function() {

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
	function CallbackSet() {
		this._waitForAll = [];
		this._pending = 0;
		var _this = this;
		this._oneDoneFn = function() { CallbackSet.prototype.oneDone.apply(_this, arguments); };
	}
	
	CallbackSet.mixin({
		pending: function(callback) {
			this._pending++;
			console.log($format("(+) {_pending}", this));

			if(callback) {
				var _oneDoneFn = this._oneDoneFn;
				return function() {
					callback.apply(this, arguments);
					_oneDoneFn();
				}
			}
			else
				return this._oneDoneFn;
		},
		waitForAll: function(callback) {
			if(!callback)
				return;
			
			if(this._pending == 0) {
				callback();
			} else
				this._waitForAll.push(callback);
		},
		oneDone: function() {
			console.log($format("(-) {0}", [this._pending - 1]));
			
			if(--this._pending == 0) {
				while(this._waitForAll.length > 0)
					Array.dequeue(this._waitForAll)();
			}
		}
	});


	///////////////////////////////////////////////////////////////////////////
	function $loadData(data){
		// Note: load object depends on local "data" variable to access data for related objects
		var loadObject = function(obj, type, id, depth) {
			obj._loaded = true;

			// don't hang the browser
			if (depth > loadObject.MAX_DEPTH)
				throw ($format("Maximum recursion depth of {depth} was exceeded.", { depth: loadObject.MAX_DEPTH }));

			var objectData = data[type][id];

			for (var propName in objectData) {
				var prop = obj.meta.property(propName).lastProperty();
				var propType = prop.get_fullTypeName();

				if (typeof (objectData[prop]) == "undefined" || objectData[propName] == null) {
					prop.init(obj, null);
				}
				else {
					var ctor = prop.get_dataType();

					if (ctor.meta) {
						if (prop.get_isList()) {
							var src = objectData[propName];
							var dst = [];
							for (var i = 0; i < src.length; i++) {
								var child = dst[dst.length] = new ctor(src[i]);
								if (!child._loaded)
									loadObject(child, prop.get_typeName(), src[i], depth + 1);
							}
							prop.init(obj, dst);
						}
						else {
							var related = new ctor(objectData[propName]);
							prop.init(obj, related);
							if (!related._loaded)
								loadObject(related, prop.get_typeName(), objectData[propName], depth + 1);
						}
					}
					else {
						var format = prop.get_format();
						prop.init(obj, format ? format.convertBack(objectData[propName]) : objectData[propName]);
					}
				}
			}

			return obj;
		}

		loadObject.MAX_DEPTH = 10;

		for (var type in data) {
			var ctor = window[type];
			for (var id in data[type]) {
				var obj = new ctor(id);
				if (!obj._loaded)
					loadObject(obj, type, id, 0);
			}
		}
	}


	///////////////////////////////////////////////////////////////////////////////
	
	function fetchType(model, typeName, callback) {
		// TODO: integrate with web service
		var requested = fetchType.requested[typeName];
		
		if(!requested) {
			requested = fetchType.requested[typeName] = new CallbackSet();
			var signalOthers = requested.pending();

			ExoWeb.GetType(typeName, function(typeJson) {
				var jstype = model.addType(typeName, null, typeJson.properties).get_jstype();

				callback(jstype);
				signalOthers();
				
				delete fetchType.requested[typeName];
			});
		}
		else {
			console.log("fetchType " + typeName + " WAIT");
			requested.waitForAll(function() {
				console.log("fetchType " + typeName + " WAIT CALLBACK");
				callback(resolveType(typeName))
			});
		}
	}
	fetchType.requested = {};
	
	function resolveType(typeName) {
		return window[typeName];
	}

	function resolvePaths(model, jstype, props, callback) {
		var propName = Array.dequeue(props);
		var prop = jstype.meta.property(propName);
		
		if(!prop)
			throw $format("{type}.{property} doesn't exist", {type: jstype.meta.get_fullName(), property: propName});
		
		if(!resolveType(prop.get_fullTypeName())) {
			fetchType(model, prop.get_fullTypeName(), function(resolved) {
				console.log($format("resolvePaths {0}.{1} callback", [jstype.meta.get_fullName(), props]));
				
				if(props.length > 0)
					resolvePaths(model, resolved, props, callback);
				else if(callback)
					callback();
			
			});
		}
		else
			callback();

		console.log($format("resolvePaths {0}.{1} RETURN", [jstype.meta.get_fullName(), props]));
	}
	
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
				callback(window.data.drivers.__metadata[type]);
			}, 1000);
		}
	}
	
	function fetchTypes(model, query, callback) {
		var signal = new CallbackSet();
		
		function processPaths(jstype) { 
			console.log("processPaths " + jstype.meta.get_fullName());
			if(query.and) {
				Array.forEach(query.and, function(path) {
					resolvePaths(model, jstype, path.split("."), signal.pending());
				});
			}
		}
		
		var rootType = resolveType(query.from);
		if(!rootType)
			fetchType(model, query.from, signal.pending(processPaths));
		else
			processPaths(rootType);
			
		signal.waitForAll(callback);
	}
	
	///////////////////////////////////////////////////////////////////////////////
	// Globals
	function $model(options, callback) {
		var model = new ExoWeb.Model.Model();
		
		var allSignals = new CallbackSet();
		
		var state = {};
		
		// start loading the instances first, then load type data concurrently.
		// this assumes that instances are slower to load than types due to caching
		for(varName in options) {
			state[varName] = { signal: new CallbackSet() };
			allSignals.pending();
			
			(function(varName) {
				var query = options[varName];
				ExoWeb.GetInstance(query.from, query.id, query.and, state[varName].signal.pending(function(objectJson) {
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
					
					$loadData(state[varName].objectJson);
					
					var query = options[varName];
					var jstype = model.get_type(query.from).get_jstype();
					
					window[varName] = new jstype(query.id);
					
					allSignals.oneDone();
				})
			})(varName);
		}
		
		allSignals.waitForAll(function() {
			//finish up
			
			if(callback)
				callback();
		});
		
	}
	window.$model = $model;
	
	function $load(metadata, data) {
		var model = null;

		if (metadata) {
			model = new ExoWeb.Model.Model();

			function createWireFormat(jstype) {
				jstype.formats.$wire = new ExoWeb.Model.Format({
					convert: function(val) { return val.meta.id; },
					convertBack: function(str) { return jstype.meta.get(str); }
				});
			}

			for (var type in metadata) {
				var jstype = model.addType(type, null, metadata[type].properties).get_jstype();
				createWireFormat(jstype, type);
			}
		}

		if (data) {
			$loadData(data);
		}

		return model;
	}
	window.$load = $load;
})();
