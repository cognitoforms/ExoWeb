function Behavior(element) {
	/// <summary>
	/// </summary>
	/// <example>
	///		<div sys:attach="behavior" behavior:script="Sys.scripts.Foo" behavior:typename="My.Class" behavior:prop-foo="bar"></div>
	/// </example>

	Behavior.initializeBase(this, [element]);
}

Behavior.prototype = {
	get_script: function Behavior$get_script() {
		return this._script;
	},
	set_script: function Behavior$set_script(value) {
		this._script = value;
	},
	get_scriptObject: function Behavior$get_script() {
		if (!this._scriptObject) {
			var path = this._script.startsWith("window") ?
				this._script.substring(7) :
				this._script;

			this._scriptObject = ExoWeb.evalPath(window, path);
		}

		return this._scriptObject;
	},
	get_typeName: function Behavior$get_typeName() {
		return this._typeName;
	},
	set_typeName: function Behavior$set_typeName(value) {
		this._typeName = value;
	},

	// NOTE: Keep these properties around for backwards compatibility.
	get_class: function Behavior$get_class() {
		logWarning("The behavior:class property is deprecated (see issue #1). Consider using behavior:typename instead.");

		return this._typeName;
	},
	set_class: function Behavior$set_class(value) {
		logWarning("The behavior:class property is deprecated (see issue #1). Consider using behavior:typename instead.");

		this._typeName = value;
	},

	get_dontForceLoad: function Behavior$get_dontForceLoad() {
		return this._dontForceLoad;
	},
	set_dontForceLoad: function Behavior$set_dontForceLoad(value) {
		this._dontForceLoad = value;
	},
	get_ctorFunction: function Behavior$get_ctorFunction() {
		if (!this._ctorFunction) {
			this._ctorFunction = ExoWeb.getCtor(this._typeName);
		}

		return this._ctorFunction;
	},
	get_properties: function Behavior$get_properties() {
		if (!this._properties) {
			this._properties = {};
			for (var prop in this) {
				if (prop.startsWith("prop_") && !prop.startsWith("prop_add_")) {
					var ctor = this.get_ctorFunction();
					if (!ctor) {
						throw new Error($format("Could not evaulate type '{0}'.", this._typeName));
					}

					var name = Sys.Application._mapToPrototype(prop.substring(5), ctor);

					if (!name) {
						throw new Error($format("Property '{0}' could not be found on type '{1}'.", prop.substring(5), this._typeName));
					}

					this._properties[name] = this[prop];
				}
			}
		}

		return this._properties;
	},
	get_events: function Behavior$get_events() {
		if (!this._events) {
			this._events = {};
			for (var prop in this) {
				if (prop.startsWith("prop_add_")) {
					var ctor = this.get_ctorFunction();
					if (!ctor) {
						throw new Error($format("Could not evaulate type '{0}'.", this._typeName));
					}

					var name = Sys.Application._mapToPrototype(prop.substring(9), ctor);

					if (!name) {
						throw new Error($format("Event '{0}' could not be found on type '{1}'.", prop.substring(9), this._typeName));
					}

					this._events[name] = this[prop];
				}
			}
		}

		return this._events;
	},
	_create: function Behavior$create() {
		// if the element is not within the document body it 
		// probably means that it is being removed - TODO: verify
		if (!jQuery.contains(document.body, this._element)) {
			return;
		}

		this._behavior = $create(this.get_ctorFunction(), this.get_properties(), this.get_events(), null, this._element);
	},
	initialize: function Behavior$initialize() {
		Behavior.callBaseMethod(this, "initialize");

		if (!this._dontForceLoad) {
			Sys.require([this.get_scriptObject()], this._create.bind(this));
		}
		else {
			this._create();
		}
	}
};

ExoWeb.UI.Behavior = Behavior;
Behavior.registerClass("ExoWeb.UI.Behavior", Sys.UI.Control);
