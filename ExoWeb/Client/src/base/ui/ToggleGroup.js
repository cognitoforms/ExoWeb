function ToggleGroup(element) {
	ToggleGroup.initializeBase(this, [element]);
}

ToggleGroup.mixin({
	_execute: function ToggleGroup$_execute() {
		if (this._visible.length === 0 && this._children.length > 0) {
			jQuery(this._element).hide();
		}
		else {
			jQuery(this._element).show();
		}
	},
	_toggleAdded: function ToggleGroup$_toggleAdded(idx, elem) {
		if (elem.control.get_groupName() === this._name && !Array.contains(this._children, elem)) {
			this._children.push(elem);

			if (elem.control.get_state() === "on") {
				this._add(elem);
			}

			elem.control.add_on(this._onHandler);
			elem.control.add_off(this._offHandler);
		}
	},
	_toggleRemoved: function ToggleGroup$_toggleRemoved(idx, elem) {
		if (Array.contains(this._children, elem)) {
			elem.control.remove_on(this._onHandler);
			elem.control.remove_off(this._offHandler);

			this._remove(elem);
			this._children.remove(elem);
			this._execute();
		}
	},
	_toggleOn: function ToggleGroup$_toggleOn(sender) {
		this._add(sender.get_element());
		this._execute();
	},
	_toggleOff: function ToggleGroup$_toggleOff(sender) {
		this._remove(sender.get_element());
		this._execute();
	},
	get_name: function ToggleGroup$get_name() {
		return this._name;
	},
	set_name: function ToggleGroup$set_name(value) {
		this._name = value;
	},
	_add: function (elem) {
		if (this._visible.indexOf(elem) < 0)
			this._visible.push(elem);
	},
	_remove: function (elem) {
		this._visible.remove(elem);
	},
	initialize: function ToggleGroup$initialize() {
		ToggleGroup.callBaseMethod(this, "initialize");

		this._children = [];
		this._visible = [];

		this._onHandler = this._toggleOn.bind(this);
		this._offHandler = this._toggleOff.bind(this);

		jQuery(":toggle", this._element).ever(this._toggleAdded.bind(this), this._toggleRemoved.bind(this));

		this._execute();
	}
});

ExoWeb.UI.ToggleGroup = ToggleGroup;
ToggleGroup.registerClass("ExoWeb.UI.ToggleGroup", Sys.UI.Control);
