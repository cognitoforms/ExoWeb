﻿Type.registerNamespace("ExoWeb.Mock");

(function() {
	var undefined;
	var intrinsics = ["String", "Number", "Date", "Boolean"];

	function Mock() {
		this._types = null;
		this._objects = null;
		this._objectProviderMods = null;
		this._syncProviderMods = null;
		this._typeProviderMods = null;
		this._listProviderMods = null;
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
		sync: function rules(def) {
			this._initObjects();

			for (var i = 0; i < def.length; i++)
				this._syncRules.push(def[i]);
		},
		typeProvider: function typeProvider(mod) {
			this._initTypes();
			Array.enqueue(this._typeProviderMods, mod);
		},
		objectProvider: function objectProvider(mod) {
			this._initObjects();
			Array.enqueue(this._objectProviderMods, mod);
		},
		listProvider: function listProvider(mod) {
			this._initObjects();
			Array.enqueue(this._listProviderMods, mod);
		},
		syncProvider: function syncProvider(mod) {
			this._initObjects();
			Array.enqueue(this._syncProviderMods, mod);
		},
		_initTypes: function() {
			if (!this._types) {
				this._types = {};
				this._typeProviderMods = [];

				var _this = this;

				ExoWeb.Mapper.setTypeProvider(function(type, callback) {
					var json = {};
					json[type] = _this._types[type];
					return mockCallback(callback, [json], _this._typeProviderMods, $format(">> fetch: {0}", arguments));
				});
			}
		},
		_initObjects: function() {
			if (!this._objects) {
				this._objects = {};
				this._syncRules = [];
				this._objectProviderMods = [];
				this._listProviderMods = [];
				this._syncProviderMods = [];

				var _this = this;

				ExoWeb.Mapper.setObjectProvider(function(type, id, includeAllowedValuesInPaths, paths, callback) {
					var json = {};
					_this._query(type, id, pathStrsToArrays(paths), json);

					return mockCallback(callback, [json], _this._objectProviderMods, $format(">> fetch: {0}({1})", arguments));
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

					return mockCallback(callback, [json], _this._listProviderMods, $format(">> fetch: {0}({1}).{2}", arguments));
				});

				ExoWeb.Mapper.setSyncProvider(function(type, id, paths, changes, callback) {
					var result = [];

					ExoWeb.trace.log("sync", "begin: mock sending changes to server");

					// grabbed from http://oranlooney.com/functional-javascript/
					function copy(obj) {
						if (typeof obj !== 'object') {
							return obj;  // non-object have value sematics, so obj is already a copy.
						} else {
							var value = obj.valueOf();
							if (obj != value) {
								// the object is a standard object wrapper for a native type, say String.
								// we can make a copy by instantiating a new object around the value.
								return new obj.constructor(value);
							} else {
								// ok, we have a normal object. copy the whole thing, property-by-property.
								var c = {};
								for (var property in obj) c[property] = obj[property];
								return c;
							}
						}
					}

					for (var i = 0, len = changes.length; i < len; i++) {
						var change = changes[i];
						for (var j = 0; j < _this._syncRules.length; j++) {
							var rule = _this._syncRules[j];

							var match = true;
							// make sure each criteria matches
							for (var varName in rule.Criteria) {
								// get the corresponding value of the change
								var changeValue = copy(change);
								var path = varName.split(".").reverse();
								while (path.length)
									changeValue = changeValue[path.pop()];

								// check to see if the criteria value matches the change value
								if (changeValue != rule.Criteria[varName]) {
									match = false;
									break;
								}
							}

							if (match) {
								var newChange = copy(change);

								for (var varName in rule.Result) {
									var val = newChange;
									var path = varName.split(".").reverse();
									while (path.length > 1)
										val = val[path.pop()];
									val[path.pop()] = rule.Result[varName];
								}

								result.push(newChange);
							}
						}
					}

					ExoWeb.trace.log("sync", "end: mock sending changes to server");

					return mockCallback(callback, [result], _this._syncProviderMods, $format(">> sync: {0}({1})", arguments));
				});
			}
		},
		_appendObject: function _appendObject(json, type, ref) {
			var t = ref.type ? finalType(ref.type) : type;

			if (!json[t])
				json[t] = {};

			json[t][ref.id] = this._objects[t][ref.id];
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
				throw $format("Object not found: {0}({1})", [type, id]);

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

	function pathStrsToArrays(path) {
		var ret = [];

		if (path) {
			Array.forEach(path, function(p) {
				var parts = p.split(".");

				if (parts[0] === "this") {
					Array.dequeue(parts);
					ret.push(parts);
				}
			});
		}

		return ret;
	}

	function mockCallback(callback, args, mods, log) {
		ExoWeb.trace.log("mocks", log);

		var mod;

		for (var i = 0; i < mods.length; ++i) {
			mod = mods[i];
			if (!mod.when || mod.when.apply(this, arguments)) {
				if (mod.delay) {
					window.setTimeout(function() {
						ExoWeb.trace.log("mocks", "   [done +{1}ms] {0}", [log, mod.delay]);

						callback.apply(this, mod.args ? mod.args(args) : args);
					}, mod.delay);

					return;
				}
				break;
			}
		}

		ExoWeb.trace.log("mocks", log + " (END MOCK)");

		callback.apply(this, (mod && mod.args) ? mod.args(args) : args);
	}

	// Singleton
	ExoWeb.Mock = new Mock();

})();
