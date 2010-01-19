Type.registerNamespace("ExoWeb.Mock");

(function() {

	function execute() {

		var undefined;
		var intrinsics = ["String", "Number", "Date", "Boolean"];

		function Mock() {
			this._types = null;
			this._objects = null;
			
			this.objectProviderDelay = 0;
			this.typeProviderDelay = 0;
			this.listProviderDelay = 0;
			this.roundtripProviderDelay = 0;
			this.saveProviderDelay = 0;
			this.roundtripHandler = null;
			this.saveHandler = null;

			this.simulateLazyLoading = false;
		}

		Mock.mixin({
			types: function types(def) {
				this._initTypes();

				for (var typeName in def) {
					this._types[typeName] = def[typeName];
				}
			},
			objects: function objects(def) {
				this._initObjects();

				for (var typeName in def) {
					var objDefs = def[typeName];

					var objects = this._objects[typeName];

					if (!objects) {
						this._objects[typeName] = objDefs;
					}
					else {
						for (var id in objDefs) {
							this._objects[id] = objDefs[id];
						}
					}
				}
			},
			roundtrip: function roundtrip(handler) {
				this._initObjects();

				this.roundtripHandler = handler;
			},
			save: function save(handler) {
				this._initObjects();

				this.saveHandler = handler;
			},
			_initTypes: function() {
				if (!this._types) {
					this._types = {};

					var _this = this;

					ExoWeb.Mapper.setTypeProvider(function(type, callback) {
						var json = { types: {} };
						json.types[type] = _this._types[type];
						return mockCallback(callback, [json], _this.typeProviderDelay, $format(">> fetch: {0}", arguments));
					});
				}
			},
			_initObjects: function() {
				if (!this._objects) {
					this._objects = {};
					
					var _this = this;

					ExoWeb.Mapper.setObjectProvider(function(type, ids, includeAllowedValuesInPaths, includeTypes, paths, changes, callback) {
						var json;

						if (!_this.simulateLazyLoading) {
							json = { types: {}, instances: _this._objects, changes: {} };
						}
						else {
							json = { types: {}, instances: {}, changes: {} };
							paths = prepPaths(paths);
							for (var i = 0; i < ids.length; i++) {
								_this._query(type, ids[i], paths.instance, json.instances);
								_this._queryStatic(paths.static, json.instances);
							}
						}

						return mockCallback(callback, [json], _this.objectProviderDelay, $format(">> fetch: {0}({1})", arguments));
					});

					ExoWeb.Mapper.setListProvider(function(ownerType, ownerId, ownerProperty, callback) {
						var json = {};
						json[ownerType] = {};
						json[ownerType][ownerId] = {};

						// pass ids
						var refs = _this._objects[ownerType][ownerId][ownerProperty];
						json[ownerType][ownerId][ownerProperty] = refs;

						// include object data also
						var propType = window[ownerType].meta.property(ownerProperty).get_jstype().meta.get_fullName();

						for (var i = 0; i < refs.length; ++i)
							_this._appendObject(json, propType, refs[i]);

						return mockCallback(callback, [json], _this.listProviderDelay, $format(">> fetch: {0}({1}).{2}", arguments));
					});

					ExoWeb.Mapper.setRoundtripProvider(function(changes, success, failed) {
						var result = { changes: [] };

						if (_this.roundtripHandler && _this.roundtripHandler instanceof Function) {
							ExoWeb.trace.log("server", "begin: mock roundtripping changes to server");

							result.changes = _this.roundtripHandler(changes);

							ExoWeb.trace.log("server", "end: mock roundtripping changes to server");
						}
						else {
							ExoWeb.trace.log("server", "no roundtrip mocking");
						}

						return mockCallback(success, [result], _this.roundtripProviderDelay, $format(">> roundtrip", arguments));
					});
					
					ExoWeb.Mapper.setSaveProvider(function(root, changes, callback) {
						var result = { changes: [] };

						if (_this.saveHandler && _this.saveHandler instanceof Function) {
							ExoWeb.trace.log("server", "begin: mock saving changes to server");

							result.changes = _this.saveHandler(changes);

							ExoWeb.trace.log("server", "end: mock saving changes to server");
						}
						else {
							ExoWeb.trace.log("server", "no save mocking");
						}

						return mockCallback(callback, [result], _this.saveProviderDelay, $format(">> save", arguments));
					});
				}
			},
			_appendObject: function _appendObject(json, type, ref) {
				var t = ref.type ? finalType(ref.type) : type;

				if (!json[t])
					json[t] = {};

				json[t][ref.id] = this._objects[t][ref.id];
			},
			_queryStatic: function _queryStatic(paths, result) {
				for (var i = 0; i < paths.length; ++i) {
					var type = Array.dequeue(paths[i]);

					this._query(type, "static", paths[i], result);
				}
			},
			_query: function _query(type, id, paths, result, depth) {
				if (depth == undefined)
					depth = 0;

				var source = this._objects[type][id];

				if (!source) {
					// object might be instance of a sub type
					var subTypes = this._subTypes(type);

					for (var i = 0; i < subTypes.length; ++i) {
						subType = subTypes[i];
						source = this._objects[subType][id];

						if (source) {
							type = subType;
							break;
						}
					}
				}

				if (!source)
					ExoWeb.trace.throwAndLog(["mocks"], "Object not found: {0}({1})", [type, id]);

				if (!result[type])
					result[type] = {};

				if (!result[type][id])
					result[type][id] = {};

				for (var propName in source) {
					var val = source[propName];

					var prop = this._getProperty(type, propName);
					var propType = prop.type.split(">")[0];

					if (!Array.contains(intrinsics, propType)) {
						var inPath = false;

						for (var i = 0; i < paths.length; ++i) {
							if (paths[i].length > depth && paths[i][depth] === propName) {
								inPath = true;
								break;
							}
						}

						if (inPath) {
							// include object(s) referenced by id
							if (!prop.isList)
								this._query(propType, val.id, paths, result, depth + 1);
							else {
								Array.forEach(val, function(ref) {
									this._query(propType, ref.id, paths, result, depth + 1);
								}, this);
							}
						}
						else if (!inPath && prop.isList) {
							val = "deferred";
						}
					}

					result[type][id][propName] = val;
				}
			},
			_subTypes: function _subTypes(type, result) {
				result = result || [];


				// locate all types that derive from this one
				for (var subName in this._types) {
					var sub = this._types[subName];

					if (finalType(sub.baseType) === type) {
						result.push(subName);
						this._subTypes(subName);
					}
				}

				return result;
			},
			_getProperty: function _getProperty(containingType, name) {
				for (var type = this._types[containingType]; type != null; type = (type.baseType ? this._types[finalType(type.baseType)] : null)) {
					if (type.properties[name])
						return type.properties[name];
				}
				return null;
			}
		});

		function finalType(typeString) {
			if (!typeString)
				return typeString;

			var delim = typeString.indexOf(">");
			return delim < 0 ? typeString : typeString.substr(0, delim);
		}

		function prepPaths(path) {
			var ret = { instance: [], static: [] };

			if (path) {
				Array.forEach(path, function(p) {
					var parts = p.split(".");

					if (parts[0] === "this") {
						Array.dequeue(parts);
						ret.instance.push(parts);
					}
					else
						ret.static.push(parts);
				});
			}

			return ret;
		}

		function mockCallback(callback, args, delay, log) {
			ExoWeb.trace.log("mocks", log);

			if (delay) {
				window.setTimeout(function() {
					ExoWeb.trace.log("mocks", "   [done +{1}ms] {0}", [log, delay]);

					callback.apply(this, args);
				}, delay);
				
				return;
			}

			ExoWeb.trace.log("mocks", log + " (END MOCK)");

			callback.apply(this, args);
		}

		// Singleton
		ExoWeb.Mock = new Mock();
	}

	if (window.Sys && Sys.loader) {
		Sys.loader.registerScript("ExoWebMock", null, execute);
	}
	else {
		execute();
	}

})();
