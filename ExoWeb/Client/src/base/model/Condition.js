/// <reference path="Type.js" />
/// <reference path="ObjectMeta.js" />
/// <reference path="Entity.js" />
/// <reference path="Property.js" />
/// <reference path="PathToken.js" />
/// <reference path="ConditionTarget.js" />

function Condition(type, message, target, properties, origin) {
	/// <summary>Represents an instance of a condition of a specific type associated with one or more entities in a model.</summary>
    /// <param name="type" type="ConditionType">The type of condition, which usually is an instance of a subclass like Error, Warning or Permission.</param>
    /// <param name="message" type="String">The optional message to use for the condition, which will default to the condition type message if not specified.</param>
	/// <param name="target" type="Entity">The root target entity the condition is associated with.</param>
    /// <param name="properties" type="Array" elementType="String">The set of property paths specifying which properties and entities the condition should be attached to.</param>
	/// <param name="origin" type="String">The original source of the condition, either "client" or "server".</param>
	/// <returns type="Condition">The new condition instance.</returns>

	/// <field name="type" type="ConditionType">The type of condition, which usually is an instance of a subclass like Error, Warning or Permission.</field>
	/// <field name="message" type="String">The optional message to use for the condition, which will default to the condition type message if not specified.</field>
	/// <field name="origin" type="String">The original source of the condition, either "client" or "server".</field>
	/// <field name="targets" type="Array" elementType="ConditionTarget">The set of condition targets that link the condition to specific entities and properties.</field>

	Object.defineProperty(this, "type", { value: type });
	Object.defineProperty(this, "message", { value: message || (type ? type.message : undefined) });
	Object.defineProperty(this, "origin", { value: origin });

	var targets = [];

	// create targets if a root was specified
	if (target) {

		// set the properties to an empty array if not specified and normalize the paths to expand {} syntax if used
		properties = PathTokens.normalizePaths(properties || []);

		// create a single condition target if the specified properties are all on the root
		if (properties.every(function (p) { return p.length === 1; }))
			targets.push(new ConditionTarget(this, target, properties));

		// otherwise, process the property paths to create the necessary sources
		else {
			// process each property path to build up the condition sources
			for (var p = properties.length - 1; p >= 0; p--) {
				var steps = properties[p].steps;
				var instances = [target];

				// iterate over each step along the path
				for (var s = steps.length - 1; s >= 0; s--) {
					var step = steps[s].property;
					var childInstances = [];

					// create condition targets for all instances for the current step along the path
					for (var i = instances.length - 1; i >= 0; i--) {
						var instance = instances[i];

						// see if a target already exists for the current instance
						var conditionTarget = null;
						for (var t = targets.length - 1; t >= 0; t--) {
							if (targets[t].target === instance) {
								conditionTarget = targets[t];
								break;
							}
						}

						// get the property for the current step and instance type and skip if the property cannot be found
						var property = instance.meta.type.property(step);
						if (!property) {
							continue;
						}

						// create the condition target if it does not already exist
						if (!conditionTarget) {
							conditionTarget = new ConditionTarget(this, instance, [property]);
							targets.push(conditionTarget);
						}

						// otherwise, just ensure it references the current step
						else if (conditionTarget.properties.indexOf(property) < 0)
							conditionTarget.properties.push(property);

						// get the value of the current step
						var child = property.value(instance);

						// add the children, if any, to the set of child instances to process for the next step
						if (child instanceof Entity)
							childInstances.push(child);
						else if (child instanceof Array && child.length > 0 && child[0] instanceof Entity)
							childInstances.concat(child);
					}

					// assign the set of instances to process for the next step
					instances = childInstances;
				}
			}
		}
	}

	// store the condition targets
	Object.defineProperty(this, "targets", { value: targets });

	// raise events for the new condition
	if (this.type != formatConditionType) {
		for (var t = targets.length - 1; t >= 0; t--) {
			var conditionTarget = targets[t];
			conditionTarget.target.meta._raiseEvent("conditionsChanged", [conditionTarget.target.meta, { conditionTarget: conditionTarget, add: true, remove: false}]);
		}
	}
}

// implementation
Condition.mixin({
	destroy: function Condition$destroy() {
		/// <summary>Removes the condition targets from all target instances and raises condition change events.</summary>

		for (var t = this.targets.length - 1; t >= 0; t--) {
			var conditionTarget = this.targets[t];
			conditionTarget.target.meta.clearCondition(conditionTarget.condition.type);
			conditionTarget.target.meta._raiseEvent("conditionsChanged", [conditionTarget.target.meta, { conditionTarget: conditionTarget, add: false, remove: true}]);
		}

		// remove references to all condition targets
		this.targets.slice(0, 0);
	},
	toString: function Condition$toString() {
		return this.message;
	}
});

// Expose the type publicly
ExoWeb.Model.Condition = Condition;
