/// <reference path="../Model/Type.js" />
/// <reference path="../Model/ObjectMeta.js" />
/// <reference path="../Model/Entity.js" />
/// <reference path="../Model/Property.js" />
/// <reference path="../Model/PathToken.js" />
/// <reference path="../Model/ConditionTarget.js" />
/// <reference path="../Model/Condition.js" />

var STATIC_ID = "static";
var dateRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(\.\d{3})?Z$/g;
var dateRegexReplace = "$2/$3/$1 $4:$5:$6 GMT";
var hasTimeFormat = /[hHmts]/;

function ensureJsType(model, typeName, callback, thisPtr) {
	var mtype = model.type(typeName);

	if (!mtype) {
		fetchTypes(model, [typeName], function(jstypes) {
			callback.apply(thisPtr || this, jstypes);
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

function conditionsFromJson(model, conditionsJson, forInstances, callback, thisPtr) {

	for (var conditionCode in conditionsJson) {
		conditionFromJson(model, forInstances, conditionCode, conditionsJson[conditionCode]);
	}

	if (callback && callback instanceof Function) {
		callback.call(thisPtr || this);
	}
}

function conditionFromJson(model, forInstances, conditionCode, conditionsJson) {
	var conditionType = ExoWeb.Model.ConditionType.get(conditionCode);

	if (!conditionType) {
		ExoWeb.trace.logWarning(["server", "conditions"], "A condition type with code \"{0}\" could not be found.", [conditionCode]);
		return;
	}

	var serverSync = model.server;

	// process each condition
	if (forInstances) {
		conditionsJson.forEach(function (conditionJson) {
			var rootTarget = conditionJson.targets[0];
			if (rootTarget) {
				tryGetJsType(serverSync.model, rootTarget.instance.type, null, false, function (jstype) {
					tryGetEntity(serverSync.model, serverSync._translator, jstype, rootTarget.instance.id, null, LazyLoadEnum.None, function (rootTargetInstance) {
						if (forInstances.indexOf(rootTargetInstance) >= 0) {
							conditionTargetsFromJson(model, conditionType, conditionJson.message, conditionJson.targets);
						}
					});
				});
			}
		});
	}
	else {
		conditionsJson.forEach(function (conditionJson) {
			conditionTargetsFromJson(model, conditionType, conditionJson.message, conditionJson.targets);
		});
	}
}

function conditionTargetsFromJson(model, conditionType, message, targetsJson) {
	var condition = new Condition(conditionType, message, null, null, "server");

	var serverSync = model.server;

	// process each condition target
	targetsJson.forEach(function (target) {
		tryGetJsType(serverSync.model, target.instance.type, null, false, function (jstype) {
			tryGetEntity(serverSync.model, serverSync._translator, jstype, target.instance.id, null, LazyLoadEnum.None, function (instance) {
				condition.targets.push(new ConditionTarget(condition, instance, target.properties.map(function (p) { return jstype.meta.property(p); })));
			});
		});
	});
}

function objectsFromJson(model, json, callback, thisPtr) {
	var signal = new ExoWeb.Signal("objectsFromJson");
	var objectsLoaded = [];
	for (var typeName in json) {
		var poolJson = json[typeName];
		for (var id in poolJson) {
			// locate the object's state in the json
			objectFromJson(model, typeName, id, poolJson[id], signal.pending(function (obj) {
				if (obj) {
					objectsLoaded.push(obj);
				}
			}), thisPtr);
		}
	}

	signal.waitForAll(function() {
		callback.call(thisPtr || this, objectsLoaded);
	});
}

function objectFromJson(model, typeName, id, json, callback, thisPtr) {
	// get the object to load
	var obj;

	// family-qualified type name is not available so can't use getType()
	var mtype = model.type(typeName);

	// if this type has never been seen, go and fetch it and resume later
	if (!mtype) {
		fetchTypes(model, [typeName], function() {
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

	var loadedObj;

	///initialize the object if it was ghosted
	if (id === STATIC_ID || (obj && obj.wasGhosted) || !LazyLoader.isLoaded(obj)) {
		if (obj) {
			delete obj.wasGhosted;
		}

		var loadedProperties = [];

		// Load object's properties
		for (var t = mtype; t !== null; t = t.baseType) {
			var props = obj ? t.get_instanceProperties() : t.get_staticProperties();

			for (var propName in props) {
				if (loadedProperties.contains(propName))
					continue;

				loadedProperties.push(propName);

				var prop = props[propName];

	//					ExoWeb.trace.log("propInit", "{0}({1}).{2} = {3}", [typeName, id, propName, propData]);

				if (!prop) {
					ExoWeb.trace.throwAndLog(["objectInit"], "Cannot load object {0}({2}) because it has an unexpected property '{1}'", [typeName, propName, id]);
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
					Property$_init.call(prop, obj, null);
				}
				else {
					var propType = prop.get_jstype();

					 if (prop.get_isList()) {
					 	var list = prop.get_isStatic() ? prop.value() : obj[prop._fieldName];

						if (propData == "?") {
							// don't overwrite list if its already a ghost
							if (!list) {
								list = ListLazyLoader.register(obj, prop);
								Property$_init.call(prop, obj, list, false);
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
									Property$_init.call(prop, obj, list);
								}
							}
						}
					}
					else {
						var ctor = prop.get_jstype(true);

						// assume if ctor is not found its a model type not an intrinsic
						if (!ctor || ctor.meta) {
							Property$_init.call(prop, obj, getObject(model, propType, (propData && propData.id || propData), (propData && propData.type || propType)));
						}
						else {
							// Coerce strings into dates
							if (ctor == Date && propData && propData.constructor == String && propData.length > 0) {

								// Convert from string (e.g.: "2011-07-28T06:00:00.000Z") to date.
								dateRegex.lastIndex = 0;
								propData = new Date(propData.replace(dateRegex, dateRegexReplace));

								//now that we have the value set for the date.
								//if the underlying property datatype is actually a date and not a datetime
								//then we need to add the local timezone offset to make sure that the date is displayed acurately.
								if (prop.get_format() && !hasTimeFormat.test(prop.get_format().toString())) {
									var serverOffset = model.server.get_ServerTimezoneOffset();
									var localOffset = -(new Date().getTimezoneOffset() / 60);
									propData = propData.addHours(serverOffset - localOffset);
								}
							}
							else if (ctor === TimeSpan) {
								propData = new TimeSpan(propData.TotalMilliseconds);
							}
							Property$_init.call(prop, obj, propData);
						}
					}
				}
			}
		}

		if (obj) {
			// track the newly loaded instance to pass to the caller
			loadedObj = obj;

			// unregister the instance from loading
			ObjectLazyLoader.unregister(obj);
		}
	}

	if (callback && callback instanceof Function) {
		callback.call(thisPtr || this, loadedObj);
	}
}

function typesFromJson(model, json) {
	for (var typeName in json) {
		typeFromJson(model, typeName, json[typeName]);
	}
}

function typeFromJson(model, typeName, json) {
//			ExoWeb.trace.log("typeInit", "{1}   <.>", arguments);

	// get model type. it may have already been created for lazy loading
	var mtype = getType(model, typeName, json.baseType);

	// set the default type format
	if (json.format) {
		mtype.set_format(getFormat(mtype.get_jstype(), json.format));
	}

	if (mtype.get_originForNewProperties() === "client") {
		ExoWeb.trace.throwAndLog("typeInit", "type \"{0}\" has already been loaded", mtype._fullName);
	}

	// define properties
	for (var propName in json.properties) {
		var propJson = json.properties[propName];

		// Type
		var propType = propJson.type;
		if (propJson.type.endsWith("[]")) {
			propType = propType.toString().substring(0, propType.length - 2);
			propJson.isList = true;
		}
		propType = getJsType(model, propType);

		// Format
		var format = getFormat(propType, propJson.format);

		// Add the property
		var prop = mtype.addProperty({
			name: propName,
			type: propType,
			label: propJson.label,
			format: format,
			isList: propJson.isList === true,
			isStatic: propJson.isStatic === true,
			isPersisted: propJson.isPersisted !== false,
			isCalculated: propJson.isCalculated === true,
			index: propJson.index
		});

		// setup static properties for lazy loading
		if (propJson.isStatic && propJson.isList) {
			Property$_init.call(prop, null, ListLazyLoader.register(null, prop));
		}

		// process property specific rules, which have a specialized json syntax to improve readability and minimize type json size
		if (propJson.rules) {
			for (var rule in propJson.rules) {
				var options = propJson.rules[rule];
				
				// default the type to the rule name if not specified
				if (!options.type) {
					options.type = rule;

					// calculate the name of the rule if not specified in the json, assuming it will be unique
					if (!options.name) {
						options.name = mtype.get_fullName() + "." + prop.get_name() + "." + rule.substr(0, 1).toUpperCase() + rule.substr(1);
					}
				}

				// initialize the name of the rule if not specified in the json
				else if (!options.name) {
					options.name = rule;
				}

				options.property = prop;
				ruleFromJson(mtype, options);
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
		conditionTypesFromJson(model, mtype, json.conditionTypes);

	// define rules 
	if (json.rules) {
		for (var i = 0; i < json.rules.length; ++i) {
			ruleFromJson(mtype, json.rules[i]);
		}
	}

	// store exports
	if (json.exports) {
		mtype.set_exports(json.exports);
	}
}

function conditionTypesFromJson(model, mtype, json) {
	json.forEach(function (ctype) {
		conditionTypeFromJson(mtype, ctype);
	});
}

function conditionTypeFromJson(mtype, json) {

	// for rules that assert a single condition, the code will be the unique name of the rule
	json.code = json.code || json.name;

	// attempt to retrieve the condition type by code.
	var conditionType = ExoWeb.Model.ConditionType.get(json.code);

	// create the condition type if it does not already exist.
	if (!conditionType) {

		// get a list of condition type sets for this type.
		var sets = !json.sets ? [] : json.sets.map(function(name) {
			var set = ExoWeb.Model.ConditionTypeSet.get(name);
			if (!set) {
				set = new ExoWeb.Model.ConditionTypeSet(name);
			}
			return set;
		});

		// create the appropriate condition type based on the category.
		if (!json.category || json.category == "Error") {
			conditionType = new ExoWeb.Model.ConditionType.Error(json.code, json.message, sets, "server");
		}
		else if (json.category == "Warning") {
			conditionType = new ExoWeb.Model.ConditionType.Warning(json.code, json.message, sets, "server");
		}
		else if (json.category == "Permission") {
			conditionType = new ExoWeb.Model.ConditionType.Permission(json.code, json.message, sets, json.permissionType, json.isAllowed, "server");
		}
		else {
			conditionType = new ExoWeb.Model.ConditionType(json.code, json.category, json.message, sets, "server");
		}

		// account for the potential for subclasses to be serialized with additional properties.
		conditionType.extend(json);
	}

	if (json.rule && json.rule.hasOwnProperty("type")) {
		conditionType.rules.push(ruleFromJson(mtype, json.rule, conditionType));
	}

	return conditionType;
}

function ruleFromJson(mtype, options) {
	var ruleType = ExoWeb.Model.Rule[options.type];
	if (options.conditionType) {
		options.conditionType = conditionTypeFromJson(mtype, options.conditionType);
	}
	else if (ruleType.prototype instanceof ConditionRule) {
		options.conditionType = conditionTypeFromJson(mtype, options);
	}
	return new ruleType(mtype, options);
}

function getJsType(model, typeName, forLoading) {
	// Get an array representing the type family.
	var family = typeName.split(">");

	// Try to get the js type from the window object.
	var jstype = ExoWeb.Model.Model.getJsType(family[0], true);

	// If its not defined, assume the type is a model type
	// that may eventually be fetched.
	if (jstype === undefined) {
		jstype = getType(model, null, family).get_jstype();
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
				mtype = model.addType(type, baseType, "server");
				TypeLazyLoader.register(mtype);
			}
		}
	}

	return mtype;
}

function getObject(model, propType, id, finalType, forLoading) {
	if (id === STATIC_ID) {
		ExoWeb.trace.throwAndLog(["objectInit", "lazyLoad"], "getObject() can only be called for instances (id='{0}')", [id]);
	}

	// get model type
	var mtype = getType(model, finalType, propType);

	// Try to locate the instance by id.
	var obj = mtype.get(id,
		// If an exact type exists then it should be specified in the call to getObject.
		true);

	// If it doesn't exist, create a ghosted instance.
	if (!obj) {
		obj = new (mtype.get_jstype())(id);
		obj.wasGhosted = true;
		if (!forLoading) {
			// If the instance is not being loaded, then attach a lazy loader.
			ObjectLazyLoader.register(obj);
		}
	}

	return obj;
}

function onTypeLoaded(model, typeName) {
	var mtype = model.type(typeName);
	mtype.eachBaseType(function(mtype) {
		if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
			ExoWeb.trace.throwAndLog("typeLoad", "Base type " + mtype._fullName + " is not loaded.");
		}
	});
	TypeLazyLoader.unregister(mtype);
	raiseExtensions(mtype);
	return mtype;
}

///////////////////////////////////////////////////////////////////////////////
function fetchTypesImpl(model, typeNames, callback, thisPtr) {
	var signal = new ExoWeb.Signal("fetchTypes(" + typeNames.join(",") + ")");
	signal.pending();

	var typesPending = typeNames.copy(), typesLoaded = [];

	function typesFetched(success, types, otherTypes) {
		var baseTypesToFetch = [], loadedTypes = [], baseTypeDependencies = {}, loadableTypes = [];

		if (success) {
			typesFromJson(model, types);

			// Update types that have been loaded.  This needs to be persisted since
			// this function can recurse and arguments are not persisted.
			eachProp(types, function(prop) { typesLoaded.push(prop); });
			if (otherTypes) {
				eachProp(otherTypes, function(prop) { typesLoaded.push(prop); });
			}

			// Extract the types that can be loaded since they have no pending base types
			purge(typesPending, function(typeName) {
				var mtype, pendingBaseType = false;

				// In the absense of recursion this will be equivalent to enumerating
				// the properties of the "types" and "otherTypes" arguments.
				if (typesLoaded.contains(typeName)) {
					mtype = model.type(typeName);
					if (mtype) {
						if (LazyLoader.isLoaded(mtype)) {
							loadedTypes.push(mtype._fullName);
						}
						else {
							// find base types that are not loaded
							mtype.eachBaseType(function(baseType) {
								// Don't raise the loaded event until the base types are marked as loaded (or about to be marked as loaded in this pass)
								if (!LazyLoader.isLoaded(baseType)) {
									// Base type will be loaded in this pass
									if (typesLoaded.contains(baseType._fullName)) {
										if (baseTypeDependencies.hasOwnProperty(typeName)) {
											baseTypeDependencies[typeName].splice(0, 0, baseType._fullName);
										}
										else {
											baseTypeDependencies[typeName] = [baseType._fullName];
										}
									}
									else {
										pendingBaseType = true;
										if (!baseTypesToFetch.contains(baseType._fullName) && !typesPending.contains(baseType._fullName)) {
											baseTypesToFetch.push(baseType._fullName);
										}
									}
								}
							});

							if (!pendingBaseType) {
								loadableTypes.push(typeName);
								return true;
							}
						}
					}
				}
			});

			// Remove types that have already been marked as loaded
			loadedTypes.forEach(function(typeName) {
				typesPending.remove(typeName);
			});

			// Raise loaded event on types that can be marked as loaded
			while(loadableTypes.length > 0) {
				var typeName = loadableTypes.dequeue();
				if (baseTypeDependencies.hasOwnProperty(typeName)) {
					// Remove dependencies from array and map
					var deps = baseTypeDependencies[typeName];
					delete baseTypeDependencies[typeName];
					deps.forEach(function(t) {
						loadableTypes.remove(t);
						delete baseTypeDependencies[t];
					});

					// Splice the types back into the beginning of the array in the correct order.
					var spliceArgs = deps;
					spliceArgs.push(typeName);
					spliceArgs.splice(0, 0, 0, 0);
					Array.prototype.splice.apply(loadableTypes, spliceArgs);
				}
				else {
					typesPending.remove(typeName);
					onTypeLoaded(model, typeName);
				}
			}

			// Fetch any pending base types
			if (baseTypesToFetch.length > 0) {
				// TODO: need to notify dontDoubleUp that these types are
				// now part of the partitioned argument for the call.
				typesPending.addRange(baseTypesToFetch);

				// Make a recursive request for base types.
				typeProvider(baseTypesToFetch, typesFetched);
			}
			else if (typesPending.length === 0 && signal.isActive()) {
				// COMPLETE!!!
				signal.oneDone();
			}
		}
		// Handle an error response.  Loading should
		// *NOT* continue as if the type is available.
		else {
			ExoWeb.trace.throwAndLog("typeInit",
				"Failed to load {0} (HTTP: {1}, Timeout: {2})",
				typeNames.join(","),
				types._statusCode,
				types._timedOut);
		}
	}

	// request the types
	typeProvider(typeNames, typesFetched);

	signal.waitForAll(function() {
		if (callback && callback instanceof Function) {
			callback.call(thisPtr || this, typeNames.map(function(typeName) { return model.type(typeName).get_jstype(); }));
		}
	});
}

function moveTypeResults(originalArgs, invocationArgs, callbackArgs) {
	callbackArgs[0] = invocationArgs[1].map(function(typeName) { return invocationArgs[0].type(typeName).get_jstype(); });
}

var fetchTypes = fetchTypesImpl.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, partitionedArg: 1, partitionedFilter: moveTypeResults });

// fetches model paths and calls success or fail based on the outcome
function fetchPathTypes(model, jstype, path, success, fail) {
	var step = path.steps.dequeue();
	while (step) {
		// locate property definition in model
		var prop = jstype.meta.property(step.property);

		if (!prop) {
			fail("Could not find property \"" + step.property + "\" on type \"" + jstype.meta.get_fullName() + "\".");
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
				fetchTypes(model, [step.cast], function() {
					fetchPathTypes(model, jstype, path, success, fail);
				});
				return;
			}
		}
		else {
			mtype = prop.get_jstype().meta;
		}

		// if property's type isn't load it, then fetch it
		if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
			fetchTypes(model, [mtype.get_fullName()], function(jstypes) {
				fetchPathTypes(model, jstypes[0], path, success, fail);
			});

			// path walking will resume with callback
			return;
		}

		// keep walking the path
		jstype = mtype.get_jstype();

		step = path.steps.dequeue();
	}

	// Inform the caller that the path has been successfully fetched
	success();
}

function fetchQueryTypes(model, typeName, paths, callback) {
	var signal = new ExoWeb.Signal("fetchTypes");

	function rootTypeLoaded(jstype) {
		
		// process all paths
		if (paths) {
			Array.forEach(paths, function (path) {

				// attempt to fetch the path
				fetchPathTypes(model, jstype, path, signal.pending(), function (err) {

					// determine if the path represents a static property if the path was not valid
					var step = null, typeName = "";
					while (path.steps.length > 1) {
						step = path.steps.dequeue();
						typeName += (typeName.length > 0 ? "." : "") + step.property;
					}

					var mtype = model.type(typeName);

					var fetchStaticPathTypes = function fetchStaticPathTypes() {
						fetchPathTypes(model, (mtype || model.type(typeName)).get_jstype(), path, signal.pending(), function () {
							ExoWeb.trace.throwAndLog("typeInit", "Invalid query path \"" + path + "\" - " + err);
						});
					};

					if (!mtype) {
						// first time type has been seen, fetch it
						fetchTypes(model, [typeName], signal.pending(function (jstypes) {
							fetchStaticPathTypes(jstypes[0]);
						}));
					}
					else if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
						// lazy load type and continue walking the path
						ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending(fetchStaticPathTypes));
					}
					else {
						fetchStaticPathTypes();
					}

				});
			});
		}
	}

	// load root type, then load types referenced in paths
	var rootType = model.type(typeName);
	if (!rootType) {
		var _typeName = typeName;
		fetchTypes(model, [typeName], signal.pending(function(jstypes) {
			rootTypeLoaded(jstypes[0]);
		}));
	}
	else if (!ExoWeb.Model.LazyLoader.isLoaded(rootType)) {
		ExoWeb.Model.LazyLoader.load(rootType, null, signal.pending(rootTypeLoaded));
	}
	else {
		rootTypeLoaded(rootType.get_jstype());
	}

	signal.waitForAll(callback);
}

