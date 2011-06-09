ExoWeb.DotNet.config = {};

var path = window.location.pathname;
var idx = path.lastIndexOf("/");

if (idx >= 0 && idx < path.length - 1) {
	path = path.substring(0, idx + 1);
}

var fmt = window.location.port ? "{protocol}//{hostname}:{port}" : "{protocol}//{hostname}";
var host = $format(fmt, window.location);

function getPath() {
	return host + (ExoWeb.DotNet.config.appRoot || path) + "ExoWeb.axd";
}

function processRequest(method, data, success, failure) {
	$.ajax({ url: getPath() + "/" + method, type: "Post", data: JSON.stringify(data), processData: false, dataType: "text", contentType: "application/json",
		success: function(result) {
			success(JSON.parse(result));
		},
		error: function(result) { 
			var error = { message: result.statusText };
			try
			{
				error = JSON.parse(result.responseText);
			}
			catch(e) {}
			failure(error);
		}
	});
}

// Define the ExoWeb.Request method
function request(args, onSuccess, onFailure) {
	args.config = ExoWeb.DotNet.config;
	processRequest("Request", args, onSuccess, onFailure);
}

ExoWeb.Mapper.setEventProvider(function WebService$eventProviderFn(eventType, instance, event, paths, changes, scopeQueries, onSuccess, onFailure) {
	request({
		events: [{type: eventType, instance: instance, event: event, include: paths}],
		queries: scopeQueries,
		changes: changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setRoundtripProvider(function WebService$roundtripProviderFn(changes, scopeQueries, onSuccess, onFailure) {
	request({
		changes:changes,
		queries: scopeQueries
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setObjectProvider(function WebService$objectProviderFn(type, ids, paths, inScope, changes, scopeQueries, onSuccess, onFailure) {
	request({
		queries:[{
			from: type,
			ids: ids,
			include: paths,
			inScope: inScope,
			forLoad: true
		}].concat(scopeQueries),
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setQueryProvider(function WebService$queryProviderFn(queries, changes, scopeQueries, onSuccess, onFailure) {
	request({
		changes: changes,
		queries: queries.concat(scopeQueries)
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setSaveProvider(function WebService$saveProviderFn(root, changes, scopeQueries, onSuccess, onFailure) {
	request({
		events:[{type: "Save", instance: root}],
		queries: scopeQueries,
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setListProvider(function WebService$listProviderFn(ownerType, ownerId, paths, changes, scopeQueries, onSuccess, onFailure) {
	request({
		queries: [{
			from: ownerType,
			ids: ownerId === null ? [] : [ownerId],
			include: paths,
			inScope: false,
			forLoad: true
		}].concat(scopeQueries),
		changes: changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setTypeProvider(function WebService$typeProviderFn(type, onSuccess, onFailure) {
	var data = { type: type, config: ExoWeb.DotNet.config};
	
	if (ExoWeb.cacheHash) {
		data.cachehash = ExoWeb.cacheHash;
	}

	Sys.Net.WebServiceProxy.invoke(getPath(), "GetType", true, data, onSuccess, onFailure, null, 1000000, false, null);
});

var loggingError = false;
ExoWeb.setErrorHandler(function WebService$errorHandlerFn(message, e) {
	if (loggingError === false) {
		try {
			loggingError = true;
			Sys.Net.WebServiceProxy.invoke(
				getPath(),
				"LogError",
				false,
				{
					message: message,
					type: e ? parseFunctionName(e.constructor) : "Error",
					stackTrace: ExoWeb.trace.getCallStack().join("\n"),
					url: window.location.href,
					refererUrl: document.referrer,
					config: ExoWeb.DotNet.config
				}, null, null, null, 1000000, false, null);
		}
		finally {
			loggingError = false;
		}
	}
});
