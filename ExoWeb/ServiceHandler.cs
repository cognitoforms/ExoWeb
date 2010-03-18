using System;
using System.Collections.Generic;
using System.Web;
using System.Text;

namespace ExoWeb
{
	/// <summary>
	/// Summary description for $codebehindclassname$
	/// </summary>
	public class ServiceHandler : IHttpHandler
	{
		static IServiceAdapter adapter;
		static Dictionary<string, Type> customEvents = new Dictionary<string,Type>();

		/// <summary>
		/// Processes incoming requests and routes them to the appropriate JSON handler method.
		/// </summary>
		/// <param name="context"></param>
		public void ProcessRequest(HttpContext context)
		{
			try
			{
				if (context.Request.PathInfo == "/Script")
					OutputScript(context);
				else
					ServiceMethod.Invoke(context);
			}
			catch (Exception e)
			{
				// Create an error to log
				var error = new LogErrorMethod();

				error.Type = e.GetBaseException().GetType().FullName;
				error.StackTrace = GetFullStackTrace(e);
				error.Message = e.GetBaseException().Message;
				error.Url = context.Request.RawUrl;

				// Allow adapters to log the error
				Adapter.OnError(error);

				// Also send the error information to the client
				context.Response.Clear();
				context.Response.ContentType = "application/json";
				context.Response.StatusCode = 500;
				context.Response.Write(ServiceMethod.ToJson(typeof(LogErrorMethod), error));
			}
		}

		/// <summary>
		/// Indicates that this is a stateless service and may be cached.
		/// </summary>
		public bool IsReusable
		{
			get
			{
				return true;
			}
		}

		public static IServiceAdapter Adapter
		{
			get
			{
				return adapter;
			}
			set
			{
				adapter = value;
			}
		}

		/// <summary>
		/// Registers a custom event that can be raised on the client.
		/// </summary>
		/// <param name="name"></param>
		/// <param name="type"></param>
		public static void RegisterEvent(string name, Type type)
		{
			customEvents[name] = type;
		}

		/// <summary>
		/// Gets the type of a registered custom event.
		/// </summary>
		/// <param name="name"></param>
		/// <returns></returns>
		internal static Type GetEvent(string name)
		{
			Type eventType;
			customEvents.TryGetValue(name, out eventType);
			return eventType;
		}

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

						// Declare the ExoWeb namespace
						Type.registerNamespace('ExoWeb.WebService');

						// Define the ExoWeb.GetType method
						ExoWeb.WebService.GetType = function ExoWeb$WebService$GetType(type, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + path + @"', 'GetType', true, { type: type, cachehash: " + cachehash + @" }, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.Load method
						ExoWeb.WebService.Load = function ExoWeb$WebService$Load(type, ids, includeAllowedValues, includeTypes, paths, changes, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + path + @"', 'Load', false, { type: type, ids: ids, includeAllowedValues: includeAllowedValues, includeTypes: includeTypes, paths: paths, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.Save method
						ExoWeb.WebService.Save = function ExoWeb$WebService$Save(root, changes, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + path + @"', 'Save', false, { root: root, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.RaiseEvent method
						ExoWeb.WebService.RaiseEvent = function ExoWeb$WebService$RaiseEvent(eventType, instance, event, changes, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + path + @"', 'RaiseEvent/' + eventType , false, { instance: instance, event: event, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.LogError method
						ExoWeb.WebService.LogError = function ExoWeb$WebService$LogError(type, message, stackTrace, url, refererUrl, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + path + @"', 'LogError', false, { type: type, message: message, stackTrace: stackTrace, url: url, refererUrl: refererUrl }, onSuccess, onFailure, null, 1000000, false, null);
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
	}
}
