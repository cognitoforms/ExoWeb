var STATIC_ID = "static";

function ensureJsType(model, typeName, callback, thisPtr) {
	var mtype = model.type(typeName);

	if (!mtype) {
		fetchType(model, typeName, function(jstype) {
			callback.apply(thisPtr || this, [jstype]);
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

function conditionsFromJson(model, json, callback, thisPtr) {
	var signal = new Signal("conditionsFromJson");

	for (var code in json) {
		conditionFromJson(model, code, json[code], signal.pending());
	}

	signal.waitForAll(function() {
		if (callback && callback instanceof Function) {
			callback.call(thisPtr || this);
		}
	});
}

function conditionFromJson(model, code, json, callback, thisPtr) {
	var type = ExoWeb.Model.ConditionType.get(code);

	if (!type) {
		ExoWeb.trace.logWarning(["server", "conditions"], "A condition type with code \"{0}\" could not be found.", [code]);
		callback.call(thisPtr || this);
		return;
	}

	var signal = new Signal("conditionFromJson - " + code);

	var serverSync = model._server;

	json.forEach(function(condition) {
		var conditionObj = null;

		condition.targets.forEach(function(target) {
			tryGetJsType(serverSync._model, target.instance.type, null, false, function (jstype) {
				tryGetEntity(serverSync._model, serverSync._translator, jstype, target.instance.id, null, LazyLoadEnum.None, function (inst) {
					var propsSignal = new Signal("conditionFromJson.properties");

					var props = [];
					distinct(target.properties).forEach(function(p, i) {
						Model.property("this." + p, inst.meta.type, true, propsSignal.pending(function(chain) {
							props[i] = chain;
						}));
					});

					propsSignal.waitForAll(signal.pending(function() {
						if (!conditionObj) {
							conditionObj = new ExoWeb.Model.Condition(type, condition.message ? condition.message : type.get_message(), props);
						}
						else {
							conditionObj.get_properties().addRange(props);
						}

						inst.meta.conditionIf(conditionObj, true);
					}));
				});
			});
		});
	});

	signal.waitForAll(function() {
		if (callback && callback instanceof Function) {
			callback.call(thisPtr || this);
		}
	});
}

function objectsFromJson(model, json, callback, thisPtr) {
	var signal = new ExoWeb.Signal("objectsFromJson");

	try {
		for (var typeName in json) {
			var poolJson = json[typeName];
			for (var id in poolJson) {
				// locate the object's state in the json
				objectFromJson(model, typeName, id, poolJson[id], signal.pending(), thisPtr);
			}
		}
	}
	finally {
		signal.waitForAll(function() {
			callback.apply(thisPtr || this, arguments);
		});
	}
}

function objectFromJson(model, typeName, id, json, callback, thisPtr) {
	// get the object to load
	var obj;

	// family-qualified type name is not available so can't use getType()
	var mtype = model.type(typeName);

	// if this type has never been seen, go and fetch it and resume later
	if (!mtype) {
		fetchType(model, typeName, function() {
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

	// don't re-initialize
	if (ExoWeb.Model.LazyLoader.isLoaded(obj)) {
		//ExoWeb.trace.logWarning("objectInit", "{0}({1})   already loaded.", [typeName, id]);
	}
	else {
	//			ExoWeb.trace.log("objectInit", "{0}({1})   <.>", [typeName, id]);

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
					prop.init(obj, null);
				}
				else {
					var propType = prop.get_jstype();

					 if (prop.get_isList()) {
						var list = prop.value(obj);

						if (propData == "?") {
							// don't overwrite list if its already a ghost
							if (!list) {
								list = ListLazyLoader.register(obj, prop);
								prop.init(obj, list, false);
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
									prop.init(obj, list);
								}
							}
						}
					}
					else {
						var ctor = prop.get_jstype(true);

						// assume if ctor is not found its a model type not an intrinsic
						if (!ctor || ctor.meta) {
							prop.init(obj, getObject(model, propType, (propData && propData.id || propData), (propData && propData.type || propType)));
						}
						else {
							// Coerce strings into dates
							if (ctor == Date && propData && propData.constructor == String && propData.length > 0) {

								//now that we have the value set for the date.
								//if the underlying property datatype is actually a date and not a datetime
								//then we need to add the local timezone offset to make sure that the date is displayed acurately.
								if (prop.get_format() === Date.formats.ShortDate) {
									var serverOffset = model._server.get_ServerTimezoneOffset();
									var localOffset = -(new Date().getTimezoneOffset() / 60);

									propData = propData.replace(dateRegex, dateRegexReplace);
									propData = new Date(propData);
									propData.addHours(serverOffset - localOffset);
								}
								else {
									propData = propData.replace(dateRegex, dateRegexReplace);
									propData = new Date(propData);
								}
							}
							prop.init(obj, propData);
						}
					}
				}

				// static fields are potentially loaded one at a time
			}
		}

		if (obj) {
			ObjectLazyLoader.unregister(obj);
		}
	}

	if (callback && callback instanceof Function) {
		callback(thisPtr || this);
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
	var mtype = getType(model, typeName, json.baseType, true);

	// define properties
	for (var propName in json.properties) {
		var propJson = json.properties[propName];

		// Type
		var propType = propJson.type;
		if (propJson.type.endsWith("[]"))
		{
			propType = propType.toString().substring(0, propType.length - 2);
			propJson.isList = true;
		}
		propType = getJsType(model, propType);

		// Format
		var format = (propJson.format && propType.formats) ? propType.formats[propJson.format] : null;

		// Add the property
		var prop = mtype.addProperty({ name: propName, type: propType, isList: propJson.isList, label: propJson.label, format: format, isStatic: propJson.isStatic, index: propJson.index });


		// setup static properties for lazy loading
		if (propJson.isStatic) {
			if (propJson.isList) {
				prop.init(null, ListLazyLoader.register(null, prop));
			}
			//TODO
			//else {
			//	PropertyLazyLoader.register(mtype.get_jstype(), prop);
			//}
		}

		if (propJson.rules) {
			for (var i = 0; i < propJson.rules.length; ++i) {
				ruleFromJson(propJson.rules[i], prop);
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
}

function conditionTypesFromJson(model, mtype, json) {
	for (var code in json) {
		conditionTypeFromJson(model, mtype, code, json[code]);
	}
}

function conditionTypeFromJson(model, mtype, code, json) {

	// Attempt to retrieve the condition type by code.
	var conditionType = ExoWeb.Model.ConditionType.get(code);

	// Create the condition type if it does not already exist.
	if (!conditionType) {
		// Get a list of condition type sets for this type.
		var sets = !json.sets ? [] : json.sets.map(function(name) {
			var set = ExoWeb.Model.ConditionTypeSet.get(name);
			if (!set) {
				set = new ExoWeb.Model.ConditionTypeSet(name);
			}
			return set;
		});

		// Create the appropriate condition type based on the category.
		if (json.category == "Error") {
			conditionType = new ExoWeb.Model.ConditionType.Error(code, json.message, sets);
		}
		else if (json.category == "Warning") {
			conditionType = new ExoWeb.Model.ConditionType.Warning(code, json.message, sets);
		}
		else if (json.category == "Permission") {
			conditionType = new ExoWeb.Model.ConditionType.Permission(code, json.message, sets, json.permissionType, json.isAllowed);
		}
		else {
			conditionType = new ExoWeb.Model.ConditionType(code, json.category, json.message, sets);
		}

		// Account for the potential for subclasses to be serialized with additional properties.
		conditionType.extend(json);
	}

	if (json.rule && json.rule.hasOwnProperty("type")) {
		var ruleType = ExoWeb.Model.Rule[json.rule.type];
		var rule = new ruleType(mtype, json.rule, conditionType);
		conditionType.rules().push(rule);
	}
}

function getJsType(model, typeName, forLoading) {
	// Get an array representing the type family.
	var family = typeName.split(">");

	// Try to get the js type from the window object.
	var jstype = ExoWeb.Model.Model.getJsType(family[0], true);

	// If its not defined, assume the type is a model type
	// that may eventually be fetched.
	if (jstype === undefined) {
		jstype = getType(model, null, family, forLoading).get_jstype();
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

				//if (!forLoading || family.length > 0) {
//							ExoWeb.trace.log("typeInit", "{0} (ghost)", [type]);
					TypeLazyLoader.register(mtype);
				//}
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

	// Try to locate object in pool
	var obj = mtype.get(id);

	// if it doesn't exist, create a ghost
	if (!obj) {
		obj = new (mtype.get_jstype())(id);

		if (!forLoading) {
			ObjectLazyLoader.register(obj);
//					ExoWeb.trace.log("entity", "{0}({1})  (ghost)", [mtype.get_fullName(), id]);
		}
	}

	return obj;
}

///////////////////////////////////////////////////////////////////////////////
function fetchTypeImpl(model, typeName, callback, thisPtr) {
	var signal = new ExoWeb.Signal("fetchType(" + typeName + ")");

	var errorObj;

	function success(result) {
		// load type(s)
		typesFromJson(model, result.types);

		// ensure base classes are loaded too
		model.type(typeName).eachBaseType(function(mtype) {
			if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
				ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending());
			}
		});
	}

	// Handle an error response.  Loading should
	// *NOT* continue as if the type is available.
	function error(error) {
		errorObj = error;
	}

	// request the type and handle the response
	typeProvider(typeName, signal.pending(success), signal.orPending(error));

	// after properties and base class are loaded, then return results
	signal.waitForAll(function() {
		if (errorObj !== undefined) {
			ExoWeb.trace.throwAndLog("typeInit",
				"Failed to load {typeName} (HTTP: {error._statusCode}, Timeout: {error._timedOut})",
				{ typeName: typeName, error: errorObj });
		}

		var mtype = model.type(typeName);
		TypeLazyLoader.unregister(mtype);

		raiseExtensions(mtype);

		// done
		if (callback && callback instanceof Function) {
			callback.call(thisPtr || this, mtype.get_jstype());
		}
	});
}

var fetchType = fetchTypeImpl.dontDoubleUp({ callbackArg: 2, thisPtrArg: 3 });

function fetchPathTypes(model, jstype, path, callback) {
	var step = Array.dequeue(path.steps);
	while (step) {
		// locate property definition in model
		var prop = jstype.meta.property(step.property, true);

		if (!prop) {
			ExoWeb.trace.throwAndLog("typeInit", "Could not find property \"{0}\" on type \"{1}\".", [step.property, jstype.meta.get_fullName()]);
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
				fetchType(model, step.cast, function() {
					fetchPathTypes(model, jstype, path, callback);
				});
				return;
			}
		}
		else {
			mtype = prop.get_jstype().meta;
		}

		// if property's type isn't load it, then fetch it
		if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
			fetchType(model, mtype.get_fullName(), function(jstype) {
				fetchPathTypes(model, jstype, path, callback);
			});

			// path walking will resume with callback
			return;
		}

		// keep walking the path
		jstype = mtype.get_jstype();

		step = Array.dequeue(path.steps);
	}

	// done walking path
	if (callback && callback instanceof Function) {
		callback();
	}
}

function fetchTypes(model, typeName, paths, callback) {
	var signal = new ExoWeb.Signal("fetchTypes");

	function rootTypeLoaded(jstype) {
		if (paths) {
			Array.forEach(paths, function(path) {
				if (path.steps[0].property === "this") {
					var step = Array.dequeue(path.steps);
					var mtype = jstype.meta;

					var fetchRootTypePaths = function fetchRootTypePaths() {
						fetchPathTypes(model, mtype.get_jstype(), path, signal.pending());
					};

					// handle the case where the root object is cast to a derived type
					if (step.cast) {
						mtype = model.type(step.cast);
						if (!mtype) {
							fetchType(model, step.cast, signal.pending(function() {
								mtype = model.type(step.cast);
								fetchRootTypePaths();
							}));
						}
						else {
							fetchRootTypePaths();
						}
					}
					else {
						fetchRootTypePaths();
					}
				}
				else {
					// This is a static property.  Static property paths 
					// are currently limited to a single property.
					var step = null, typeName = "";
					while (path.steps.length > 1) {
						step = Array.dequeue(path.steps);
						typeName += (typeName.length > 0 ? "." : "") + step.property;
					}

					var mtype = model.type(typeName);

					var fetchStaticPathTypes = function fetchStaticPathTypes() {
						fetchPathTypes(model, (mtype || model.type(typeName)).get_jstype(), path, signal.pending());
					};

					if (!mtype) {
						// first time type has been seen, fetch it
						fetchType(model, typeName, signal.pending(fetchStaticPathTypes));
					}
					else if (!ExoWeb.Model.LazyLoader.isLoaded(mtype)) {
						// lazy load type and continue walking the path
						ExoWeb.Model.LazyLoader.load(mtype, null, signal.pending(fetchStaticPathTypes));
					}
					else {
						fetchStaticPathTypes();
					}
				}
			});
		}
	}

	// load root type, then load types referenced in paths
	var rootType = model.type(typeName);
	if (!rootType) {
		fetchType(model, typeName, signal.pending(rootTypeLoaded));
	}
	else if (!ExoWeb.Model.LazyLoader.isLoaded(rootType)) {
		ExoWeb.Model.LazyLoader.load(rootType, null, signal.pending(rootTypeLoaded));
	}
	else {
		rootTypeLoaded(rootType.get_jstype());
	}

	signal.waitForAll(callback);
}

// {ruleName: ruleConfig}
function ruleFromJson(rulesJson, prop) {
	for (var name in rulesJson) {
		var json = rulesJson[name];
		var ruleType = ExoWeb.Model.Rule[json.type];
		var rule = new ruleType(json, [prop]);
	}
}

var dateRegex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})\:(\d{2})\:(\d{2})(\.\d{3})?Z$/g;
var dateRegexReplace = "$2/$3/$1 $4:$5:$6 GMT";

// Recursively searches throught the specified object and restores dates serialized as strings
function restoreDates(value) {
	if (value instanceof Array) {
		for (var i = 0; i < value.length; i++)
		{
			var element = value[i];
			if (element && element.constructor == String && dateRegex.test(element)) {
				dateRegex.lastIndex = 0;
				element = element.replace(dateRegex, dateRegexReplace);
				value[i] = new Date(element);
			}
		}
	}
	else if (value instanceof Object) {
		for (var field in value) {
			if (value.hasOwnProperty(field)) {
				var element = value[field];
				if (element && element.constructor == String && dateRegex.test(element)) {
					dateRegex.lastIndex = 0;
					element = element.replace(dateRegex, dateRegexReplace);
					value[field] = new Date(element);
				}
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
	var obj = type.meta.get(translateId(translator, type.meta.get_fullName(), id));

	if (obj && ExoWeb.Model.LazyLoader.isLoaded(obj)) {
		callback.call(thisPtr || this, obj);
	}
	else if (lazyLoad == LazyLoadEnum.Force) {
		if (!obj) {
			ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			obj = fromExoGraph({ type: type.meta.get_fullName(), id: id }, translator);
		}
		callback.call(thisPtr || this, obj);
		ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
		ExoWeb.Model.LazyLoader.load(obj, property);
	}
	else if (lazyLoad == LazyLoadEnum.ForceAndWait) {
		if (!obj) {
			ExoWeb.trace.log("server", "Forcing creation of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
			obj = fromExoGraph({ type: type.meta.get_fullName(), id: id }, translator);
		}

		ExoWeb.trace.log("server", "Forcing lazy loading of object \"{0}|{1}\".", [type.meta.get_fullName(), id]);
		ExoWeb.Model.LazyLoader.load(obj, property, thisPtr ? callback.bind(thisPtr) : callback);
	}
	else {
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
			if (property && type.meta.property(property, true).isInited(obj) !== true) {
				type.meta.property(property, true).addChanged(callback.bind(thisPtr), obj, true);
				return;
			}

			callback.call(thisPtr || this, obj);
		}, null, true);
	}
}
