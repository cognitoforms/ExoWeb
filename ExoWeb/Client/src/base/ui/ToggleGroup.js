function ToggleGroup(element) {
	ToggleGroup.initializeBase(this, [element]);
}

ToggleGroup.mixin({
	_execute: function ToggleGroup$_execute() {
		if (this._counter === 0 && this._children.length > 0) {
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
				this._counter++;
			}

			elem.control.add_shown(this._shownHandler);
			elem.control.add_hidden(this._hiddenHandler);
		}
	},
	_toggleRemoved: function ToggleGroup$_toggleRemoved(idx, elem) {
		if (Array.contains(this._children, elem)) {
			elem.control.remove_shown(this._shownHandler);
			elem.control.remove_hidden(this._hiddenHandler);

			if ($(elem).is(":visible")) {
				this._counter--;
			}

			Array.remove(this._children, elem);
		}
	},
	_toggleShown: function ToggleGroup$_toggleShown() {
		this._counter++;
		this._execute();
	},
	_toggleHidden: function ToggleGroup$_toggleHidden() {
		this._counter--;
		this._execute();
	},
	get_name: function ToggleGroup$get_name() {
		return this._name;
	},
	set_name: function ToggleGroup$set_name(value) {
		this._name = value;
	},
	initialize: function ToggleGroup$initialize() {
		ToggleGroup.callBaseMethod(this, "initialize");

		this._children = [];
		this._counter = 0;

		this._shownHandler = this._toggleShown.bind(this);
		this._hiddenHandler = this._toggleHidden.bind(this);

		$(":toggle", this._element).ever(this._toggleAdded, this._toggleRemoved, this);

		this._execute();
	}
});

ExoWeb.UI.ToggleGroup = ToggleGroup;
ToggleGroup.registerClass("ExoWeb.UI.ToggleGroup", Sys.UI.Control);
