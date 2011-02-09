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

ExoWeb.Mapper.setEventProvider(function eventProviderFn(eventType, instance, event, paths, changes, scopeQueries, onSuccess, onFailure) {
	request({
		events:[{type: eventType, instance: instance, event: event}],
		queries: scopeQueries,
		paths:paths,
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setRoundtripProvider(function roundtripProviderFn(changes, scopeQueries, onSuccess, onFailure) {
	request({
		changes:changes,
		queries: scopeQueries
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setObjectProvider(function objectProviderFn(type, ids, paths, inScope, changes, scopeQueries, onSuccess, onFailure) {
	var q = {
		type: type,
		ids: ids,
		paths: paths
	};

	if (ExoWeb.config.useChangeSets === true) {
		q.inScope = inScope;
		q.forLoad = true;
	}

	request({
		queries:[q].concat(scopeQueries),
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setQueryProvider(function queryProviderFn(queries, changes, scopeQueries, onSuccess, onFailure) {
	request({
		changes: changes,
		queries: queries.map(function(q) {
			var q = { type: q.from, ids: [q.id], paths: q.and || [] };
			
			if (ExoWeb.config.useChangeSets === true) {
				q.inScope = true;
				q.forLoad = true;
			}

			return q;
		}).concat(scopeQueries)
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setSaveProvider(function saveProviderFn(root, changes, scopeQueries, onSuccess, onFailure) {
	request({
		events:[{type: "Save", instance: root}],
		queries: scopeQueries,
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setListProvider(function listProvider(ownerType, ownerId, paths, changes, scopeQueries, onSuccess, onFailure) {
	var q = {
		type: ownerType,
		ids: [ownerId],
		paths: paths
	};

	if (ExoWeb.config.useChangeSets === true) {
		q.inScope = false;
		q.forLoad = true;
	}

	request({
		queries: [q].concat(scopeQueries),
		changes: changes
	}, onSuccess, onFailure);
});

// Define the ExoWeb.GetType method
function getType(type, onSuccess, onFailure) {
	var data = { type: type, config: ExoWeb.DotNet.config};
	
	if (ExoWeb.cacheHash) {
		data.cachehash = ExoWeb.cacheHash;
	}

	Sys.Net.WebServiceProxy.invoke(getPath(), "GetType", true, data, onSuccess, onFailure, null, 1000000, false, null);
}

ExoWeb.Mapper.setTypeProvider(getType);

// Define the ExoWeb.LogError method
function logError(type, message, stackTrace, url, refererUrl, onSuccess, onFailure) {
	var data = { type: type, message: message, stackTrace: stackTrace, url: url, refererUrl: refererUrl, config: ExoWeb.DotNet.config};
	Sys.Net.WebServiceProxy.invoke(getPath(), "LogError", false, data, onSuccess, onFailure, null, 1000000, false, null);
}

var loggingError = false;
ExoWeb.setErrorHandler(function errorHandler(message, e) {
	if (loggingError === false) {
		try {
			loggingError = true;
			var stackTrace = ExoWeb.trace.getCallStack();
			var type = e ? parseFunctionName(e.constructor) : "Error";
			logError(type, message, stackTrace.join("\n"), window.location.href, document.referrer);
		}
		finally {
			loggingError = false;
		}
	}
});
