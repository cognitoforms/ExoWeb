function Behavior(element) {
	/// <summary>
	/// </summary>
	/// <example>
	///		<div sys:attach="behavior" behavior:script="Sys.scripts.Foo" behavior:class="My.Class" behavior:prop-foo="bar"></div>
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
	get_class: function Behavior$get_class() {
		return this._class;
	},
	set_class: function Behavior$set_class(value) {
		this._class = value;
	},
	get_dontForceLoad: function Behavior$get_dontForceLoad() {
		return this._dontForceLoad;
	},
	set_dontForceLoad: function Behavior$set_dontForceLoad(value) {
		this._dontForceLoad = value;
	},
	get_classObject: function Behavior$get_classObject() {
		if (!this._classObject) {
			this._classObject = ExoWeb.getCtor(this._class);
		}

		return this._classObject;
	},
	get_properties: function Behavior$get_properties() {
		if (!this._properties) {
			this._properties = {};
			for (var prop in this) {
				if (prop.startsWith("prop_") && !prop.startsWith("prop_add_")) {
					var name = Sys.Application._mapToPrototype(prop.substring(5), this.get_classObject());

					if (!name) {
						ExoWeb.trace.throwAndLog("ui",
							"Property '{0}' could not be found on type '{1}'.",
							[prop.substring(5), this._class]);
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
					var name = Sys.Application._mapToPrototype(prop.substring(9), this.get_classObject());

					if (!name) {
						ExoWeb.trace.throwAndLog("ui",
							"Event '{0}' could not be found on type '{1}'.",
							[prop.substring(9), this._class]);
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
		if (!$.contains(document.body, this._element)) {
			return;
		}

		this._behavior = $create(this.get_classObject(), this.get_properties(), this.get_events(), null, this._element);
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
