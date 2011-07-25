function ToggleGroup(element) {
	ToggleGroup.initializeBase(this, [element]);
}

ToggleGroup.mixin({
	_execute: function ToggleGroup$_execute() {
		if (this._visible.length === 0 && this._children.length > 0) {
			$(this._element).hide();
		}
		else {
			$(this._element).show();
		}
	},
	_toggleAdded: function ToggleGroup$_toggleAdded(idx, elem) {
		if (elem.control.get_groupName() === this._name && !Array.contains(this._children, elem)) {
			this._children.push(elem);
			
			if ($(elem).is(":visible")) {
				this._add(elem);
			}

			elem.control.add_shown(this._shownHandler);
			elem.control.add_hidden(this._hiddenHandler);
		}
	},
	_toggleRemoved: function ToggleGroup$_toggleRemoved(idx, elem) {
		if (Array.contains(this._children, elem)) {
			elem.control.remove_shown(this._shownHandler);
			elem.control.remove_hidden(this._hiddenHandler);

			this._remove(elem);
			this._children.remove(elem);
			this._execute();
		}
	},
	_toggleShown: function ToggleGroup$_toggleShown(sender) {
		this._add(sender.get_element());
		this._execute();
	},
	_toggleHidden: function ToggleGroup$_toggleHidden(sender) {
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

		this._shownHandler = this._toggleShown.bind(this);
		this._hiddenHandler = this._toggleHidden.bind(this);

		$(":toggle", this._element).ever(this._toggleAdded.bind(this), this._toggleRemoved.bind(this));

		this._execute();
	}
});

ExoWeb.UI.ToggleGroup = ToggleGroup;
ToggleGroup.registerClass("ExoWeb.UI.ToggleGroup", Sys.UI.Control);
