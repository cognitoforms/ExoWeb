var coreGetValue = getValue;

// If a getter method matching the given property name is found on the target it is invoked and returns the 
// value, unless the the value is undefined, in which case null is returned instead.  This is done so that 
// calling code can interpret a return value of undefined to mean that the property it requested does not exist.
// TODO: better name
getValue = function getValueOverride(target, property) {

	// first see if the property is a model property
	if (target instanceof ExoWeb.Model.Entity) {
		var prop = target.meta.type.property(property);
		if (prop) {
			var value = prop.value(target);
			if (value === undefined) {
				value = null;
			}
			return value;
		}
	}

	return coreGetValue(target, property);
}

ExoWeb.getValue = getValue;