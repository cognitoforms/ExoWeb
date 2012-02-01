jQuery.fn.control = function jQuery$control(propName, propValue) {
	if (arguments.length === 0) {
		return this.get(0).control;
	}
	else if (arguments.length == 1) {
		return this.get(0).control["get_" + propName]();
	}
	else {
		this.each(function jQuery$control$one(index, element) {
			this.control["set_" + propName](propValue);
		});
	}
};

jQuery.fn.commands = function jQuery$commands(commands) {
	var control = this.control();
	control.add_command(function jQuery$commands$command(sender, args) {
		var handler = commands[args.get_commandName()];
		if (handler) {
			handler(sender, args);
		}
	});
};

// Gets all Sys.Bindings for an element
jQuery.fn.liveBindings = function jQuery$liveBindings() {
	var bindings = [];
	this.each(function jQuery$liveBindings$one() {
		if (this.__msajaxbindings)
			Array.addRange(bindings, this.__msajaxbindings);
	});
	return bindings;
};
