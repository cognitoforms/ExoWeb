function TimeSpan(ms) {
	this.totalMilliseconds = ms;
	this.totalSeconds = this.totalMilliseconds / 1000;
	this.totalMinutes = this.totalSeconds / 60;
	this.totalHours = this.totalMinutes / 60;
	this.totalDays = this.totalHours / 24;

	this.milliseconds = Math.floor(ms % 1000);
	ms = ms / 1000;
	this.seconds = Math.floor(ms % 60);
	ms = ms / 60;
	this.minutes = Math.floor(ms % 60);
	ms = ms / 60;
	this.hours = Math.floor(ms % 24);
	ms = ms / 24;
	this.days = Math.floor(ms);
}

window.TimeSpan = TimeSpan;

Date.mixin({
	subtract: function Date$subtract(d) {
		return new TimeSpan(this - d);
	},
	add: function Date$add(timeSpan) {
		return new Date(this.getTime() + timeSpan.totalMilliseconds);
	}
});
