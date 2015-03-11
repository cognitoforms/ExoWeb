var dayOfWeek = {};
var days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
days.forEach(function(day, i) {
	dayOfWeek[day] = i;
});

Date.prototype.toDate = function toDate() {
	return new Date(this.getFullYear(), this.getMonth(), this.getDate());
};

Date.prototype.addYears = function addYears(numYears) {
	return new Date(this.getFullYear() + numYears, this.getMonth(), this.getDate(), this.getHours(), this.getMinutes(), this.getSeconds(), this.getMilliseconds());
};

Date.prototype.addDays = function addDays(numDays, requireWeekDay) {
	var date = new Date(this.getFullYear(), this.getMonth(), this.getDate() + numDays, this.getHours(), this.getMinutes(), this.getSeconds(), this.getMilliseconds());

	// If requireWeekDay is true and the day falls on a Saturday or Sunday, then
	// the the result will be moved back to the preceeding friday (when subtracting days)
	// or forward to the next monday (when adding days).
	if (requireWeekDay === true) {
		// Sunday
		if (date.getDay() === 0) {
			date.setDate(date.getDate() + (numDays >= 0 ? 1 : -2));
		}
		// Saturday 
		else if (date.getDay() === 6) {
			date.setDate(date.getDate() + (numDays >= 0 ? 2 : -1));
		}
	}

	return date;
};

var oneHourInMilliseconds = 1000 * 60 * 60;

Date.prototype.addHours = function addHours(numHours) {
	return new Date(+this + (oneHourInMilliseconds * numHours));
};

function getDayOfWeek(day) {
	if (day !== undefined && day !== null && day.constructor === String)
		day = days.indexOf(day.toLowerCase());
	else if (day !== undefined && day !== null && day.constructor !== Number)
		day = null;

	return day >= 0 && day < days.length ? day : null;
}

exports.getDayOfWeek = getDayOfWeek; // IGNORE

Date.prototype.startOfWeek = function(startOfWeekDay) {
	var startOfWeek = getDayOfWeek(startOfWeekDay) || dayOfWeek.monday; // monday by default
	return this.addDays(startOfWeek - this.getDay());
};

Date.prototype.weekOfYear = function(startOfWeekDay) {
	var startOfWeek = getDayOfWeek(startOfWeekDay) || dayOfWeek.monday; // monday by default

	if (this.startOfWeek(startOfWeek).getYear() < this.getYear()) {
		return 0;
	}

	var firstDayOfYear = new Date(this.getFullYear(), 0, 1);
	var firstWeek = firstDayOfYear.startOfWeek(startOfWeek);
	if (firstWeek.getFullYear() < firstDayOfYear.getFullYear()) {
		firstWeek = firstWeek.addDays(7);
	}

	var weeks = 0;
	var target = this.toDate();
	for (var day = firstWeek; day <= target; day = day.addDays(7)) {
		weeks++;
	}

	return weeks;
};

Date.prototype.weekDifference = function (other, startOfWeek) {
	var isNegative = other <= this;
	var a = this, b = other;

	if (isNegative)
	{
		a = other;
		b = this;
	}

	var aWeek = a.weekOfYear(startOfWeek);
	var bWeek = b.weekOfYear(startOfWeek);

	for (var i = a.getFullYear(); i < b.getFullYear(); i++)
		bWeek += (new Date(i, 11, 31)).weekOfYear(startOfWeek);

	return isNegative ? aWeek - bWeek : bWeek - aWeek;
};

Date.prototype.isDaylightSavingTime = function() {
	// http://stackoverflow.com/a/11888430/170990
	var jan = new Date(this.getFullYear(), 0, 1);
	var jul = new Date(this.getFullYear(), 6, 1);
	var stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
	return this.getTimezoneOffset() < stdOffset;
};
