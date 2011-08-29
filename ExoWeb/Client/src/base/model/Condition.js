function Condition(type, message, relatedProperties, origin) {
	this._type = type;
	this._properties = relatedProperties || [];
	this._message = message;
	this._origin = origin;
	this._targets = [];

	Sys.Observer.makeObservable(this._targets);
}

Condition.prototype = {
	get_type: function () {
		return this._type;
	},
	get_properties: function () {
		return this._properties;
	},
	get_message: function () {
		return this._message;
	},
	set_message: function (message) {
		this._message = message;
	},
	get_origin: function () {
		return this._origin;
	},
	set_origin: function (origin) {
		this._origin = origin;
	},
	get_targets: function () {
		return this._targets;
	},
	equals: function (other) {
		return this._type === other._type &&
			this._properties.length === other._properties.length &&
			!some(this._properties, function(p, i) { return p !== other._properties[i]; }) &&
			(!this._origin || !other._origin || this._origin === other._origin);
	}
};

ExoWeb.Model.Condition = Condition;
Condition.registerClass("ExoWeb.Model.Condition");
