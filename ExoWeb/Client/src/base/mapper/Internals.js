/// <reference path="../Model/Type.js" />
/// <reference path="../Model/ObjectMeta.js" />
/// <reference path="../Mapper/ObjectLazyLoader.js" />
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
		fetchTypes(model, [typeName], function(jstype) {
			callback.call(thisPtr || this, jstype);
		});
	}
	else if (LazyLoader.isRegistered(mtype)) {
		LazyLoader.load(mtype, null, false, function(jstype) {
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
		logWarning("A condition type with code \"" + conditionCode + "\" could not be found.");
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
		fetchTypes(model, [typeName], function () {
			objectFromJson(model, typeName, id, json, callback);
		});
		return;
	}

	// Load object's type if needed
	if (LazyLoader.isRegistered(mtype)) {
		LazyLoader.load(mtype, null, false, function() {
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

	var initObj = false;
	if (id === STATIC_ID) {
		initObj = true;
	} else if (obj) {
		if (LazyLoader.isRegistered(obj)) {
			initObj = true;
			// track the newly loaded instance to pass to the caller when complete
			loadedObj = obj;
			// unregister the instance from loading
			ObjectLazyLoader.unregister(obj);
		}
		if (obj.wasGhosted) {
			initObj = true;
			// track the newly loaded instance to pass to the caller when complete
			loadedObj = obj;
			delete obj.wasGhosted;
		}
	}

	// Continue if the object needs to be initialized (ghosted or lazy loaded),
	// or there is no object (load static lists), or the object is not new (load
	// non-loaded list properties for an object that was previously loaded).
	if (initObj || !obj || !obj.meta.isNew) {
		var loadedProperties = [];

		// Load object's properties
		for (var t = mtype; t !== null; t = obj ? t.baseType : null) {
			var props = obj ? t.get_instanceProperties() : t.get_staticProperties();

			for (var propName in props) {
				if (loadedProperties.indexOf(propName) >= 0) {
					continue;
				}

				loadedProperties.push(propName);

				var prop = props[propName];

				if (!prop) {
					throw new Error($format("Cannot load object {0}|{2} because it has an unexpected property '{1}'", typeName, propName, id));
				}

				if (prop.get_origin() !== "server") {
					continue;
				}

				if (!initObj && !prop.get_isList()) {
					// If the root object is already initialized, then skip over non-list properties.
					continue;
				}

				var propData;

				// instance fields have indexes, static fields use names
				if (obj) {
					propData = json[prop.get_index()];
				} else {
					propData = json[propName];

					// not all static fields may be present
					if (propData === undefined) {
						continue;
					}
				}

				if (propData !== null) {
					var propType = prop.get_jstype();

					// Always process list properties since they can be loaded after the parent object.
					if (prop.get_isList()) {
						var list = prop.get_isStatic() ? prop.value() : obj[prop._fieldName];

						if (propData == "?") {
							// don't overwrite list if its already a ghost
							if (!list) {
								list = ListLazyLoader.register(obj, prop);
								Property$_init.call(prop, obj, list, false);
							}
						} else {
							if (!list || LazyLoader.isRegistered(list)) {

								var doingObjectInit = undefined;
								//var newItems = [];

								// json has list members
								if (list) {
									ListLazyLoader.unregister(list);
									doingObjectInit = false;
								} else {
									list = [];
									doingObjectInit = true;
								}

								for (var i = 0; i < propData.length; i++) {
									var ref = propData[i];
									var c = getObject(model, propType, (ref && ref.id || ref), (ref && ref.type || propType));
									if (list.contains(c)) {
										logWarning($format("Initializing list {0}|{1}.{2} already contains object {3}.", typeName, id, prop._name, Entity.toIdString(c)));
									}
									//newItems.push(c);
									list.push(c);
								}

								if (doingObjectInit) {
									Property$_init.call(prop, obj, list);
								} else {
									// Collection change driven by user action or other behavior would result in the "change" event
									// being raised for the list property.  Since we don't want to record this as a true observable
									// change, raise the event manually so that rules will still run as needed.
									//if (obj) {
									prop._raiseEvent("changed", [obj, { property: prop, newValue: list, oldValue: undefined, collectionChanged: true }]);
									//}

									// Example of explicitly raising the collection change event if needed.
									// NOTE: This is probably not necessary because it is difficult to get a reference to a
									// non-loaded list and so nothing would be watching for changes prior to loading completion.
									// The _initializing flag would be necessary to signal to the property's collection change
									// handler that it should not raise the various events in response to the collection change.
									//list._initializing = true;
									//Sys.Observer.raiseCollectionChanged(list, [new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.add, newItems, 0)]);
									//delete list._initializing;
								}
							}
						}
					} else if (initObj) {
						var ctor = prop.get_jstype(true);

						// assume if ctor is not found its a model type not an intrinsic
						if (!ctor || ctor.meta) {
							Property$_init.call(prop, obj, getObject(model, propType, (propData && propData.id || propData), (propData && propData.type || propType)));
						} else {
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
							} else if (ctor === TimeSpan) {
								propData = new TimeSpan(propData.TotalMilliseconds);
							}
							Property$_init.call(prop, obj, propData);
						}
					}
				} else if (initObj) {
					Property$_init.call(prop, obj, null);
				}
			}
		}
	}

	if (callback && callback instanceof Function) {
		callback.call(thisPtr || this, loadedObj);
	}
}

function typesFromJson(model, json, onTypeLoadSuccess, onTypeLoadFailure) {
	for (var typeName in json) {
		var typeJson = json[typeName];
		if (typeJson === null) {
			if (onTypeLoadFailure) {
				onTypeLoadFailure(typeName, null);
			}
		} else {
			typeFromJson(model, typeName, typeJson);
			if (onTypeLoadSuccess) {
				onTypeLoadSuccess(typeName, typeJson);
			}
		}
	}
}

function typeFromJson(model, typeName, json) {
	// get model type. it may have already been created for lazy loading
	var mtype = getType(model, typeName, json.baseType);

	// set the default type format
	if (json.format) {
		mtype.set_format(getFormat(mtype.get_jstype(), json.format));
	}

	if (mtype.get_originForNewProperties() === "client") {
		throw new Error("Type \"" + mtype._fullName + "\" has already been loaded");
	}

	// store exports
	if (json.exports) {
		mtype.set_exports(json.exports);
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
			helptext: propJson.helptext,
			format: format,
			isList: propJson.isList === true,
			isStatic: propJson.isStatic === true,
			isPersisted: propJson.isPersisted !== false,
			isCalculated: propJson.isCalculated === true,
			index: propJson.index,
			defaultValue: propJson.defaultValue ? mtype.compileExpression(propJson.defaultValue) : undefined
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
		throw new Error("Function 'getObject' can only be called for instances (id='" + id + "')");
	}

	// get model type
	var mtype = getType(model, finalType, propType);

	// Try to locate the instance by id.
	var obj = mtype.get(id,
		// If an exact type exists then it should be specified in the call to getObject.
		true);

	// If it doesn't exist, create a ghosted instance.
	if (!obj) {
		obj = new (mtype.get_jstype())(id, null, true);
		obj.wasGhosted = true;
		if (!forLoading) {
			// If the instance is not being loaded, then attach a lazy loader.
			ObjectLazyLoader.register(obj);
		}
	    // Raise event after attaching the lazy loader so that listeners know that the object has not been loaded
		model.notifyObjectRegistered(obj);
	}

	return obj;
}

function onTypeLoaded(model, typeName) {
	var mtype = model.type(typeName);
	mtype.eachBaseType(function(mtype) {
		if (!LazyLoader.isLoaded(mtype)) {
			throw new Error("Base type " + mtype._fullName + " is not loaded.");
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
			typesFromJson(model, types, null, function (typeName) {
				// Remove types that failed to load
				typesPending.remove(typeName);
			});

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
			throw new Error($format("Failed to load {0} (HTTP: {1}, Timeout: {2})", typeNames.join(","), types._statusCode, types._timedOut));
		}
	}

	// request the types
	typeProvider(typeNames, typesFetched);

	signal.waitForAll(function() {
		if (callback && callback instanceof Function) {
			var jstypes = typeNames.map(function (typeName) {
				var mtype = model.type(typeName);
				return mtype ? mtype.get_jstype() : null;
			});
			callback.apply(thisPtr || this, jstypes);
		}
	});
}

function moveTypeResults(originalArgs, invocationArgs, callbackArgs) {
	// Replace all elements of the callback args array with the types that were requested
	var spliceArgs = [0, callbackArgs.length];
	Array.prototype.push.apply(spliceArgs, invocationArgs[1].map(function(typeName) {
		var mtype = invocationArgs[0].type(typeName);
		return mtype ? mtype.get_jstype() : null;
	}));
	Array.prototype.splice.apply(callbackArgs, spliceArgs);
}

var fetchTypes = fetchTypesImpl.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3, partitionedArg: 1, partitionedFilter: moveTypeResults });

// fetches model paths and calls success or fail based on the outcome
function fetchPathTypes(model, jstype, path, success, fail) {
	var step = path.steps.dequeue();
	var removedSteps = [step];
	while (step) {
		// locate property definition in model
		var prop = jstype.meta.property(step.property);

		if (!prop) {
			var args = [0, 0];
			Array.prototype.push.apply(args, removedSteps);
			Array.prototype.splice.apply(path.steps, args);
			fail("Could not find property \"" + step.property + "\" on type \"" + jstype.meta.get_fullName() + "\".");
			return;
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
				fetchTypes(model, [step.cast], function () {
					fetchPathTypes(model, jstype, path, success, function () {
						var args = [0, 0];
						Array.prototype.push.apply(args, removedSteps);
						Array.prototype.splice.apply(path.steps, args);
						fail.apply(this, arguments);
					});
				});
				return;
			}
		}
		else {
			mtype = prop.get_jstype().meta;
		}

		// if property's type isn't load it, then fetch it
		if (!LazyLoader.isLoaded(mtype)) {
			fetchTypes(model, [mtype.get_fullName()], function (t) {
				fetchPathTypes(model, t, path, success, function () {
					var args = [0, 0];
					Array.prototype.push.apply(args, removedSteps);
					Array.prototype.splice.apply(path.steps, args);
					fail.apply(this, arguments);
				});
			});

			// path walking will resume with callback
			return;
		}

		// keep walking the path
		jstype = mtype.get_jstype();

		step = path.steps.dequeue();
		removedSteps.push(step);
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
							throw new Error("Invalid query path \"" + path + "\" - " + err);
						});
					};

					if (!mtype) {
						// first time type has been seen, fetch it
						fetchTypes(model, [typeName], signal.pending(function (t) {
							if (!t) {
								throw new Error(err);
							}
							fetchStaticPathTypes(t);
						}));
					}
					else if (LazyLoader.isRegistered(mtype)) {
						// lazy load type and continue walking the path
						LazyLoader.load(mtype, null, false, signal.pending(fetchStaticPathTypes));
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
		fetchTypes(model, [typeName], signal.pending(function(t) {
			rootTypeLoaded(t);
		}));
	}
	else if (LazyLoader.isRegistered(rootType)) {
		LazyLoader.load(rootType, null, false, signal.pending(rootTypeLoaded));
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

	if (jstype && LazyLoader.isLoaded(jstype.meta)) {
		callback.call(thisPtr || this, jstype);
	}
	else if (jstype && forceLoad) {
		LazyLoader.load(jstype.meta, property, false, callback, thisPtr);
	}
	else if (!jstype && forceLoad) {
		ensureJsType(model, name, callback, thisPtr);
	}
	else {
		$extend(name, function() {
			callback.apply(this, arguments);
		}, thisPtr);
	}
}

