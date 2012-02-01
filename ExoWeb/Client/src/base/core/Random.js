function randomInteger(min, max) {
	var scale;
	if (arguments.length === 0) {
		min = 0;
		max = 9;
	}
	else if (arguments.length === 1) {
		if (!isInteger(min)) {
			throw new Error("Minimum argument must be an integer.");
		}

		if (min < 0) {
			max = 0;
		}
		else {
			max = min;
			min = 0;
		}
	}
	else if (!isInteger(min)) {
		throw new Error("Minimum argument must be an integer.");
	}
	else if (!isInteger(max)) {
		throw new Error("Maximum argument must be an integer.");
	}
	else if (min >= max) {
		throw new Error("Minimum argument must be less than maximum argument.");
	}

	return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.randomInteger = randomInteger;

function randomText(len) {
	if (arguments.length === 0) {
		throw new Error("Length argument is required.");
	}
	else if (!isNatural(len)) {
		throw new Error("Length argument must be a natural number.");
	}

	var result = "";
	for (var i = 0; i < len; i++) {
		result += String.fromCharCode(randomInteger(97, 122));
	}
	return result;
}

exports.randomText = randomText;
