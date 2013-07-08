/// <reference path="..\model\Type.js" />

// Gets or loads the entity with the specified typed string id
Entity.fromIdString = function Entity$fromIdString(id) {
	// Typed identifiers take the form "type|id".
	var ids = id.split("|");

	// Use the left-hand portion of the id string as the object's type.
	var jstype = ExoWeb.Model.Model.getJsType(ids[0]);

	// Attempt to retrieve the object with the given id.
	var obj = jstype.meta.get(
		// Use the right-hand portion of the id string as the object's id.
		ids[1],

		// Typed identifiers may or may not be the exact type of the instance.
		// An id string may be constructed with only knowledge of the base type.
		false
	);

	// If the object does not exist, assume it is an existing object that is not
	// yet in memory client-side, so create a ghosted instance.
	if (!obj) {
		obj = new jstype(ids[1]);
		if (jstype.meta.get_origin() === "server") {
			ObjectLazyLoader.register(obj);
		}
	}

	return obj;
};

function toExoModel(val, translator) {
	if (val === undefined || val === null)
		return;

	// entities only: translate forward to the server's id
	if (val instanceof ExoWeb.Model.Entity) {
		var result = {
			id: val.meta.id,
			type: val.meta.type.get_fullName()
		};

		if (val.meta.isNew) {
			result.isNew = true;
		}

		result.id = translator.forward(result.type, result.id) || result.id;
		return result;
	}

	return val;
}

function translateId(translator, type, id) {
	// get the server id, either translated or as the serialized entity id itself
	var serverId = translator.forward(type, id) || id;
	// get the client id, either a reverse translation of the server id or the server id itself
	var clientId = translator.reverse(type, serverId) || serverId;

	return clientId;
}

function fromExoModel(val, translator, create, supplementalObjectsArray) {
	if (val !== undefined && val !== null && val.type && val.id ) {
		var type = ExoWeb.Model.Model.getJsType(val.type);

		// Entities only: translate back to the client's id.  This is necessary to handle the fact that ids are created on 
		// both the client and server.  Also, in some cases a transaction references an entity that was created on the server 
		// and then committed, so that the id actually references an object that already exists on the client but with a different id.
		//--------------------------------------------------------------------------------------------------------
		if (type.meta && type.meta instanceof ExoWeb.Model.Type && translator) {
			// NOTE: don't alter the original object
			var id = translateId(translator, val.type, val.id);

			var obj = type.meta.get(id,
				// Since "fromExoModel" operates on the ExoModel change object format,
				// it can be assumed that the instance type is exact.
				true
			);

			// If the object was not found and a supplemental list was provided, then search for it
			if (!obj && supplementalObjectsArray && supplementalObjectsArray.length > 0) {
				var matches = supplementalObjectsArray.filter(function(o) {
					return o instanceof type && o.meta.id === id;
				});
				if (matches.length > 1) {
					throw new Error("Expected a single item, but found " + matches.length + ".");
				}
				obj = matches[0];
			}

			if (!obj && create) {
				obj = new type(id);
				if (type.meta.get_origin() === "server") {
					ObjectLazyLoader.register(obj);
				}
			}

			return obj;
		}

		// is this needed? Can the if statement that checks type.meta be removed?
		return val;
	}

	return val;
}
