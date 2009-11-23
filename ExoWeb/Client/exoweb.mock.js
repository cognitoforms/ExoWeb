Type.registerNamespace("ExoWeb.Mock");

(function() {
	var undefined;
	var intrinsics = ["String", "Number", "Date", "Boolean"];

	function Mock() {
		this._types = null;
		this._objects = null;
		this._objectProviderMods = null;
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
		_initTypes: function() {
			if (!this._types) {
				this._types = {};
				this._typeProviderMods = [];

				var _this = this;

				ExoWeb.Mapper.setTypeProvider(function(type, callback) {
					var json = _this._types[type];
					return mockCallback(callback, [json], _this._typeProviderMods, $format("fetching {0} type", arguments));
				});
			}
		},
		_initObjects: function() {
			if (!this._objects) {
				this._objects = {};
				this._objectProviderMods = [];
				this._listProviderMods = [];

				var _this = this;

				ExoWeb.Mapper.setObjectProvider(function(type, id, paths, callback) {
					var json = {};
					_this._query(type, id, pathStrsToArrays(paths), json);

					return mockCallback(callback, [json], _this._objectProviderMods, $format("fetching {0}({1})", arguments));
				});

				ExoWeb.Mapper.setListProvider(function(ownerType, ownerId, ownerProperty, callback) {
					var json = {};
					json[ownerType] = {};
					json[ownerType][ownerId] = {};

					// pass ids
					var ids = _this._objects[ownerType][ownerId][ownerProperty];
					json[ownerType][ownerId][ownerProperty] = ids;

					// include object data also
					var propType = window[ownerType].meta.property(ownerProperty).get_fullTypeName();

					for (var i = 0; i < ids.length; ++i) {
						var id = ids[i].split("|");

						if (id.length > 1)
							_this._appendObject(json, id[0], id[1]);
						else
							_this._appendObject(json, propType, id[0]);
					}

					return mockCallback(callback, [json], _this._listProviderMods, $format("fetching {0}({1}).{2})", arguments));
				});
			}
		},
		_appendObject: function _appendObject(json, type, id) {
			if (!json[type])
				json[type] = {};
				
			json[type][id] = this._objects[type][id];
		},
		_query: function _query(type, id, paths, result, depth) {
			if (depth == undefined)
				depth = 0;

			if (!result[type])
				result[type] = {};

			if (!result[type][id])
				result[type][id] = {};

			var source = this._objects[type][id];

			for (var propName in source) {
				var val = source[propName];

				var prop = this._types[type].properties[propName];

				if (!Array.contains(intrinsics, prop.type)) {
					var inPath = false;

					for (var i = 0; i < paths.length; ++i) {
						if (paths[i].length > depth && paths[i][depth] === propName) {
							inPath = true;
							break;
						}
					}

					if (inPath && !prop.isList) {
						// include object referenced by id
						this._query(prop.type, id, paths, result, depth + 1);
					}
					else if (!inPath && prop.isList) {
						val = "deferred";
					}
				}

				result[type][id][propName] = val;
			}
		}
	});

	function pathStrsToArrays(path) {
		var ret = [];

		if (path) {
			Array.forEach(path, function(p) {
				ret.push(p.split("."));
			});
		}

		return ret;
	}



	function mockCallback(callback, args, mods, log) {
		if (log && console)
			console.log(log + " (START MOCK)");

		var mod;

		for (var i = 0; i < mods.length; ++i) {
			mod = mods[i];
			if (!mod.when || mod.when.apply(this, arguments)) {
				if (mod.delay) {
					window.setTimeout(function() {
						if (log && console)
							console.log(log + " (END MOCK)");

						callback.apply(this, mod.args ? mod.args(args) : args);
					}, mod.delay);

					return;
				}
				break;
			}
		}

		if (log && console)
			console.log(log + " (END MOCK)");

		callback.apply(this, (mod && mod.args) ? mod.args(args) : args);
	}

	// Singleton
	ExoWeb.Mock = new Mock();

})();
