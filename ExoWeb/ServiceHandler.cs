using System;
using System.Linq;
using System.Collections.Generic;
using System.Web;
using System.Text;
using ExoGraph;
using System.IO;
using System.Web.Script.Serialization;
using System.Reflection;
using ExoRule;
using System.Diagnostics;
using ExoRule.Validation;

namespace ExoWeb
{
	/// <summary>
	/// Summary description for $codebehindclassname$
	/// </summary>
	public class ServiceHandler : IHttpHandler
	{
		#region IHttpHandler

		/// <summary>
		/// Indicates that this is a stateless service and may be cached.
		/// </summary>
		bool IHttpHandler.IsReusable
		{
			get
			{
				return true;
			}
		}

		/// <summary>
		/// Processes incoming requests and routes them to the appropriate JSON handler method.
		/// </summary>
		/// <param name="context"></param>
		void IHttpHandler.ProcessRequest(HttpContext context)
		{
			try
			{
				// Read the request JSON
				string json;
				using (StreamReader reader = new StreamReader(context.Request.InputStream))
					json = reader.ReadToEnd();

				// Perform the requested operation
				switch (context.Request.PathInfo)
				{
					case "/Request":

						// Deserialize the request
						ServiceRequest request = ExoWeb.FromJson<ServiceRequest>(json);

						// Invoke the request and output the response
						context.Response.ContentType = "application/json";
						context.Response.Write(ExoWeb.FixJsonDates(ExoWeb.ToJson(typeof(ServiceResponse), request.Invoke())));

						break;

					case "/GetType":

						// Enable response caching
						context.Response.Cache.SetCacheability(HttpCacheability.Public);
						context.Response.Cache.SetExpires(DateTime.Now.AddDays(7));
						context.Response.Cache.SetMaxAge(TimeSpan.FromDays(7));

						// Output the type metadata
						context.Response.ContentType = "application/json";
						context.Response.Write(ExoWeb.ToJson(typeof(ServiceResponse), ExoWeb.FromJson<ServiceRequest>("{types:[" + context.Request.QueryString["type"] + "]}").Invoke()));

						break;

					case "/LogError":

						// Raise the error event
						context.Response.ContentType = "application/json";
						ExoWeb.OnError(ExoWeb.FromJson<ServiceError>(json));

						break;

					case "/Script":

						// Output the service handler client script
						OutputScript(context);

						break;
				}
			}
			catch (Exception e)
			{
				// Create an error to log
				var error = new ServiceError();

				error.Type = e.GetBaseException().GetType().FullName;
				error.StackTrace = GetFullStackTrace(e);
				error.Message = e.GetBaseException().Message;
				error.Url = context.Request.RawUrl;

				// Raise the error event
				ExoWeb.OnError(error);

				// Also send the error information to the client
				context.Response.Clear();
				context.Response.ContentType = "application/json";
				context.Response.StatusCode = 500; // internal server error

				// Enable error information on client
				if (ExoWeb.EnableExceptionInformation)
					context.Response.AddHeader("jsonerror", "true");

				context.Response.Write(ExoWeb.ToJson(typeof(ServiceError), error));
			}
		}

		#endregion

		#region Methods

		/// <summary>
		/// Outputs the javascript used to enable ExoWeb usage.
		/// </summary>
		/// <param name="response"></param>
		void OutputScript(HttpContext context)
		{
			// Enable caching
			context.Response.Cache.SetCacheability(HttpCacheability.Public);
			context.Response.Cache.SetExpires(DateTime.Now.AddDays(7));

			context.Response.ContentType = "application/javascript";

			string path = context.Request.ApplicationPath;
			path += path.EndsWith("/") ? "ExoWeb.axd" : "/ExoWeb.axd";

			string cachehash = context.Request.QueryString["cachehash"];

			context.Response.Write(
			@"
				(function() {

					function execute() {

						function ProcessRequest(method, data, success, failure)
						{
							$.ajax({ url: '" + path + @"/' + method, type: 'Post', data: JSON.stringify(data), processData: false, dataType: 'text', contentType: 'application/json',
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
							}});
						}

						// Declare the ExoWeb namespace
						Type.registerNamespace('ExoWeb.WebService');

						// Define the ExoWeb.Request method
						ExoWeb.WebService.Request = function ExoWeb$WebService$Request(args, onSuccess, onFailure)
						{
							args.config = ExoWeb.config;
							ProcessRequest('Request', args, onSuccess, onFailure);
						}

						// Define the ExoWeb.GetType method
						ExoWeb.WebService.GetType = function ExoWeb$WebService$GetType(type, onSuccess, onFailure)
						{
							var data = { type: type" + (string.IsNullOrEmpty(cachehash) ? "" : @", cachehash: " + cachehash) + @", config: ExoWeb.config};
							Sys.Net.WebServiceProxy.invoke('" + path + @"', 'GetType', true, data, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.LogError method
						ExoWeb.WebService.LogError = function ExoWeb$WebService$LogError(type, message, stackTrace, url, refererUrl, onSuccess, onFailure)
						{
							var data = { type: type, message: message, stackTrace: stackTrace, url: url, refererUrl: refererUrl, config: ExoWeb.config};
							Sys.Net.WebServiceProxy.invoke('" + path + @"', 'LogError', false, data, onSuccess, onFailure, null, 1000000, false, null);
						}
					}

					if (window.Sys && Sys.loader) {
							Sys.loader.registerScript('ExoWebHandler', null, execute);
					}
					else {
							execute();
					}
				})();
			");
		}

		/// <summary>
		/// Utility method for getting the full stack trace for a list
		/// of chained exceptions.
		/// </summary>
		/// <param name="error">Last exception in chain</param>
		/// <returns>Stack trace</returns>
		static string GetFullStackTrace(Exception error)
		{
			// Include exception info in the message
			var errors = new Stack<Exception>();
			for (Exception e = error; null != e; e = e.InnerException)
				errors.Push(e);

			StringBuilder stackTrace = new StringBuilder();
			while (errors.Count > 0)
			{
				Exception e = (Exception)errors.Pop();
				stackTrace.AppendFormat("{0}\n {1}\n{2}\n\n", e.Message, e.GetType().FullName, e.StackTrace);
			}

			return stackTrace.ToString();
		}

		#endregion
	}
}