// Recursively searches throught the specified object and restores dates serialized as strings
function restoreDates(value) {
	function tryRestoreDate(obj, key) {
		var val = obj[key];
		if (val && val.constructor === String && dateRegex.test(val)) {
			dateRegex.lastIndex = 0;
			obj[key] = new Date(val.replace(dateRegex, dateRegexReplace));
		}
	}

	if (value instanceof Array) {
		for (var i = 0; i < value.length; i++) {
			tryRestoreDate(value, i);
		}
	}
	else if (value instanceof Object) {
		for (var field in value) {
			if (value.hasOwnProperty(field)) {
				tryRestoreDate(value, field);
			}
		}
	}
}

function tryGetJsType(model, name, property, forceLoad, callback, thisPtr) {
	var jstype = ExoWeb.Model.Model.getJsType(name, true);

	if (jstype && ExoWeb.Model.LazyLoader.isLoaded(jstype.meta)) {
		callback.call(thisPtr || this, jstype);
	}
	else if (jstype && forceLoad) {
//				ExoWeb.trace.log("server", "Forcing lazy loading of type \"{0}\".", [name]);
		ExoWeb.Model.LazyLoader.load(jstype.meta, property, callback, thisPtr);
	}
	else if (!jstype && forceLoad) {
//				ExoWeb.trace.log("server", "Force creating type \"{0}\".", [name]);
		ensureJsType(model, name, callback, thisPtr);
	}
	else {
//				ExoWeb.trace.log("server", "Waiting for existance of type \"{0}\".", [name]);
		$extend(name, function() {
//					ExoWeb.trace.log("server", "Type \"{0}\" was loaded, now continuing.", [name]);
			callback.apply(this, arguments);
		}, thisPtr);
	}
}

