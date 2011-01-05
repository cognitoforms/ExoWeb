function Condition(type, message, relatedProperties, origin) {
	this._type = type;
	this._properties = relatedProperties || [];
	this._message = message;
	this._origin = origin;
	this._targets = [];

	Sys.Observer.makeObservable(this._targets);
}

Condition.prototype = {
	get_type: function Condition$get_type() {
		return this._type;
	},
	get_properties: function Condition$get_properties() {
		return this._properties;
	},
	get_message: function Condition$get_message() {
		return this._message;
	},
	get_origin: function Condition$get_origin() {
		return this._origin;
	},
	set_origin: function Condition$set_origin(origin) {
		this._origin = origin;
	},
	get_targets: function Condition$get_targets() {
		return this._targets;
	},
	equals: function Condition$equals(o) {
		return o.property.equals(this.property) && o._message.equals(this._message);
	}
};

ExoWeb.Model.Condition = Condition;
Condition.registerClass("ExoWeb.Model.Condition");
