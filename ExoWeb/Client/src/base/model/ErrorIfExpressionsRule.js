function ErrorIfExpressionsRule(mtype, options, ctype, callback, thisPtr) {
	this.prop = mtype.property(options.property, true);
	var properties = [ this.prop ];

	this._evaluationFunction = options.fn;
	this._dependsOn = options.dependsOn;
	this._errorMessage = options.errorMessage;
	this._isWarning = options.isWarning;

	if (!ctype && !this._isWarning) {
		ctype = Rule.ensureError("errorIfExpressions", this.prop);
	}
	else if(!ctype && this._isWarning) {
		ctype = Rule.ensureWarning("errorIfExpressions", this.prop);
	}

	if(this._evaluationFunction === undefined || this._evaluationFunction === null || !(this._evaluationFunction instanceof Function)) {
		ExoWeb.trace.logError("rule",
				"Rule configuration error - {0}:  you must define an evaluation function.",
				[this._expressions]);
		return;
	}

	if(this._dependsOn === undefined || this._dependsOn === null || !(this._dependsOn instanceof Array)) {
		ExoWeb.trace.logError("rule",
				"Rule configuration error - {0}:  you must setup dependencies for ErrorIfExpression",
				[this._expressions]);
		return;
	}

	this._inited = false;
	this.err = new Condition(ctype, this._errorMessage, properties, this);

	// Function to register this rule when its containing type is loaded.
	var register = (function ErrorIfExpressionsRule$register(ctype) { this.load(this, ctype, mtype, callback, thisPtr); }).bind(this);

	// If the type is already loaded, then register immediately.
	if (LazyLoader.isLoaded(this.prop.get_containingType())) {
		register(this.prop.get_containingType().get_jstype());
	}
	// Otherwise, wait until the type is loaded.
	else {
		$extend(this.prop.get_containingType().get_fullName(), register);
	}
}

ErrorIfExpressionsRule.prototype = {
	load: function ErrorIfExpressionsRule$load(rule, loadedType, mtype, callback, thisPtr) {
		if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
			var inputs = [];

			var targetInput = new RuleInput(rule.prop);
			targetInput.set_isTarget(true);
			if (rule.prop.get_origin() === "client")
				targetInput.set_dependsOnInit(true);
			inputs.push(targetInput);

			for(var i = 0; i < rule._dependsOn.length; i++) {
				Model.property(rule._dependsOn[i], rule.prop.get_containingType(), true, function(chain) {
					rule._dependsOn[i] = chain;

					var watchPathInput = new RuleInput(rule._dependsOn[i]);
					inputs.push(watchPathInput);

					Rule.register(rule, inputs, false, mtype, callback, thisPtr);

					rule._inited = true;
				});
			}
		}
		else {
			$extend(loadedType.meta.baseType.get_fullName(), function(baseType) {
				ErrorIfExpressionsRule.load(rule, baseType);
			});
		}
	},
	evaluate: function ErrorIfExpressionsRule$required(obj) {
		return this._evaluationFunction.apply(obj,[ obj["get_" + this.prop.get_name()]() ]);
	},
	satisfies: function ErrorIfRule$satisfies(obj) {
		return !this.evaluate(obj);
	},
	execute: function ErrorIfRule$execute(obj) {
		if (this._inited === true) {
			obj.meta.conditionIf(this.err, !this.satisfies(obj));
		}
		else {
			ExoWeb.trace.logWarning("rule", "ErrorIf rule on type \"{0}\" has not been initialized.", [this.prop.get_containingType().get_fullName()]);
		}
	}
};

Rule.errorIfExpressions = ErrorIfExpressionsRule;