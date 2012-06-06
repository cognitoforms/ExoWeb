function TimeSpan(ms) {
	/// <field name="totalSeconds" type="Number">The target entity the condition is associated with.</field>

	this.totalMilliseconds = ms;

	initializeLegacyProperties(this);
}

TimeSpan.mixin({
	totalSeconds: { get: function () { return this.totalMilliseconds / 1000; }, init: true },
	totalMinutes: { get: function () { return this.totalSeconds / 60; }, init: true },
	totalHours: { get: function () { return this.totalMinutes / 60; }, init: true },
	totalDays: { get: function () { return this.totalHours / 24; }, init: true },
	milliseconds: { get: function () { return Math.floor(this.totalMilliseconds % 1000); }, init: true },
	seconds: { get: function () { return Math.floor(this.totalSeconds % 60); }, init: true },
	minutes: { get: function () { return Math.floor(this.totalMinutes % 60); }, init: true },
	hours: { get: function () { return Math.floor(this.totalHours % 24); }, init: true },
	days: { get: function () { return Math.floor(this.totalDays); }, init: true },
	toObject: function() {
		return {
			Hours: this.hours,
			Minutes: this.minutes,
			Seconds: this.seconds,
			Milliseconds: this.milliseconds,
			Ticks: this.totalMilliseconds * 1000000 / 100,
			Days: this.days,
			TotalDays: this.totalDays,
			TotalHours: this.totalHours,
			TotalMilliseconds: this.totalMilliseconds,
			TotalMinutes: this.totalMinutes,
			TotalSeconds: this.totalSeconds
		};
	},
	valueOf: function() {
		return this.totalMilliseconds;
	},
	toString: function TimeSpan$toString() { 
		var num;
		var label;

		if (this.totalHours < 1) {
			num = Math.round(this.totalMinutes);
			label = "minute";
		}
		else if (this.totalDays < 1) {
			num = Math.round(this.totalHours * 100) / 100;
			label = "hour";
		}
		else {
			num = Math.round(this.totalDays * 100) / 100;
			label = "day";
		}

		return num == 1 ? (num + " " + label) : (num + " " + label + "s");
	}
});

window.TimeSpan = TimeSpan;

Date.mixin({
	subtract: function Date$subtract(d) {
		return new TimeSpan(this - d);
	},
	add: function Date$add(timeSpan) {
		return new Date(this.getTime() + timeSpan.totalMilliseconds);
	}
});