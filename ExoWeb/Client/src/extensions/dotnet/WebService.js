var path = window.location.pathname;
var idx = path.lastIndexOf("/");

if (idx >= 0 && idx < path.length - 1) {
	path = path.substring(0, idx + 1);
}

var fmt = window.location.port ? "{protocol}//{hostname}:{port}" : "{protocol}//{hostname}";
path = $format(fmt, window.location) + path + "ExoWeb.axd";

function processRequest(method, data, success, failure) {
	$.ajax({ url: path + "/" + method, type: "Post", data: JSON.stringify(data), processData: false, dataType: "text", contentType: "application/json",
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

ExoWeb.DotNet.config = {};

// Define the ExoWeb.Request method
function request(args, onSuccess, onFailure) {
	args.config = ExoWeb.DotNet.config;
	processRequest("Request", args, onSuccess, onFailure);
}

ExoWeb.Mapper.setEventProvider(function eventProviderFn(eventType, instance, event, paths, changes, onSuccess, onFailure) {
	request({
		events:[{type: eventType, instance: instance, event: event}],
		paths:paths,
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setRoundtripProvider(function roundtripProviderFn(changes, onSuccess, onFailure) {
	request({changes:changes}, onSuccess, onFailure);
});

ExoWeb.Mapper.setObjectProvider(function objectProviderFn(type, ids, paths, changes, onSuccess, onFailure) {
	request({
		queries:[{type:type, ids:ids, paths:paths}],
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setSaveProvider(function saveProviderFn(root, changes, onSuccess, onFailure) {
	request({
		events:[{type: "Save", instance: root}],
		changes:changes
	}, onSuccess, onFailure);
});

ExoWeb.Mapper.setListProvider(function listProvider(ownerType, ownerId, paths, onSuccess, onFailure) {
	request({
		queries:[{type:ownerType, ids:[ownerId], paths:paths}]
	}, onSuccess, onFailure);
})

// Define the ExoWeb.GetType method
function getType(type, onSuccess, onFailure) {
	var data = { type: type, config: ExoWeb.DotNet.config};
	
	if (ExoWeb.cacheHash) {
		data.cachehash = ExoWeb.cacheHash;
	}
	
	Sys.Net.WebServiceProxy.invoke(path, "GetType", true, data, onSuccess, onFailure, null, 1000000, false, null);
}

ExoWeb.Mapper.setTypeProvider(getType);

// Define the ExoWeb.LogError method
function logError(type, message, stackTrace, url, refererUrl, onSuccess, onFailure) {
	var data = { type: type, message: message, stackTrace: stackTrace, url: url, refererUrl: refererUrl, config: ExoWeb.DotNet.config};
	Sys.Net.WebServiceProxy.invoke(path, "LogError", false, data, onSuccess, onFailure, null, 1000000, false, null);
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
