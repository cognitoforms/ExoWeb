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
		forEachProperty(getProperties.apply(this, arguments), function(name, value) {
			var prop = this.meta.type.property(name, true);

			if (!prop) {
				ExoWeb.trace.throwAndLog("propInit", "Could not find property \"{0}\" on type \"{1}\".", [name, this.meta.type.get_fullName()]);
			}

			// Initialization is not force.  If the propery already has a value it will be ignored.
			prop.init(this, value);
		}, this);
	},
	set: function Entity$set(/*[properties] or [propName, propValue] */) {
		forEachProperty(getProperties.apply(this, arguments), function(name, value) {
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
	toString: function Entity$toString(formatName) {
		var format;

		if (formatName) {
			format = this.constructor.formats[formatName];

			if (!format) {
				ExoWeb.trace.throwAndLog(["formatting"], "Invalid format: {0}", arguments);
			}
		}
		else {
			format = this.constructor.formats.$display || this.constructor.formats.$system;
		}

		return format.convert(this);
	}
});

Entity.formats = {
	$system: new Format({
		undefinedString: "",
		nullString: "",
		convert: function(obj) {
			return obj.meta.type.toIdString(obj.meta.id);
		},
		convertBack: function(str) {
			// indicates "no value", which is distinct from "no selection"
			var ids = str.split("|");
			var jstype = Model.getJsType(ids[0]);
			if (jstype && jstype.meta) {
				return jstype.meta.get(ids[1]);
			}
		}
	}),
	$display: new Format({
		convert: function(obj) {
			if (obj.get_Label)
				return obj.get_Label();

			if (obj.get_Name)
				return obj.get_Name();

			if (obj.get_Text)
				return obj.get_Text();

			return $format("{0}|{1}", [obj.meta.type.get_fullName(), obj.meta.id]);
		}
	})
};

ExoWeb.Model.Entity = Entity;
Entity.registerClass("ExoWeb.Model.Entity");
