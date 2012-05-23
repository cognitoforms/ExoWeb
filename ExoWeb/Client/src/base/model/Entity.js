function Entity() {
}

function forEachProperty(obj, callback, thisPtr) {
	for (var prop in obj) {
		callback.call(thisPtr || this, prop, obj[prop]);
	}
}

function getProperties(/*[properties] or [propName, propValue] */) {
	if (arguments.length === 2) {
		var properties = {};
		properties[arguments[0]] = arguments[1];
		return properties;
	}
	else {
		return arguments[0];
	}
}

Entity.mixin({
	init: function Entity$init(/*[properties] or [propName, propValue] */) {
		forEachProperty(getProperties.apply(this, arguments), function (name, value) {
			var prop = this.meta.type.property(name, true);

			if (!prop) {
				ExoWeb.trace.throwAndLog("propInit", "Could not find property \"{0}\" on type \"{1}\".", [name, this.meta.type.get_fullName()]);
			}

			// Initialization is not force.  If the propery already has a value it will be ignored.
			prop.init(this, value);
		}, this);
	},
	set: function Entity$set(/*[properties] or [propName, propValue] */) {
		forEachProperty(getProperties.apply(this, arguments), function (name, value) {
			this._accessor("set", name).call(this, value);
		}, this);
	},
	get: function Entity$get(propName) {
		return this._accessor("get", propName).call(this);
	},
	_accessor: function Entity$_accessor(getOrSet, property) {
		var fn = this[getOrSet + "_" + property];

		if (!fn) {
			ExoWeb.trace.throwAndLog("model", "Unknown property: {0}.{1}", [this.meta.type.get_fullName(), property]);
		}

		return fn;
	},
	toString: function Entity$toString(format) {
		if (format) {
			format = getFormat(this.constructor, format);
		}
		else {
			format = this.meta.type.get_format();
		}

		if (format)
			return format.convert(this);
		else
			return Entity.toIdString(this);
	}
});

// Gets the typed string id suitable for roundtripping via fromIdString
Entity.toIdString = function Entity$toIdString(obj) {
	return $format("{0}|{1}", [obj.meta.type.get_fullName(), obj.meta.id]);
};

// Gets or loads the entity with the specified typed string id
Entity.fromIdString = function Entity$fromIdString(id) {
	var ids = id.split("|");
	var jstype = ExoWeb.Model.Model.getJsType(ids[0]);
	return jstype.meta.get(ids[1]);
};

exports.Entity = Entity;
