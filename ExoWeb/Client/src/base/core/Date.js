var dayOfWeek = {};
["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].forEach(function(day, i) {
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

Date.prototype.startOfWeek = function() {
	return this.addDays(dayOfWeek.monday - this.getDay());
};
