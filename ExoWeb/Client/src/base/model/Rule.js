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
			callback.apply(thisPtr || this);
	});
};

Rule.ensureError = function Rule$ensureError(ruleName, prop) {
	var generatedCode = $format("{0}.{1}.{2}", [prop.get_containingType().get_fullName(), prop.get_label(), ruleName]);
	var conditionType = ConditionType.get(generatedCode);

	if (!conditionType) {
		conditionType = new ConditionType.Error(generatedCode, $format("Generated condition type for {0} rule.", [ruleName]));
		return conditionType;
	}
	else if (conditionType instanceof ConditionType.Error) {
		return conditionType;
	}
	else {
		ExoWeb.trace.throwAndLog("conditions", "Condition type \"{0}\" already exists but is not an error.", [generatedCode]);
	}
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

ExoWeb.Model.Rule = Rule;
Rule.registerClass("ExoWeb.Model.Rule");
