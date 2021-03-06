var webServiceConfig = {
	/*
	 * Specify the application's root URL. Otherwise it is assumed that
	 * the root is the URL up to the first forward slash '/'.
	 */
	appRoot: null,

	/*
	 * If set to true, when requests are sent they will use the text "Save", "Roundtrip", or the
	 * specific method name as an alias for "Request".  If the method name would collide with
	 * another procedure ("GetType" or "LogError"), then "Request" will be used instead.
	 */
	aliasRequests: false
};

ExoWeb.DotNet.config = webServiceConfig;

var path = window.location.pathname;
var idx = path.lastIndexOf("/");

if (idx > 0 && idx < path.length - 1) {
	path = path.substring(0, idx + 1);
}
else if (idx === 0 && path.length > 1) {
	path += "/";
}

var fmt = window.location.port ? "{0}//{1}:{2}" : "{0}//{1}";
var host = $format(fmt, window.location.protocol, window.location.hostname, window.location.port);

function getPath() {
	return host + (webServiceConfig.appRoot || path) + "ExoWeb.axd";
}

function sendRequest(options) {
	// Include config data in request
	options.data.config = webServiceConfig;

	jQuery.ajax({
		url: getPath() + "/" + options.path,
		type: options.type,
		data: JSON.stringify(options.data),
		processData: false,
		dataType: "text",
		contentType: "application/json",
		success: function(result) {
			options.onSuccess(JSON.parse(result));
		},
		error: function(result) {
			var error = { message: result.statusText };
			try
			{
				error = JSON.parse(result.responseText);
			}
			catch(e) {}
			options.onFailure(error);
		}
	});
}

ExoWeb.Mapper.setEventProvider(function (eventType, eventInstance, event, paths, changes, scopeQueries, onSuccess, onFailure) {
	sendRequest({
		type: "Post",
		path: webServiceConfig.aliasRequests && eventType !== "GetType" && eventType !== "LogError" ? eventType : "Request",
		data: {
			events: [{ type: eventType, include: paths, instance: eventInstance, event: event }],
			queries: scopeQueries,
			changes: changes
		},
		onSuccess: onSuccess,
		onFailure: onFailure
	});
});

ExoWeb.Mapper.setRoundtripProvider(function (root, paths, changes, scopeQueries, onSuccess, onFailure) {
	var queries = [];

	if (root) {
		queries.push({
			from: root.type,
			ids: [root.id],
			include: paths,
			inScope: true,
			forLoad: true
		});
	}

	queries.addRange(scopeQueries);

	sendRequest({
		type: "Post",
		path: webServiceConfig.aliasRequests ? "Roundtrip" : "Request",
		data: {
			changes: changes,
			queries: queries
		},
		onSuccess: onSuccess,
		onFailure: onFailure
	});
});

ExoWeb.Mapper.setObjectProvider(function (type, ids, paths, inScope, changes, scopeQueries, onSuccess, onFailure) {
	sendRequest({
		type: "Post",
		path: webServiceConfig.aliasRequests ? "LoadObject" : "Request",
		data: {
			queries:[{
				from: type,
				ids: ids,
				include: paths,
				inScope: inScope,
				forLoad: true
			}].concat(scopeQueries),
			changes:changes
		},
		onSuccess: onSuccess,
		onFailure: onFailure
	});
});

ExoWeb.Mapper.setQueryProvider(function (queries, changes, scopeQueries, onSuccess, onFailure) {
	sendRequest({
		type: "Post",
		path: webServiceConfig.aliasRequests ? "Query" : "Request",
		data: {
			changes: changes,
			queries: queries.concat(scopeQueries)
		},
		onSuccess: onSuccess,
		onFailure: onFailure
	});
});

ExoWeb.Mapper.setSaveProvider(function (root, changes, scopeQueries, onSuccess, onFailure) {
	sendRequest({
		type: "Post",
		path: webServiceConfig.aliasRequests ? "Save" : "Request",
		data: {
			events:[{type: "Save", instance: root}],
			queries: scopeQueries,
			changes:changes
		},
		onSuccess: onSuccess,
		onFailure: onFailure
	});
});

ExoWeb.Mapper.setListProvider(function (ownerType, ownerId, paths, changes, scopeQueries, onSuccess, onFailure) {
	sendRequest({
		type: "Post",
		path: webServiceConfig.aliasRequests ? "LoadList" : "Request",
		data: {
			queries: [{
				from: ownerType,
				ids: ownerId === null ? [] : [ownerId],
				include: paths,
				inScope: false,
				forLoad: true
			}].concat(scopeQueries),
			changes: changes
		},
		onSuccess: onSuccess,
		onFailure: onFailure
	});
});

ExoWeb.Mapper.setTypeProvider(function (types, onSuccess, onFailure) {
	if (types.length === 1) {
		var data = { type: types[0], config: webServiceConfig};

		if (ExoWeb.cacheHash) {
			data.cachehash = ExoWeb.cacheHash;
		}

		Sys.Net.WebServiceProxy.invoke(getPath(), "GetType", true, data, onSuccess, onFailure, null, 1000000, false, null);
	}
	else {
		sendRequest({
			type: "Post",
			path: webServiceConfig.aliasRequests ? "GetTypes" : "Request",
			data: { types: types },
			onSuccess: onSuccess,
			onFailure: onFailure
		});
	}
});

var loggingError = false;
ExoWeb.setLogErrorProvider(function (errorData, onSuccess, onFailure) {
	if (loggingError === false) {
		try {
			loggingError = true;
			Sys.Net.WebServiceProxy.invoke(
				getPath(),
				"LogError",
				false,
				errorData,
				function () {
					if (onSuccess) {
						onSuccess.apply(this, arguments);
					}
				},
				function () {
					// Don't log errors that occur when trying to log an error.
					if (onFailure) {
						onFailure.apply(this, arguments);
					}
				},
				null,
				1000000,
				false,
				null
			);
		} finally {
			loggingError = false;
		}
	}
});
