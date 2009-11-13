Type.registerNamespace("ExoWeb.Model");


//////////////////////////////////////////////////////////////////////////////////////
function Model()
{
	this._types = {};
	
	this._validatedQueue = new EventQueue(
					function(e)
					{
						e.sender._raisePropertyValidated(e.property);
					},
					function(a, b)
					{
						return a.sender == b.sender && a.property == b.property;
					}
				);

	this.__type = "Model";
}

Model.prototype.addType = function(name, baseClass, properties) {
	var jstype = window[name];
	
	if (!jstype) {
		window[name] = jstype = function(id) {

			// TODO
			this.meta = new ModelObject(this.type, this);

			if (id) {
				var obj = this.type.get(id);

				if (obj)
					return obj;
			}

			this.type.register(this, id);
		};
	}

	// TODO: make this a method that uses the pool?
	jstype.All = [];

	if (baseClass) {
		if (typeof (baseClass) == "string")
			baseClass = window[baseClass];
		jstype.prototype = new baseClass;
	}

	var type = new ModelType(jstype, name);
	type.set_model(this);
	type.define(properties);

	this._types[name] = type;

	jstype.prototype.type = type;
}

Model.prototype.get_validatedQueue = function()
{
	return this._validatedQueue;
}

Model.prototype.get_type = function(name) {
	return this._types[name];
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelType(jstype, fullName)
{
	this._rules = [];
	this._jstype = jstype;
	this._fullName = fullName;
	this._pool = {};
	this._counter = 0;
	this._properties = {};

	this.__type = "ModelType";
}

ModelType.prototype.newId = function() {
	return "?" + this._counter++;
}

ModelType.prototype.register = function(obj, id) {
	for (var prop in this._properties)
		obj[prop] = null;

	if (!id) {
		id = this.newId();
		obj._new = true;
	}

	obj.meta.id = id.toString();

	Sys.Observer.makeObservable(obj);

	this._pool[id.toString()] = obj;
}

ModelType.prototype.get = function(id) {
	return this._pool[id];
}

ModelType.prototype.define = function(properties)
{
	for (var propName in properties)
		this.addProperty(propName, properties[propName]);
}

ModelType.prototype.addProperty = function(propName, def) {
	var prop = new ModelProperty(propName, def.type, def.label, def.format ? window[def.type].formats[def.format] : null, def.allowed);
	prop.set_containingType(this);

	this._properties[propName] = prop;

	// modify jstype to include functionality based on the type definition
	this._jstype["$" + propName] = prop;

	// add members to all instances of this type
	this._jstype.prototype["$" + propName] = prop;
//	this._jstype.prototype["get_" + propName] = this._makeGetter(prop, prop.getter);
//	this._jstype.prototype["set_" + propName] = this._makeSetter(prop, prop.setter);
}

ModelType.prototype._makeGetter = function(receiver, fn)
{
	return function()
	{
		return fn.call(receiver, this);
	}
}

ModelType.prototype._makeSetter = function(receiver, fn)
{
	return function(val)
	{
		fn.call(receiver, this, val);
	}
}

ModelType.prototype.set_model = function(val)
{
	this._model = val;
}

ModelType.prototype.get_model = function()
{
	return this._model;
}

ModelType.prototype.get_fullName = function()
{
	return this._fullName;
}

ModelType.prototype.get_jstype = function()
{
	return this._jstype;
}

ModelType.prototype.property = function(name) {
	var p = (name.indexOf(".") >= 0) ? name.substring(0, name.indexOf(".")) : name;

	var prop = this._properties[p];
	
	if (prop){
		var prop = new ExoWeb.Model.PropertyChain(prop);
		
		// evaluate the remainder of the property path
		if (name.indexOf(".") >= 0) {
			var remainder = name.substring(name.indexOf(".") + 1);
			var propType = prop.last().get_typeName();
			var type = this._model.get_type(propType);

			var children = type.property(remainder);
			if (children)
				prop.append(children);
			else {
				// if finding a child property failed then return null
				// TODO: should this be more lax and burden consuming 
				// code with checking the property chain for nulls?
				prop = null;
			}
	}
}

	return prop;
}

ModelType.prototype.rule = function(inputs, func, async, issues)
{
	var rule = new ModelRule(async, func);

	for (var i = 0; i < inputs.length; ++i)
	{
		var propName = inputs[i].get_name();
		var rules = this._rules[propName];

		if (!rules)
		{
			rules = [rule];
			this._rules[propName] = rules;
		}
		else
			rules.push(rule);
	}

	if (issues)
		for (var i = 0; i < issues.length; ++i)
			issues[i].set_origin(rule);
}

ModelType.prototype.constraint = function(condition, issueDesc)
{
	var type = this;
	var issueProps = [];

	// update description and discover the properties the issue should be bound to
	issueDesc = issueDesc.replace(/\$([a-z0-9_]+)/ig,
					function(s, propName)
					{
						var prop = type.property(propName);

						// TODO: is using last appropriate for multi-hop?
						if ($.inArray(prop.last(), issueProps) < 0)
							issueProps.push(prop.last());

						return prop.last().get_label();
					}
				);

	var inputProps = ModelRule.inferInputs(this, condition);

	var err = new ModelIssue(issueDesc, issueProps);

	type.rule(
					inputProps,
					function(obj)
					{
						obj.meta.issueIf(err, !condition.apply(obj));
					},
					false,
					[err]);

	return this;
}

// Executes all rules that have a particular property as input
ModelType.prototype.executeRules = function(obj, prop, start)
{
	var i = (start ? start : 0);
	var processing;

	var rules = this._rules[prop];

	if (rules)
	{
		while (processing = (i < rules.length))
		{
			var rule = rules[i];
			if (!rule._isExecuting)
			{
				rule._isExecuting = true;

				if (rule.isAsync)
				{
					// run rule asynchronously, and then pickup running next rules afterwards
					var _this = this;
					rule.execute(obj, function(obj)
					{
						rule._isExecuting = false;
						_this.executeRules(obj, prop, i + 1);
					});
					break;
				}
				else
				{
					try
					{
						rule.execute(obj);
					}
					finally
					{
						rule._isExecuting = false;
					}
				}
			}

			++i;
		}
	}

	if (!processing)
		this._model.get_validatedQueue().raise();
}

///////////////////////////////////////////////////////////////////////////////
ModelTypeClass = { Intrinsic: "intrinsic", Entity: "entity", EntityList: "entitylist" }


//////////////////////////////////////////////////////////////////////////////////////
function ModelProperty(name, dataType, label, format, allowedValues)
{
	this._name = name;
	this._fullTypeName = dataType;
	this._label = label;
	this._format = format;
	this._allowedValues = allowedValues;

	this.__type = "ModelProperty";

	// ???
	//var prop = this;
}

ModelProperty.prototype.toString = function()
{
	return this.get_label();
}

// TODO: is this used?
function Property(name, dataType)
{
	return new ModelProperty(name, dataType);
}

ModelProperty.prototype.set_containingType = function(type)
{
	this._containingType = type;
}

ModelProperty.prototype.get_containingType = function()
{
	return this._containingType;
}

ModelProperty.prototype.get_fullTypeName = function() {
	return this._fullTypeName;
}

ModelProperty.prototype.get_typeName = function() {
	if (!this._typeName) {
		this._typeName = this._fullTypeName;
		
		if (this._typeName.indexOf("|") >= 0)
			this._typeName = this._typeName.split("|")[1];
	}

	return this._typeName;
}

ModelProperty.prototype.get_typeClass = function() {
	if (!this._typeClass) {
		if (this._fullTypeName.indexOf("|") > 0) {
			var multiplicity = this._fullTypeName.split("|")[0];

			if (multiplicity == "One")
				this._typeClass = ModelTypeClass.Entity;
			else if (multiplicity == "Many")
				this._typeClass = ModelTypeClass.EntityList;
			else {
				this._typeClass = $format("Unknown multiplicity \"{m}\".", { m: multiplicity });
				throw (this._typeClass);
			}
		}
		else {
			this._typeClass = ModelTypeClass.Intrinsic;
		}
	}

	return this._typeClass;
}

ModelProperty.prototype.get_dataType = function() {
	if (!this._dataType) {
		var dt = this._fullTypeName.indexOf("|") > 0 ? this._fullTypeName.split("|")[1] : this._fullTypeName;

		if (window[dt])
			this._dataType = window[dt];
		else if (dt == "Integer" || dt == "Float")
			this._dataType = Number;
		else {
			this._dataType = $format("Unknown data type \"{dt}\".", { dt: dt });
			throw (this._dataType);
		}
	}

	return this._dataType;
}

ModelProperty.prototype.get_allowedValues = function() {
	return this._allowedValues;
}

ModelProperty.prototype.get_format = function()
{
	return this._format;
}


ModelProperty.prototype.getter = function(obj)
{
	return obj[this._name];
}

ModelProperty.prototype.setter = function(obj, val)
{
	// TODO: validate val is correct datatype for manual calls to the setter
	if (this._ERR_ORIGIN_FORMAT)
		obj.meta.clearIssues(this._ERR_ORIGIN_FORMAT);

	if (val instanceof FormatIssue)
	{
		if (!this._ERR_ORIGIN_FORMAT)
			this._ERR_ORIGIN_FORMAT = {};

		issue = new ModelIssue(
						$format(val.get_message(), { value: this.get_label() }),
						[this],
						this._ERR_ORIGIN_FORMAT);

		obj.meta.issueIf(issue, true);
	}

	obj[this._name] = val;
}

ModelProperty.prototype.get_label = function()
{
	if (this._label)
		return this._label;

	return this._name;
}

ModelProperty.prototype.get_name = function()
{
	return this._name;
}

ModelProperty.prototype.get_uniqueName = function()
{
	return this.get_containingType().get_fullName() + "$" + this._name;
}

ModelProperty.prototype.label = function(val)
{
	this._label = val;
	return this;
}


ModelProperty.prototype.value = function(obj, val)
{
	if (arguments.length == 2)
	{
		Sys.Observer.setValue(obj, this._name, val);
		return val;
	}
	else
		return obj[this._name];
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelObject(type, obj)
{
	this._obj = obj;
	this._type = type;
	this._issues = [];
	this._propertyIssues = {};
	this._propertyValidated = {};
	this._propertyValidating = {};

	this.__type = "ModelObject";

	// watch for changes to object's state
	Sys.Observer.makeObservable(obj);
	Sys.Observer.addPropertyChanged(obj, this._propertyChanged);
}

ModelObject.prototype._propertyChanged = function(sender, e)
{
	var propName = e.get_propertyName();
	sender.meta.executeRules(propName);
}

ModelObject.prototype.executeRules = function(propName) {
	this._type.get_model().get_validatedQueue().push({ sender: this, property: propName });
	this._raisePropertyValidating(propName);
	this._type.executeRules(this, propName);
}

ModelObject.prototype.property = function(propName)
{
	return this._type.property(propName);
}

ModelObject.prototype.clearIssues = function(origin)
{
	var issues = this._issues;

	for (var i = issues.length - 1; i >= 0; --i)
	{
		var issue = issues[i];

		if (issue.get_origin() == origin)
		{
			this._removeIssue(i);
			this._queuePropertiesValidated(issue.get_properties());
		}
	}
}

ModelObject.prototype.issueIf = function(issue, condition)
{
	// always remove and re-add the issue to preserve order
	var idx = $.inArray(issue, this._issues);

	if (idx >= 0)
		this._removeIssue(idx);

	if (condition)
		this._addIssue(issue);

	if ((idx < 0 && condition) || (idx >= 0 && !condition))
		this._queuePropertiesValidated(issue.get_properties());
}

ModelObject.prototype._addIssue = function(issue)
{
	this._issues.push(issue);

	// update _propertyIssues
	var props = issue.get_properties();
	for (var i = 0; i < props.length; ++i)
	{
		var propName = props[i].get_name();
		var pi = this._propertyIssues[propName];

		if (!pi)
		{
			pi = [];
			this._propertyIssues[propName] = pi;
		}

		pi.push(issue);
	}
}

ModelObject.prototype._removeIssue = function(idx)
{
	var issue = this._issues[idx];
	this._issues.splice(idx, 1);

	// update _propertyIssues
	var props = issue.get_properties();
	for (var i = 0; i < props.length; ++i)
	{
		var propName = props[i].get_name();
		var pi = this._propertyIssues[propName];

		var piIdx = $.inArray(issue, pi);
		pi.splice(piIdx, 1);
	}
}

ModelObject.prototype.issues = function(prop)
{
	if (!prop)
		return this._issues;

	var ret = [];

	for (var i = 0; i < this._issues.length; ++i)
	{
		var issue = this._issues[i];
		var props = issue.get_properties();

		for (var p = 0; p < props.length; ++p)
		{
			if (props[p] == prop)
			{
				ret.push(issue);
				break;
			}
		}
	}

	return ret;
}

ModelObject.prototype._queuePropertiesValidated = function(properties)
{
	var queue = this._type.get_model().get_validatedQueue();

	for (var i = 0; i < properties.length; ++i)
		queue.push({ sender: this, property: properties[i].get_name() });
}

ModelObject.prototype._raisePropertyValidated = function(propName)
{
	var handlers = this._propertyValidated[propName];

	if (typeof (handlers) != "undefined")
	{
		var issues = this._propertyIssues[propName];
		handlers(this, issues ? issues : []);
	}
}

ModelObject.prototype.addPropertyValidated = function(property, handler)
{
	var handlers = this._propertyValidated[property];

	if (typeof (handlers) == "undefined")
		this._propertyValidated[property] = handlers = Functor();

	handlers.add(handler);
}

ModelObject.prototype._raisePropertyValidating = function(property)
{
	var handlers = this._propertyValidating[property];

	if (typeof (handlers) != "undefined")
		handlers(this);
}

ModelObject.prototype.addPropertyValidating = function(property, handler)
{
	var handlers = this._propertyValidating[property];

	if (typeof (handlers) == "undefined")
		this._propertyValidating[property] = handlers = Functor();

	handlers.add(handler);
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelRule(isAsync, code)
{
	this.isAsync = isAsync;
	this._code = code;
}

ModelRule.inferInputs = function(rootType, func)
{
	var inputs = [];
	var match;

	while (match = /this\.([a-zA-Z0-9_]+)/g.exec(func.toString()))
	{
		// TODO: is using last appropriate for multi-hops?
		inputs.push(rootType.property(match[1]).last());
	}

	return inputs;
}

ModelRule.prototype.execute = function(obj, callback)
{
	if (!this.isAsync)
		this._code(obj);
	else
		this._code(obj, callback);
}

ModelProperty.prototype.asyncRule = function(func, issues)
{
	this._containingType.rule([this], func, true, issues);
	return this;
}

ModelProperty.prototype.rule = function(func, issues)
{
	this._containingType.rule([this], func, false, issues);
	return this;
}

ModelProperty.prototype.calculated = function(func)
{
	var prop = this;

	var inputs = ModelRule.inferInputs(this._containingType, func);

	this._containingType.rule(
					inputs,
					function(obj)
					{
						Sys.Observer.setValue(obj, prop._name, func.apply(obj));
					},
					false
				);

	return this;
}

ModelProperty.prototype.range = function(min, max)
{
	var prop = this;
	var err = null;
	var fn = null;

	var hasMin = (typeof (min) != "undefined" && min != null);
	var hasMax = (typeof (max) != "undefined" && max != null);

	if (hasMin && hasMax)
	{
		err = new ModelIssue(prop.get_label() + " must be between " + min + " and " + max, [prop]);
		fn = function(obj)
		{
			var val = prop.value(obj);
			obj.meta.issueIf(err, val < min || val > max);
		}
	}
	else if (hasMin)
	{
		err = new ModelIssue(prop.get_label() + " must be at least " + min, [prop]);
		fn = function(obj)
		{
			var val = prop.value(obj);
			obj.meta.issueIf(err, val < min);
		}
	}
	else if (hasMax)
	{
		err = new ModelIssue(prop.get_label() + " must no more than " + max, [prop]);
		fn = function(obj)
		{
			var val = prop.value(obj);
			obj.meta.issueIf(err, val > max);
		}
	}

	return fn ? prop.rule(fn, [err]) : this;
}

ModelProperty.prototype.required = function()
{
	var prop = this;
	var err = new ModelIssue(prop.get_label() + " is required", [prop]);

	return prop.rule(function(obj)
	{
		var val = prop.value(obj);
		obj.meta.issueIf(err, val == null || (String.trim(val.toString()) == ""));
	},
	[err]);
}

ModelProperty.prototype.format = function(pattern, description)
{
	var prop = this;
	var err = new ModelIssue(prop.get_label() + " must be formatted as " + description, [prop]);

	return prop.rule(function(obj)
	{
		var val = prop.value(obj);
		obj.meta.issueIf(err, !pattern.test(val));
	},
	[err]);
}

ModelProperty.prototype.phone = function(description)
{
	return this.format(/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/, description ? description : "###-###-####");
}

ModelProperty.prototype.get_fromString = function()
{
	var _this = this;
	return function(str)
	{
		if (_this._converter && _this._converter.fromString)
			return _this._converter.fromString(str);

		return null;
	}
}

ModelProperty.prototype.serverRules = function(errorProbability)
{
	var prop = this;
	var randomErr = new ModelIssue("p=" + errorProbability, [prop]);

	return this.asyncRule(function(obj, callback)
	{
		// remove all current server issues
		obj.meta.clearIssues(this);

		if (obj.meta.issues(prop).length > 0)
		{
			// if there are already issues with this property then do nothing
			callback();
		}
		else
		{
			// callback when complete
			window.setTimeout(function()
			{
				obj.meta.issueIf(randomErr, Math.random() < errorProbability);
				callback();
			}, 1000);  // simulate server call
		}
	},
				[randomErr]);
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelDataType(name, toString, fromString)
{
	this._name = name;
	this._toString = toString;
	this._fromString = fromString;
}

ModelDataType.prototype.get_name = function()
{
	return this._name;
}


//////////////////////////////////////////////////////////////////////////////////////
function EventQueue(raise, areEqual)
{
	this._queue = [];
	this._raise = raise;
	this._areEqual = areEqual;
}

EventQueue.prototype.push = function(item)
{
	// don't double queue items...
	if (this._areEqual)
	{
		for (var i = 0; i < this._queue.length; ++i)
		{
			if (this._areEqual(item, this._queue[i]))
				return;
		}
	}

	this._queue.push(item);
}

EventQueue.prototype.raise = function()
{
	try
	{
		for (var i = 0; i < this._queue.length; ++i)
			this._raise(this._queue[i]);
	}
	finally
	{
		if (this._queue.length > 0)
			this._queue = [];
	}
}

//////////////////////////////////////////////////////////////////////////////////////
function ModelIssue(message, relatedProperties, origin)
{
	this._properties = relatedProperties || [];
	this._message = message;
	this._origin = origin;
}

ModelIssue.prototype.get_properties = function()
{
	return this._properties;
}

ModelIssue.prototype.get_message = function()
{
	return this._message;
}

ModelIssue.prototype.get_origin = function()
{
	return this._origin;
}

ModelIssue.prototype.set_origin = function(origin)
{
	this._origin = origin;
}

ModelIssue.prototype.equals = function(o)
{
	return o.property.equals(this.property) && o._message.equals(this._message);
}

//////////////////////////////////////////////////////////////////////////////////////
function FormatIssue(message, invalidValue)
{
	this._message = message;
	this._invalidValue = invalidValue;
}

FormatIssue.prototype.get_message = function()
{
	return this._message;
}

FormatIssue.prototype.toString = function()
{
	return this._invalidValue;
}

FormatIssue.prototype.get_invalidValue = function()
{
	return this._invalidValue;
}

//////////////////////////////////////////////////////////////////////////////////////
function Format(options) {
	this._convert = options.convert;
	this._convertBack = options.convertBack;
	this._description = options.description;
}

Format.prototype = {
	convert: function(val) {
		if (typeof (val) == "undefined" || val == null)
			return "";

		if (val instanceof FormatIssue)
			return val.get_invalidValue();

		if (!this._convert)
			return val;

		return this._convert(val);
	},
	convertBack: function(str) {
		if (!str)
			return null;

		str = $.trim(str);

		if (str.length == 0)
			return null;

		if (!this._convertBack)
			return str;

		try {
			return this._convertBack(str);
		}
		catch (err) {
			return new FormatIssue(this._description ?
							"{value} must be formatted as " + this._description :
							"{value} is not properly formatted",
							str);
		}
	}
}

//////////////////////////////////////////////////////////////////////////////////////
// MS Ajax extensions

// Get's an DOM element's bindings
Sys.Binding.getElementBindings = function(el) {
	return el.__msajaxbindings || [];
};

// Get's the last object in the source path.  Ex: Customer.Address.Street returns the Address object.
Sys.Binding.prototype.get_finalSourceObject = function() {
	var src = this.get_source();

	for (var i = 0; i < this._pathArray.length - 1; ++i)
		src = src[this._pathArray[i]];

	return src;
};

Sys.Binding.prototype.get_finalPath = function() {
	return this._pathArray[this._pathArray.length - 1];
};

;(function() {
	function _raiseSpecificPropertyChanged(target, args) {
		var func = target.__propertyChangeHandlers[args.get_propertyName()];
		func(target);
	}

	// Converts observer events from being for ALL properties to a specific one.
	// This is an optimization that prevents handlers interested only in a single
	// property from being run with other, unrelated properties change.
	Sys.Observer.addSpecificPropertyChanged = function(target, property, handler) {
		if (!target.__propertyChangeHandlers) {
			target.__propertyChangeHandlers = {};

			Sys.Observer.addPropertyChanged(target, _raiseSpecificPropertyChanged);
		}

		var func = target.__propertyChangeHandlers[property];

		if (!func)
			target.__propertyChangeHandlers[property] = func = Functor();

		func.add(handler);
	};
})();

//////////////////////////////////////////////////////////////////////////////////////
function Functor()
{
	var funcs = [];

	var f = function()
	{
		for (var i = 0; i < funcs.length; ++i)
			funcs[i].apply(this, arguments);
	};

	f._funcs = funcs;
	f.add = Functor.add;
	f.remove = Functor.remove;

	return f;
}

Functor.add = function()
{
	for (var i = 0; i < arguments.length; ++i)
	{
		var f = arguments[i];

		if (f == null)
			continue;

		this._funcs.push(f);
	}
}

Functor.remove = function(old)
{
	for (var i = this._funcs.length - 1; i >= 0; --i)
	{
		if (this._funcs[i] === old)
		{
			this._funcs.splice(i, 1);
			break;
		}
	}
}


//////////////////////////////////////////////////////////////////////////////////////
// utilities			
Date.prototype.subtract = function(d)
{
	var diff = this - d;

	var milliseconds = Math.floor(diff % 1000);
	diff = diff / 1000;
	var seconds = Math.floor(diff % 60);
	diff = diff / 60;
	var minutes = Math.floor(diff % 60);
	diff = diff / 60;
	var hours = Math.floor(diff % 24);
	diff = diff / 24;
	var days = Math.floor(diff);

	return { days: days, hours: hours, minutes: minutes, seconds: seconds, milliseconds: milliseconds };
}

function $format(str, values)
{
	return str.replace(/{([a-z0-9_]+)}/ig, function(match, name)
	{
		var val = values[name];

		if (val === null)
			return "";
		if (typeof (val) == "undefined")
			return match;

		return val.toString();
	});
}

function $load(metadata, data) {
	var model = null;

	if (metadata) {
		model = new Model();

		for (var type in metadata) {
			model.addType(type, null, metadata[type].attributes);
		}
	}

	if (data) {
		// Note: load object depends on local "data" variable to access data for related objects
		var loadObject = function(obj, type, id, depth) {
			obj._loaded = true;

			// don't hang the browser
			if (depth > loadObject.MAX_DEPTH)
				throw ($format("Maximum recursion depth of {depth} was exceeded.", { depth: loadObject.MAX_DEPTH }));

			var objectData = data[type][id];

			for (var prop in objectData) {
				var propType = obj.type.property(prop).last().get_fullTypeName();

				if (typeof (objectData[prop]) == "undefined" || objectData[prop] == null) {
					obj[prop] = null;
				}
				else {
					if (propType == "String")
						obj[prop] = objectData[prop].toString();
					else if (propType == "Date") {
						if (objectData[prop].constructor == Date)
							obj[prop] = objectData[prop];
						else
							obj[prop] = Date.formats.$default.convertBack(objectData[prop].toString());
					}
					else if (propType == "Boolean") {
						if (objectData[prop].constructor == Boolean)
							obj[prop] = objectData[prop];
						else
							obj[prop] = Boolean.formats.$default.convertBack(objectData[prop].toString());
					}
					else if (propType == "Integer")
						obj[prop] = Number.formats.Integer.convertBack(objectData[prop].toString());
					else if (propType == "Float")
						obj[prop] = Number.formats.Float.convertBack(objectData[prop].toString());
					else {
						if (propType.indexOf("|") >= 0) {
							var typeDef = propType.split("|");
							var multiplicity = typeDef[0];
							var relatedType = typeDef[1];

							if (multiplicity == "One") {
								var ctor = window[relatedType];
								var related = obj[prop] = new ctor(objectData[prop]);
								if (!related._loaded)
									loadObject(related, relatedType, objectData[prop], depth + 1);
							}
							else if (multiplicity == "Many") {
								var src = objectData[prop];
								var dst = obj[prop] = [];
								for (var i = 0; i < src.length; i++) {
									var ctor = window[relatedType];
									var child = dst[dst.length] = new ctor(src[i]);
									if (!child._loaded)
										loadObject(child, relatedType, src[i], depth + 1);
								}
							}
							else {
								throw ($format("Unknown multiplicity \"{m}\".", { m: multiplicity }));
							}
						}
						else {
							throw ($format("Unknown property type \"{t}\".", { t: propType }));
						}
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
				if (!Array.contains(ctor.All, obj))
					Array.add(ctor.All, obj);
				if (!obj._loaded)
					loadObject(obj, type, id, 0);
			}
		}
	}

	return model;
}

; (function() {

	function getAdapter(component, targetProperty, templateContext, properties) {

		var path = properties.path || properties.$default;
		
		var props = templateContext.dataItem.meta.property(path);
		if (!props)
			throw ($format("Property \"{p}\" could not be found.", { p: path }));
			
		var dt = props.last().get_dataType();

		var format;

		if (properties.format)
			format = dt.formats[properties.format];
		else if (!(format = props.last().get_format()) && dt.formats)
			format = dt.formats.$default;

		delete properties.$default;

		return new ExoWeb.Model.Adapter(templateContext.dataItem, props, format, properties);
	}

	// Markup Extensions
	//////////////////////////////////////////////////////////////////////////////////////
	Sys.Application.registerMarkupExtension("@", getAdapter, true);
	Sys.Application.registerMarkupExtension("@=",
		function(component, targetProperty, templateContext, properties) {
			var adapter = getAdapter(component, targetProperty, templateContext, properties);

			var options = {
				source: adapter,
				path: "value",
				templateContext: templateContext,
				target: component,
				targetProperty: targetProperty
			};

			var binding = Sys.Binding.bind(options);
			templateContext.components.push(binding);
		},
		false
	);
	
})();

// Type Format Strings
/////////////////////////////////////////////////////////////////////////////////////////////////////////

//TODO: number formatting include commas
Number.formats = {
	Integer: new Format({
		description: "#,###",
		convert: function(val) {
			return Math.round(val).toString();
		},
		convertBack: function(str) {
			if (!/^([-\+])?(\d+)?\,?(\d+)?\,?(\d+)?\,?(\d+)$/.test(str))
				throw "invalid format";

			return parseInt(str, 10);
		}
	}),
	Float: new Format({
		description: "#,###.#",
		convert: function(val) {
			return val.toString();
		},
		convertBack: function(str) {
			return parseFloat(str);
		}
	})
}

Number.formats.$default = Number.formats.Float;

String.formats = {
	Phone: new Format({
		description: "###-###-####",
		convertBack: function(str) {
			if (!/^[0-9]{3}-[0-9]{3}-[0-9]{4}$/.test(str))
				throw "invalid format";

			return str;
		}
	}),
	$default: new Format({ })
}

Boolean.formats = {
	YesNo: new Format({
		convert: function(val) { return val ? "yes" : "no"; },
		convertBack: function(str) { return str == "yes"; }
	}),
	TrueFalse: new Format({
		convert: function(val) { return val ? "true" : "false"; },
		convertBack: function(str) { return (str.toLowerCase() == "true"); }
	})
};

Boolean.formats.$default = Boolean.formats.TrueFalse;

Date.formats = {
	ShortDate: new Format({
		description: "mm/dd/yyyy",
		convert: function(val) {
			return val.format("MM/dd/yyyy");
		},
		convertBack: function(str) {
			var val = Date.parseInvariant(str);

			if (val != null)
				return val;

			throw "invalid date";
		}
	})
}

Date.formats.$default = Date.formats.ShortDate;


///////////////////////////////////////////////////////////////////////////////
/// <summary>
/// Encapsulates the logic required to work with a chain of properties and
/// a root object, allowing interaction with the chain as if it were a 
/// single property of the root object.
/// </summary>
///
/// <example>
///
/// var driver = new Driver("1");
/// var chain = driver.type.property("Owner.Location.Address");
///
/// // the "Address" portion of the property
/// var addressProp = chain.last();
/// // the Address object
/// var address = chain.value(driver);
/// // the owner's locations for the given driver
/// var loc = chain.parent(driver);
///
/// var stateAbbrevProp = address.type.property("State.Abbreviation");
/// // returns a state abbreviation, like "NY"
/// var abbrev1 = stateAbbrevProp.value(address);
/// // extend the original property
/// chain.append(stateAbbrevProp);
/// // returns the same state abbreviation as above
/// var abbrev2 = chain.value(driver);
///
/// </example>
///////////////////////////////////////////////////////////////////////////////
ExoWeb.Model.PropertyChain = function(properties) {
	this._properties = properties.length ? properties : [properties];

	if (this._properties.length == 0)
		throw ("PropertyChain cannot be zero-length.");
}

ExoWeb.Model.PropertyChain.prototype = {
	parent: function(obj) {
		for (var p = 0; p < this._properties.length - 1; p++) {
			var prop = this._properties[p];
			obj = prop.value(obj);
		}
		return obj;
	},
	first: function() {
		return this._properties[0];
	},
	last: function() {
		return this._properties[this._properties.length - 1];
	},
	all: function() {
		return this._properties;
	},
	each: function(obj, callback) {
		if (!callback || typeof (callback) != "function")
			throw ("Invalid Parameter: callback function");

		if (!obj)
			throw ("Invalid Parameter: source object");

		for (var p = 0; p < this._properties.length; p++) {
			var prop = this._properties[p];
			callback(obj, prop);
			obj = prop.value(obj);
		}
	},
	append: function(prop) {
		Array.addRange(this._properties, prop.all());
	},
	value: function(obj, val) {
		if (arguments.length == 2) {
			obj = this.parent(obj);

			Sys.Observer.setValue(obj, this.last().get_name(), val);
		}
		else {
			for (var p = 0; p < this._properties.length; p++) {
				var prop = this._properties[p];
				obj = prop.value(obj);
			}
			return obj;
		}
	}
}


///////////////////////////////////////////////////////////////////////////////
ExoWeb.Model.PropertyAdapter = function(target, propertyChain) {
	this._target = target;
	this._properties = propertyChain;
}

ExoWeb.Model.PropertyAdapter.prototype = {
	addPropertyChanged: function(handler) {
		this.each(function(obj, prop) {
			Sys.Observer.addSpecificPropertyChanged(obj, prop.get_name(), handler);
		});
	},
	all: function() {
		return this._properties.all();
	},
	each: function(callback) {
		this._properties.each(this._target, callback);
	},
	target: function() {
		return this._target;
	},
	parent: function() {
		return this._properties.parent(this._target);
	},
	last: function() {
		return this._properties.last();
	},
	value: function(val) {
		if (arguments.length == 0) {
			return this._properties.value(this._target);
		}
		else {
			this._properties.value(this._target, val);
		}
	},

	// TODO:  How to handle pass-through?  Set up in constructor?
	get_containingType: function() {
		return this.last().get_containingType();
	},
	get_name: function() {
		return this.last().get_name();
	},
	get_label: function() {
		return this.last().get_label();
	},
	get_typeClass: function() {
		return this.last().get_typeClass();
	},
	get_allowedValues: function() {
		return this.last().get_allowedValues();
	}
}

///////////////////////////////////////////////////////////////////////////////
ExoWeb.Model.Adapter = function(target, propertyChain, format, options) {
	this._property = new ExoWeb.Model.PropertyAdapter(target, propertyChain);
	this._format = format;
	this._ignoreTargetEvents = false;

	// Add arbitrary options so that they are made available in templates
	var allowedOverrides = ["label", "helptext"];
	if (options) {
		for (var opt in options) {

			// Check if the option is already defined and is not available to
			// override, as in the case of critical properties (e.g.: value)
			if (this["get_" + opt] && !Array.contains(allowedOverrides, opt))
				throw ($format("{opt} is already defined.", { opt: opt }));

			var _opt = "_" + opt;
			this[_opt] = options[opt];

			// create a getter if one doesn't exist
			if (!this["get_" + opt]) {
				var type = this._property.get_containingType();
				this["get_" + opt] = type._makeGetter(this, function() { return this[_opt]; });
			}
		}
	}

	var _this = this;
	Sys.Observer.makeObservable(this);
	// subscribe to property changes at any point in the path
	this._property.addPropertyChanged(function(sender, args) {
		_this._onTargetChanged(sender, args);
	});
}

ExoWeb.Model.Adapter.prototype = {
	// Pass property change events to the target object
	///////////////////////////////////////////////////////////////////////////
	_onTargetChanged: function(sender, args) {
		if (this._ignoreTargetEvents)
			return;

		Sys.Observer.raisePropertyChanged(this, "value");
	},

	// Properties that are intended to be used by templates
	///////////////////////////////////////////////////////////////////////////
	get_label: function() {
		return this._label || this._property.get_label();
	},
	get_helptext: function() {
		return this._helptext || "";
	},
	get_options: function() {
		if (!this._options) {
			if (this._property.get_typeClass() == ModelTypeClass.Intrinsic)
				return null;

			// TODO: handle allowed values in multiple forms (function, websvc call, string path)
			var allowed = null;
			var path = this._property.get_allowedValues();
			if (path && path.length > 0) {
				var root = this._property.parent();
				var props = root.type.property(path);

				if (props) {
					// get the allowed values from the property chain
					root = props.value(root);
				}
				else {
					// if the property is not defined look for a global object by that name
					var root = window;
					var names = path.split(".");
					for (var n = 0; root && n < names.length; n++)
						root = root[names[n]];
				}

				// TODO: verify list?
				if (!root) {
					this._options = $format("Allowed values property \"{p}\" could not be found.", { p: path });
					throw (this._options);
				}

				allowed = root;
			}

			if (this._property.get_typeClass() == ModelTypeClass.Entity) {
				this._options = [];

				this._options[0] = { name: "--select--", value: "" };

				for (var a = 0; a < allowed.length; a++) {
					var opt = {
						name: allowed[a].Name,
						value: allowed[a].Id
					}

					Array.add(this._options, opt);
				}
			}
			else if (this._property.get_typeClass() == ModelTypeClass.EntityList) {
				this._options = [];

				// TODO: handle possible side-effects of get_value logic?
				var value = this.get_value();

				for (var a = 0; a < allowed.length; a++) {
					var selected = false;
					for (var s = 0; s < value.length; s++) {
						if (value[s] == allowed[a]) {
							selected = true;
						}
					}

					var opt = {
						name: allowed[a].Name,
						value: allowed[a].Id,
						selected: selected
					};

					this._options[a] = opt;
				}
			}
		}

		return this._options;
	},
	get_badValue: function() {
		return this._badValue;
	},
	get_value: function() {
		if (typeof (this._badValue) !== "undefined")
			return this._badValue;

		var value = this._property.value();

		return (this._format) ? this._format.convert(value) : value;
	},
	set_value: function(value) {
		var converted = (this._format) ? this._format.convertBack(value) : value;

		this._property.parent().meta.clearIssues(this);

		if (converted instanceof FormatIssue) {
			this._badValue = value;

			issue = new ModelIssue(
							$format(converted.get_message(), { value: this._property.get_label() }),
							[this._property.last()],
							this);

			this._property.parent().meta.issueIf(issue, true);

			// run the rules to preserve the order of issues
			this._property.parent().meta.executeRules(this._property.get_name());
		}
		else {

			var changed = this._property.value() !== converted;

			if (typeof (this._badValue) !== "undefined") {
				delete this._badValue;

				// force rules to run again in order to trigger validation events
				if (!changed)
					this._property.parent().meta.executeRules(this._property.get_name());
			}

			if (changed) {
				this._ignoreTargetEvents = true;

				try {
					this._property.value(converted);
				}
				finally {
					this._ignoreTargetEvents = false;
				}
			}
		}
	},

	// Pass validation events through to the target
	///////////////////////////////////////////////////////////////////////////
	addPropertyValidating: function(propName, handler) {
		this._property.parent().meta.addPropertyValidating(this._property.get_name(), handler);
	},
	addPropertyValidated: function(propName, handler) {
		this._property.parent().meta.addPropertyValidated(this._property.get_name(), handler);
	},

	// Override toString so that UI can bind to the adapter directly
	///////////////////////////////////////////////////////////////////////////
	toString: function() {
		return this.get_value();
	}
}

