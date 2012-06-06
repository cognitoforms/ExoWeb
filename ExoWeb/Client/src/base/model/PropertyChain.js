function PropertyChain(rootType, properties, filters) {
	/// <summary>
	/// Encapsulates the logic required to work with a chain of properties and
	/// a root object, allowing interaction with the chain as if it were a 
	/// single property of the root object.
	/// </summary>

	var handlers = null;

	function onStepChanged(priorProp, sender, args) {
		// scan all known objects of this type and raise event for any instance connected
		// to the one that sent the event.
		this._rootType.known().forEach(function(known) {
			if (this.connects(known, sender, priorProp)) {
				// Copy the original arguments so that we don't affect other code
				var newArgs = Object.copy(args);

				// Reset property to be the chain, but store the original property as "triggeredBy"
				newArgs.originalSender = sender;
				newArgs.triggeredBy = newArgs.property;
				newArgs.property = this;

				// Call the handler, passing through the arguments
				this._raiseEvent("changed", [known, newArgs]);
			}
		}, this);
	}

	this._updatePropertyChangeSubscriptions = function() {
		var handler = this._getEventHandler("changed");
		var eventHandlersExist = handler && !handler.isEmpty();
		var subscribedToPropertyChanges = handlers !== null;

		if (!eventHandlersExist && subscribedToPropertyChanges) {
			// If there are no more subscribers then unsubscribe from property-level events
			this._properties.forEach(function(prop, index) {
				var handler = handlers[index];
				prop.removeChanged(handler);
			}, this);
			handlers = null;
		}
		else if (eventHandlersExist && !subscribedToPropertyChanges) {
			// If there are subscribers and we have not subscribed to property-level events, then do so
			handlers = [];
			this._properties.forEach(function(prop, index) {
				var priorProp = (index === 0) ? undefined : this._properties[index - 1];
				var handler = onStepChanged.bind(this).prependArguments(priorProp);
				handlers.push(handler);
				prop.addChanged(handler);
			}, this);
		}
	};

	this._rootType = rootType;
	this._properties = properties;
	this._filters = filters;
}

PropertyChain.create = function PropertyChain$create(rootType, pathTokens/*, forceLoadTypes, success, fail*/) {
	/// <summary>
	/// Attempts to synchronously or asynchronously create a property chain for the specified 
	/// root type and path.  Also handles caching of property chains at the type level.
	/// </summary>

	var type = rootType;
	var properties = [];
	var filters = [];

	// initialize optional callback arguments
	var forceLoadTypes = arguments.length >= 3 && arguments[2] && arguments[2].constructor === Boolean ? arguments[2] : false;
	var success = arguments.length >= 4 && arguments[3] && arguments[3] instanceof Function ? arguments[3] : null;
	var fail = arguments.length >= 5 && arguments[4] && arguments[4] instanceof Function ?
		arguments[4] : function (error) { if (success) { ExoWeb.trace.throwAndLog("model", error); } };

	// process each step in the path either synchronously or asynchronously depending on arguments
	var processStep = function PropertyChain$processStep() {

		// get the next step
		var step = pathTokens.steps.dequeue();
		if (!step) {
			fail($format("Syntax error in property path: {0}", [pathTokens.expression]));

			// return null to indicate that the path is not valid
			return null;
		}

		// get the property for the step 
		var prop = type.property(step.property);
		if (!prop) {
			fail($format("Path '{0}' references an unknown property: {1}.{2}.", [pathTokens.expression, type.get_fullName(), step.property]));

			// return null if the property does not exist
			return null;
		}

		// ensure the property is not static because property chains are not valid for static properties
		if (prop.get_isStatic()) {
			fail($format("Path '{0}' references a static property: {1}.{2}.", [pathTokens.expression, type.get_fullName(), step.property]));

			// return null to indicate that the path references a static property
			return null;
		}

		// store the property for the step
		properties.push(prop);

		// handle optional type filters
		if (step.cast) {

			// determine the filter type
			type = Model.getJsType(step.cast, true).meta;
			if (!type) {
				fail($format("Path '{0}' references an invalid type: {1}", [pathTokens.expression, step.cast]));
				return null;
			}

			var jstype = type.get_jstype();
			filters[properties.length] = function (target) {
				return target instanceof jstype;
			};
		}
		else {
			type = prop.get_jstype().meta;
		}

		// process the next step if not at the end of the path
		if (pathTokens.steps.length > 0) {
			return ensureType(type, forceLoadTypes, processStep);
		}

		// otherwise, create and return the new property chain
		else {

			// processing the path is complete, verify that chain is not zero-length
			if (properties.length === 0) {
				fail($format("PropertyChain cannot be zero-length."));
				return null;
			}

			// ensure filter types on the last step are loaded
			return ensureType(filters[properties.length - 1], forceLoadTypes, function () {

				// create and cache the new property chain
				var chain = new PropertyChain(rootType, properties, filters);
				if (!rootType._chains) {
					rootType._chains = {};
				}
				rootType._chains[pathTokens.expression] = chain;

				// if asynchronous processing was allowed, invoke the success callback
				if (success) {
					success(chain);
				}

				// return the new property chain
				return chain;
			});
		}
	};

	// begin processing steps in the path
	return ensureType(type, forceLoadTypes, processStep);
}

