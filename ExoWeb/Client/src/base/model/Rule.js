function Rule() { }

Rule.register = function Rule$register(rule, inputs, isAsync, typeFilter, callback, thisPtr) {
	rule.isAsync = !!isAsync;

	rule.inputs = inputs.map(function(item) {
		if (item instanceof RuleInput) {
			return item;
		}
		else {
			var input = new RuleInput(item);
			if(item.get_origin() === "client")
				input.set_dependsOnInit(true);

			// If inputs are not setup up front then they are 
			// assumed to be a target of the rule.

			input.set_isTarget(true);
			return input;
		}
	});

	// If the type filter was not specified then assume 
	// the containing type of the first input property.
	if (arguments.length < 4) {
		typeFilter = rule.inputs[0].property.get_containingType();
	}

	// register the rule after loading has completed
	typeFilter.get_model().addBeforeContextReady(function() {
		typeFilter.addRule(rule);
		if(callback)
			callback.call(thisPtr || this, rule);
	});
};

Rule.canExecute = function(rule, sender, args) {
	return rule.inputs.every(function(input) { return (args && input.property === args.property) || !input.get_dependsOnInit() || input.property.isInited(sender); });
};

Rule.ensureError = function Rule$ensureError(ruleName, prop) {
	var generatedCode = $format("{0}.{1}.{2}", [prop.get_containingType().get_fullName(), prop.get_label(), ruleName]);
	var counter = "";

	while(ConditionType.get(generatedCode + counter))
		counter++;

	return new ConditionType.Error(generatedCode + counter, $format("Generated condition type for {0} rule.", [ruleName]));
};

Rule.ensureWarning = function Rule$ensureWarning(ruleName, prop, dependsOn) {
	var generatedCode = $format("{0}.{1}.{2}", [prop.get_containingType().get_fullName(), prop.get_label(), ruleName]);
	var counter = "";

	while(ConditionType.get(generatedCode + counter))
		counter++;

	return new ConditionType.Warning(generatedCode + counter, $format("Generated condition type for {0} rule.", [ruleName]));
};

Rule.inferInputs = function Rule$inferInputs(rootType, func) {
	var inputs = [];
	var expr = /this\.get_([a-zA-Z0-9_.]+)/g;

	var match = expr.exec(func.toString());
	while (match) {
		inputs.push(new RuleInput(rootType.property(match[1]).lastProperty()));
		match = expr.exec(func.toString());
	}

	return inputs;
};

Rule.isValidation = function Rule$isValidation(rule) {
	return rule.ctype && rule.ctype instanceof ExoWeb.Model.ConditionType.Error;
};

ExoWeb.Model.Rule = Rule;
