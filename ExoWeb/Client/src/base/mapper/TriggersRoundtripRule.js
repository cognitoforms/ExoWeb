function TriggerRoundtripRule(property) {
	var prop = this.prop = property;

	ExoWeb.Model.Rule.register(this, [property], true, property._containingType);
}

TriggerRoundtripRule.prototype = {
	execute: function(obj, callback) {
		ServerSync.Roundtrip(obj, callback, callback);
	},
	toString: function() {
		return "trigger roundtrip";
	}
};

ExoWeb.Mapper.TriggerRoundtripRule = ExoWeb.Model.Rule.triggerRoundtrip = TriggerRoundtripRule;

ExoWeb.Model.Property.mixin({
	triggersRoundtrip: function () {
		if (!this._triggersRoundtrip) {
			var rule = new TriggerRoundtripRule(this);
			this._triggersRoundtrip = true;
		}
	}
});