PropertyChain.mixin(Functor.eventing);

PropertyChain.mixin({
	equals: function PropertyChain$equals(prop) {
		if (prop !== undefined && prop !== null) {
			if (prop instanceof Property) {
				return prop.equals(this);
			}
			else if (prop instanceof PropertyChain) {
				if (prop._properties.length !== this._properties.length) {
					return false;
				}

				for (var i = 0; i < this._properties.length; i++) {
					if (!this._properties[i].equals(prop._properties[i])) {
						return false;
					}
				}

				return true;
			}
		}
	},
	all: function PropertyChain$all() {
		return this._properties;
	},
	append: function PropertyChain$append(prop) {
		Array.addRange(this._properties, prop.all());
	},
	each: function PropertyChain$each(obj, callback, thisPtr, propFilter /*, target, p, lastProp*/) {
		/// <summary>
		/// Iterates over all objects along a property chain starting with the root object (obj).  This
		/// is analogous to the Array forEach function.  The callback may return a Boolean value to indicate 
		/// whether or not to continue iterating.
		/// </summary>
		/// <param name="obj" type="ExoWeb.Model.Entity">
		/// The root object to use in iterating over the chain.
		/// </param>
		/// <param name="callback" type="Function">
		/// The function to invoke at each iteration step.  May return a Boolean value to indicate whether 
		/// or not to continue iterating.
		/// </param>
		/// <param name="propFilter" type="ExoWeb.Model.Property" optional="true">
		/// If specified, only iterates over objects that are RETURNED by the property filter.  In other
		/// words, steps that correspond to a value or values of the chain at a specific property step).
		/// For example, if the chain path is "this.PropA.ListPropB", then...
		///     chain.each(target, callback, null, ListPropB);
		/// ...will iterate of the values of the list property only.
		/// </param>

		if (!callback || typeof (callback) != "function") {
			ExoWeb.trace.throwAndLog(["model"], "Invalid Parameter: callback function");
		}

		if (!obj) {
			ExoWeb.trace.throwAndLog(["model"], "Invalid Parameter: source object");
		}

		// invoke callback on obj first
		var target = arguments[4] || obj;
		var lastProp = arguments[6] || null;
		var props = this._properties.slice(arguments[5] || 0);
		for (var p = arguments[5] || 0; p < this._properties.length; p++) {
			var prop = this._properties[p];
			var canSkipRemainingProps = propFilter && lastProp === propFilter;
			var enableCallback = (!propFilter || lastProp === propFilter);

			if (target instanceof Array) {
				// if the target is a list, invoke the callback once per item in the list
				for (var i = 0; i < target.length; ++i) {
					// take into account any any chain filters along the way
					if (!this._filters[p] || this._filters[p](target[i])) {

						if (enableCallback && callback.call(thisPtr || this, target[i], i, target, prop, p, props) === false) {
							return false;
						}

						var targetValue = prop.value(target[i]);
						// continue along the chain for this list item
						if (!canSkipRemainingProps && (!targetValue || this.each(obj, callback, thisPtr, propFilter, targetValue, p + 1, prop) === false)){
							return false;
						}
					}
				}
				// subsequent properties already visited in preceding loop
				return true;
			}
			else {
				// return early if the target is filtered and does not match
				if (this._filters[p] && this._filters[p](target) === false) {
					break;
				}

				// take into account any chain filters along the way
				if (enableCallback && callback.call(thisPtr || this, target, -1, null, prop, p, props) === false) {
					return false;
				}
			}

			// if a property filter is used and was just evaluated, stop early
			if (canSkipRemainingProps) {
				break;
			}

			// move to next property in the chain
			target = target[prop._fieldName];

			// break early if the target is undefined
			if (target === undefined || target === null) {
				break;
			}

			lastProp = prop;
		}

		return true;
	},
	get_path: function PropertyChain$get_path() {
		if (!this._path) {
			this._path = this._getPathFromIndex(0);
		}

		return this._path;
	},
	_getPathFromIndex: function PropertyChain$_getPathFromIndex(startIndex) {
		var steps = [];
		if (this._properties[startIndex].get_isStatic()) {
			steps.push(this._properties[startIndex].get_containingType().get_fullName());
		}

		var previousStepType;
		this._properties.slice(startIndex).forEach(function (p, i) {
			if (i !== 0) {
				if (p.get_containingType() !== previousStepType && p.get_containingType().isSubclassOf(previousStepType)) {
					steps[steps.length - 1] = steps[steps.length - 1] + "<" + p.get_containingType().get_fullName() + ">";
				}
			}
			steps.push(p.get_name());
			previousStepType = p.get_jstype().meta;
		});

		return steps.join(".");
	},
	firstProperty: function PropertyChain$firstProperty() {
		return this._properties[0];
	},
	lastProperty: function PropertyChain$lastProperty() {
		return this._properties[this._properties.length - 1];
	},
	properties: function PropertyChain$properties() {
		return this._properties.slice();
	},
	lastTarget: function PropertyChain$lastTarget(obj) {
		for (var p = 0; p < this._properties.length - 1; p++) {
			var prop = this._properties[p];

			// exit early on null or undefined
			if (obj === undefined || obj === null) {
				return obj;
			}

			obj = prop.value(obj);
		}
		return obj;
	},

	prepend: function PropertyChain$prepend(prop) {
		var newProps = prop.all();
		for (var p = newProps.length - 1; p >= 0; p--) {
			Array.insert(this._properties, 0, newProps[p]);
		}
	},

	canSetValue: function PropertyChain$canSetValue(obj, value) {
		return this.lastProperty().canSetValue(this.lastTarget(obj), value);
	},

	// Determines if this property chain connects two objects.
	connects: function PropertyChain$connects(fromRoot, toObj, viaProperty) {
		var connected = false;

		// perform simple comparison if no property is defined
		if (!viaProperty) {
			return fromRoot === toObj;
		}

		this.each(fromRoot, function (target) {
			if (target === toObj) {
				connected = true;
				return false;
			}
		}, this, viaProperty);

		return connected;
	},
	rootedPath: function PropertyChain$rootedPath(rootType) {
		for (var i = 0; i < this._properties.length; i++) {
			if (this._properties[i].isDefinedBy(rootType)) {
				var path = this._getPathFromIndex(i);
				return this._properties[i]._isStatic ? this._properties[i].get_containingType().get_fullName() + "." + path : path;
			}
		}
	},
	// starts listening for the get event of the last property in the chain on any known instances. Use obj argument to
	// optionally filter the events to a specific object
	addGet: function PropertyChain$addGet(handler, obj) {
		var chain = this;

		this.lastProperty().addGet(function PropertyChain$_raiseGet(sender, property, value, isInited) {
			handler(sender, chain, value, isInited);
		}, obj);

		// Return the property to support method chaining
		return this;
	},
	removeChanged: function PropertyChain$removeChanged(handler) {
		this._removeEvent("changed", handler);

		this._updatePropertyChangeSubscriptions();
	},
	// starts listening for change events along the property chain on any known instances. Use obj argument to
	// optionally filter the events to a specific object
	addChanged: function PropertyChain$addChanged(handler, obj, once, toleratePartial) {
		var filter = mergeFunctions(

		// Ensure that the chain is inited from the root if toleratePartial is false
			this.isInited.bind(this).spliceArguments(1, 1, !toleratePartial),

		// Only raise for the given root object if specified
			obj ? equals(obj) : null,

		// If multiple filters exist, both must pass
			{andResults: true }

		);

		this._addEvent("changed", handler, filter, once);

		this._updatePropertyChangeSubscriptions();

		// Return the property chain to support method chaining
		return this;
	},
	// Property pass-through methods
	///////////////////////////////////////////////////////////////////////
	get_containingType: function PropertyChain$get_containingType() {
		return this._rootType;
	},
	get_jstype: function PropertyChain$get_jstype() {
		return this.lastProperty().get_jstype();
	},
	get_format: function PropertyChain$get_format() {
		return this.lastProperty().get_format();
	},
	format: function PropertyChain$format(val) {
		return this.lastProperty().format(val);
	},
	get_isList: function PropertyChain$get_isList() {
		return this.lastProperty().get_isList();
	},
	get_isStatic: function PropertyChain$get_isStatic() {
		// TODO
		return this.lastProperty().get_isStatic();
	},
	get_label: function PropertyChain$get_label() {
		return this.lastProperty().get_label();
	},
	get_name: function PropertyChain$get_name() {
		return this.lastProperty().get_name();
	},
	get_isValueType: function PropertyChain$get_isValueType() {
		return this.lastProperty().get_isValueType();
	},
	get_isEntityType: function PropertyChain$get_isEntityType() {
		return this.lastProperty().get_isEntityType();
	},
	get_isEntityListType: function PropertyChain$get_isEntityListType() {
		return this.lastProperty().get_isEntityListType();
	},
	rules: function (filter) {
		return this.lastProperty().rules(filter);
	},
	value: function PropertyChain$value(obj, val, customInfo) {
		var target = this.lastTarget(obj, true);
		var prop = this.lastProperty();

		if (arguments.length > 1) {
			prop.value(target, val, customInfo);
		}
		else {
			return target ? prop.value(target) : target;
		}
	},
	isInited: function PropertyChain$isInited(obj, enforceCompleteness /*, fromIndex, fromProp*/) {
		/// <summary>
		/// Determines if the property chain is initialized, akin to single Property initialization.
		/// </summary>
		var allInited = true, initedProperties = [], fromIndex = arguments[2] || 0, fromProp = arguments[3] || null, expectedProps = this._properties.length - fromIndex;

		this.each(obj, function(target, targetIndex, targetArray, property, propertyIndex, properties) {
			if (targetArray && enforceCompleteness) {
				if (targetArray.every(function(item) { return this.isInited(item, true, propertyIndex, properties[propertyIndex - 1]); }, this)) {
					Array.prototype.push.apply(initedProperties, properties.slice(propertyIndex));
				}
				else {
					allInited = false;
				}

				// Stop iterating at an array value
				return false;
			}
			else {
				if (!targetArray || targetIndex === 0) {
					initedProperties.push(property);
				}
				if (!property.isInited(target)) {
					initedProperties.remove(property);
					allInited = false;

					// Exit immediately since chain is not inited
					return false;
				}
			}
		}, this, null, obj, fromIndex, fromProp);

		return allInited && (!enforceCompleteness || initedProperties.length === expectedProps);
	},
	toString: function PropertyChain$toString() {
		if (this._isStatic) {
			return this.get_path();
		}
		else {
			var path = this._properties.map(function (e) { return e.get_name(); }).join(".");
			return $format("this<{0}>.{1}", [this.get_containingType(), path]);
		}
	}
});

exports.PropertyChain = PropertyChain;
