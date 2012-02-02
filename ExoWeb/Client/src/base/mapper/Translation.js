// Gets or loads the entity with the specified typed string id
Entity.fromIdString = function Entity$fromIdString(id) {
	var ids = id.split("|");
	var jstype = ExoWeb.Model.Model.getJsType(ids[0]);
	var obj = jstype.meta.get(ids[1]);

	if (!obj) {
		obj = new jstype(ids[1]);
		ObjectLazyLoader.register(obj);
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

function fromExoModel(val, translator, create) {
	if (val !== undefined && val !== null && val.type && val.id ) {
		var type = ExoWeb.Model.Model.getJsType(val.type);

		// Entities only: translate back to the client's id.  This is necessary to handle the fact that ids are created on 
		// both the client and server.  Also, in some cases a transaction references an entity that was created on the server 
		// and then committed, so that the id actually references an object that already exists on the client but with a different id.
		//--------------------------------------------------------------------------------------------------------
		if (type.meta && type.meta instanceof ExoWeb.Model.Type && translator) {
			// don't alter the original object
			var id = translateId(translator, val.type, val.id);

			var obj = type.meta.get(id);

			if (!obj && create) {
				obj = new type(id);
				ObjectLazyLoader.register(obj);
				ExoWeb.trace.log(["entity", "server"], "{0}({1})  (ghost)", [type.meta.get_fullName(), id]);
			}

			return obj;
		}

		// is this needed? Can the if statement that checks type.meta be removed?
		return val;
	}

	return val;
}
