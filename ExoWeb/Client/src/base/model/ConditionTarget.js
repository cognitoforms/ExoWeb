/// <reference path="Entity.js" />
/// <reference path="Property.js" />
/// <reference path="Condition.js" />

function ConditionTarget(condition, target, properties) {
	/// <summary>Represents the association of a condition to a specific target entity.</summary>
	/// <param name="condition" type="Condition">The condition the target is for.</param>
	/// <param name="target" type="Entity">The target entity the condition is associated with.</param>
	/// <param name="properties" type="Array" elementType="Property">The set of properties on the target entity the condition is related to.</param>
	/// <returns type="ConditionTarget">The new condition target.</returns>

    /// <field name="target" type="Entity">The target entity the condition is associated with.</field>
    /// <field name="condition" type="Condition">The condition the target is for.</field>
    /// <field name="properties" type="Array" elementType="Property">The set of properties on the target entity the condition is related to.</field>

    Object.defineProperty(this, "target", { value: target });
	Object.defineProperty(this, "condition", { value: condition });
	Object.defineProperty(this, "properties", { value: properties });

	// attach the condition target to the target entity
	target.meta.setCondition(this);
}