var LazyLoadEnum = {
	None: 0,
	Force: 1,
	ForceAndWait: 2
};

function tryGetEntity(model, translator, type, id, property, lazyLoad, callback, thisPtr) {
	// First, attempt to retrieve an existing object.
	var obj = type.meta.get(
		// Translate to the client-side id.
		translateId(translator, type.meta.get_fullName(), id),

		// We know that tryGetEntity is only called internally and the source of the entity
		// information is always seen as server-origin and so should specify an exact type.
		true
	);

	if (obj && ExoWeb.Model.LazyLoader.isLoaded(obj)) {
		// If the object exists and is loaded, then invoke the callback immediately.
		callback.call(thisPtr || this, obj);
	}
	else if (lazyLoad == LazyLoadEnum.Force) {
		// The caller wants the instance force loaded but doesn't want to wait for it to complete.

		// If the instance doesn't exist then ensure that a ghosted instance is created.
		if (!obj) {
			ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator);
		}

		// Invoke the callback immediately.
		callback.call(thisPtr || this, obj);

		// After the callback has been invoked, force loading to occur.
		ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
		ExoWeb.Model.LazyLoader.load(obj, property);
	}
	else if (lazyLoad == LazyLoadEnum.ForceAndWait) {
		// The caller wants the instance force loaded and will wait for it to complete.

		// If the instance doesn't exist then ensure that a ghosted instance is created.
		if (!obj) {
			ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator);
		}

		// Force loading to occur, passing through the callback.
		ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
		ExoWeb.Model.LazyLoader.load(obj, property, thisPtr ? callback.bind(thisPtr) : callback);
	}
	else {
		// The caller does not want to force loading, so wait for the instance to come into existance and invoke the callback when it does.

		ExoWeb.trace.log("server", "Waiting for existance of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);

		function invokeCallback() {
			if (filter(obj) !== true)
				return;

			// only invoke the callback once
			propertyFilter = function() { return false; };
			callback.call(thisPtr || this, obj);
		}

		var objSignal = new Signal("wait for object to exist");

		if (!obj) {
			model.addObjectRegistered(objSignal.pending(null, null, true), function(newObj) {
				if (newObj.meta.type === type.meta && newObj.meta.id === id) {
					obj = newObj;
					return true;
				}
			}, true);
		}

		objSignal.waitForAll(function () {
			// if a property was specified and its not inited, then wait for it
			if (property && type.meta.property(property).isInited(obj) !== true) {
				type.meta.property(property).addChanged(callback.bind(thisPtr), obj, true);
				return;
			}

			callback.call(thisPtr || this, obj);
		}, null, true);
	}
}
