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
			var prop = this.meta.type.property(name);

			if (!prop) {
				throw new Error("Could not find property \"" + name + "\" on type \"" + this.meta.type.get_fullName() + "\".");
			}

			// Initialization is not force.  If the propery already has a value it will be ignored.
			Property$_init.call(prop, this, value);
		}, this);
	},
	set: function Entity$set(/*[properties] or [propName, propValue] */) {
		forEachProperty(getProperties.apply(this, arguments), function (name, value) {
			var prop = this.meta.type.property(name);
			if (!prop) {
				throw new Error("Could not find property \"" + name + "\" on type \"" + this.meta.type.get_fullName() + "\".");
			}

			Property$_setter.call(prop, this, value, false);
		}, this);
	},
	get: function Entity$get(propName) {
		return this.meta.type.property(propName).value(this);
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
	// Typed identifiers take the form "type|id".
	var ids = id.split("|");

	// Use the left-hand portion of the id string as the object's type.
	var jstype = ExoWeb.Model.Model.getJsType(ids[0]);

	// Retrieve the object with the given id.
	return jstype.meta.get(ids[1],
		// Typed identifiers may or may not be the exact type of the instance.
		// An id string may be constructed with only knowledge of the base type.
		false
	);
};

exports.Entity = Entity;
