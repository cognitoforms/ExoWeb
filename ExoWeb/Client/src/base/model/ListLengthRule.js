function ListLengthRule(rootType, options) {
	/// <summary>Creates a rule that validates whether a list contains the correct number of items.</summary>
	/// <param name="rootType" type="Type">The model type the rule is for.</param>
	/// <param name="options" type="Object">
	///		The options for the rule, including:
	///			property:			the property being validated (either a Property instance or string property name)
	///			compareSource:		the optional source property to compare the list length to (either a Property or PropertyChain instance or a string property path)
	///			compareOperator:	the relational comparison operator to use (one of "Equal", "NotEqual", "GreaterThan", "GreaterThanEqual", "LessThan" or "LessThanEqual")
	///			compareValue:		the optional list length value to compare to
	///			name:				the optional unique name of the type of validation rule
	///			conditionType:		the optional condition type to use, which will be automatically created if not specified
	///			category:			ConditionType.Error || ConditionType.Warning (defaults to ConditionType.Error)
	///			message:			the message to show the user when the validation fails
	/// </param>
	/// <returns type="ListLengthRule">The new list length rule.</returns>


}

ListLengthRule.load = function ListLengthRule$load(rule, loadedType, mtype, callback, thisPtr) {
	if (!loadedType.meta.baseType || LazyLoader.isLoaded(loadedType.meta.baseType)) {
		var inputs = [];

		var targetInput = new RuleInput(rule.prop);
		targetInput.set_isTarget(true);
		if (rule.prop.get_origin() === "client")
			targetInput.set_dependsOnInit(true);
		inputs.push(targetInput);

		//no need to register the rule with the comparePath if you are using a static length
		if (rule._comparePath != "") {
			Model.property(rule._comparePath, rule.prop.get_containingType(), true, function (chain) {
				rule._compareProperty = chain;

				var compareInput = new RuleInput(rule._compareProperty);
				inputs.push(compareInput);

				rule._inited = true;

				if (chain.get_jstype() === Boolean && rule._compareOp == "NotEqual" && (rule._compareValue === undefined || rule._compareValue === null)) {
					rule._compareOp = "Equal";
					rule._compareValue = true;
				}

				Rule.register(rule, inputs, false, mtype, callback, thisPtr);
			});
		}
		else {
			//register the rule without reference to compareSource
			rule._inited = true;
			Rule.register(rule, inputs, false, mtype, callback, thisPtr);
		}
	}
	else {
		$extend(loadedType.meta.baseType.get_fullName(), function (baseType) {
			ListLengthRule.load(rule, baseType, mtype, callback, thisPtr);
		});
	}
};

ListLengthRule.prototype = {
	isValid: function Compare$isValid(obj) {
		if (!this._compareProperty && this._staticLength < 0) {
			return true;
		}

		var srcValue = this.prop.value(obj);
		var cmpValue = this._staticLength >= 0 ? this._staticLength : this._compareProperty.value(obj);

		//if the src value is not a list we are not comparing a valid object
		if (!isArray(srcValue))
			return true;

		//if the value we are comparing against is not numeric, this is not a valid comparison
		if (!isWhole(parseInt(cmpValue)))
			return true;

		return CompareRule.compare(srcValue.length, this._compareOp, parseInt(cmpValue), true);
	},
	execute: function ListLengthRule$execute(obj) {
		if (this._inited === true) {

			var isValid = this.isValid(obj);

			var message = isValid ? '' : $format("{0} length must be {1}{2} {3}", [
					this.prop.get_label(),
					ExoWeb.makeHumanReadable(this._compareOp).toLowerCase(),
					(this._compareOp === "GreaterThan" || this._compareOp == "LessThan") ? "" : " to",
					this._staticLength >= 0 ? this._staticLength : this._compareProperty.get_label()
				]);
			this.err = new Condition(this.conditionType, message, [this.prop], this);

			obj.meta.conditionIf(this.err, !isValid);
		}
		else {
			logWarning("List Length rule on type \"" + this.prop.get_containingType().get_fullName() + "\" has not been initialized.");
		}
	}
};

// expose the rule publicly
Rule.listLength = ListLengthRule;
exports.ListLengthRule = ListLengthRule;