function RuleInput(property) {
	this.property = property;
}

RuleInput.prototype = {
	set_dependsOnInit: function RuleInput$set_dependsOnInit(value) {
		this._init = value;
	},
	get_dependsOnInit: function RuleInput$get_dependsOnInit() {
		return this._init === undefined ? false : this._init;
	},
	set_dependsOnChange: function RuleInput$set_dependsOnChange(value) {
		this._change = value;
	},
	get_dependsOnChange: function RuleInput$get_dependsOnChange() {
		return this._change === undefined ? true : this._change;
	},
	set_dependsOnGet: function RuleInput$set_dependsOnGet(value) {
		this._get = value;
	},
	get_dependsOnGet: function RuleInput$get_dependsOnGet() {
		return this._get === undefined ? false : this._get;
	},
	get_isTarget: function RuleInput$get_isTarget() {
		return this._isTarget === undefined ? false : this._isTarget;
	},
	set_isTarget: function RuleInput$set_isTarget(value) {
		this._isTarget = value;
	}
};
ExoWeb.Model.RuleInput = RuleInput;