var pendingEntities = {};

function lazyCreateEntity(type, id, callback, thisPtr) {
	var pendingForType = pendingEntities[type];
	if (!pendingForType) {
		pendingEntities[type] = pendingForType = {};
	}

	if (!pendingForType[id]) {
		pendingForType[id] = { callback: callback, thisPtr: thisPtr };
	}
}

var LazyLoadEnum = {
	// If the object doesn't exist, then the callback will be invoked once the object has been loaded for some other reason.
	None: 0,
	// If the object doesn't exist, then force creation and loading of the object and invoke the callback immediately.
	Force: 1,
	// If the object doesn't exist, then force creation and loading of the object and invoke the callback when loading is complete.
	ForceAndWait: 2,
	// If the object doesn't exist, then create the object and invoke the callback.
	Lazy: 3
};

var metaGet = Type.prototype.get;

Type.prototype.get = function (id, exactTypeOnly, suppressLazyInit) {
	var obj = metaGet.apply(this, arguments);

	if (!obj && !suppressLazyInit) {
		// If the object doesn't exist and is pending, create it.
		var pendingForType = pendingEntities[this.get_fullName()];
		if (pendingForType) {
			var pendingForId = pendingForType[id];
			if (pendingForId) {
				obj = pendingForId.callback.call(pendingForId.thisPtr);
			}
		}
	}

	return obj;
};

function tryGetEntity(model, translator, type, id, property, lazyLoad, callback, thisPtr) {
	// First, attempt to retrieve an existing object.
	var obj = type.meta.get(
		// Translate to the client-side id.
		translateId(translator, type.meta.get_fullName(), id),

		// We know that tryGetEntity is only called internally and the source of the entity
		// information is always seen as server-origin and so should specify an exact type.
		true,

		// Dont' lazily create the new object if no lazy behavior is specified, i.e. the caller doesn't want to force the object to exist.
		lazyLoad !== LazyLoadEnum.Force && lazyLoad !== LazyLoadEnum.ForceAndWait && lazyLoad !== LazyLoadEnum.Lazy
	);

	if (obj && obj.meta.isLoaded(property)) {
		// If the object exists and is loaded, then invoke the callback immediately.
		callback.call(thisPtr || this, obj);
	}
	else if (lazyLoad == LazyLoadEnum.Lazy) {
		if (!obj) {
			obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator, true);
		}

		// In lazy mode, simply invoke the callback if the object exists, since the caller doesn't care whether it is loaded.
		callback.call(thisPtr || this, obj);
	}
	else if (lazyLoad == LazyLoadEnum.Force) {
		// The caller wants the instance force loaded but doesn't want to wait for it to complete.

		// If the instance doesn't exist then ensure that a ghosted instance is created.
		if (!obj) {
			obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator, true);
		}

		// Invoke the callback immediately.
		callback.call(thisPtr || this, obj);

		// After the callback has been invoked, force loading to occur.
		LazyLoader.load(obj, property, false);
	}
	else if (lazyLoad == LazyLoadEnum.ForceAndWait) {
		// The caller wants the instance force loaded and will wait for it to complete.

		// If the instance doesn't exist then ensure that a ghosted instance is created.
		if (!obj) {
			obj = fromExoModel({ type: type.meta.get_fullName(), id: id }, translator, true);
		}

		// Force loading to occur, passing through the callback.
		LazyLoader.load(obj, property, false, thisPtr ? callback.bind(thisPtr) : callback);
	}
	else {
		// The caller does not want to force loading, so wait for the instance to come into existance and invoke the callback when it does.

		function invokeCallback() {
			if (filter(obj) !== true)
				return;

			// only invoke the callback once
			propertyFilter = function () { return false; };
			callback.call(thisPtr || this, obj);
		}

		var objSignal = new Signal("wait for object to exist");

		function ensureListLoaded() {
			// If there is a property specified that is a list, then don't invoke the callback until it is loaded.
			if (property) {
				var propertyObj = type.meta.property(property);
				// Only entity lists can be lazy loaded in addition to the parent object.
				if (propertyObj.get_isEntityListType()) {
					if (!obj.meta.isLoaded(property)) {
						// List lazy loader will invoke property change event
						propertyObj.addChanged(objSignal.pending(null, null, true), obj, true);
					}
				}
			}
		}

		function waitForObjectLoaded() {
			// Since the object is not loaded, don't invoke the callback until it is loaded.
			obj.meta.type.addInitExisting(objSignal.pending(function () {
				ensureListLoaded();
			}, null, true), obj, true);
		}

		function waitForObjectExists() {
			// The object doesn't exist, so don't invoke the callback until something causes it to be created.
			model.addObjectRegistered(objSignal.pending(null, null, true), function (newObj) {
				if (newObj.meta.type === type.meta && newObj.meta.id === translateId(translator, type.meta.get_fullName(), id)) {
					obj = newObj;
					if (!obj.meta.isLoaded()) {
						waitForObjectLoaded();
					}
					return true;
				}
			}, true);
		}

		if (!obj) {
			waitForObjectExists();
		} else if (!obj.meta.isLoaded()) {
			waitForObjectLoaded();
		} else {
			ensureListLoaded();
		}

		objSignal.waitForAll(function () {
			callback.call(thisPtr || this, obj);
		}, null, true);
	}
}
