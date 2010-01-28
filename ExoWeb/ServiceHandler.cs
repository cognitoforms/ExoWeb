using System;
using System.Collections.Generic;
using System.Web;

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
			if (context.Request.PathInfo == "/Script")
				OutputScript(context);
			else
				ServiceMethod.Invoke(context);
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

			context.Response.Write(
			@"
				(function() {

					function execute() {

						// Declare the ExoWeb namespace
						Type.registerNamespace('ExoWeb');

						// Define the ExoWeb.GetType method
						ExoWeb.GetType = function(type, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" +  context.Request.ApplicationPath + @"/ExoWeb.axd', 'GetType', true, { type: type }, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.Load method
						ExoWeb.Load = function(type, ids, includeAllowedValues, includeTypes, paths, changes, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + context.Request.ApplicationPath + @"/ExoWeb.axd', 'Load', false, { type: type, ids: ids, includeAllowedValues: includeAllowedValues, includeTypes: includeTypes, paths: paths, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.Save method
						ExoWeb.Save = function(root, changes, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + context.Request.ApplicationPath + @"/ExoWeb.axd', 'Save', false, { root: root, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
						}

						// Define the ExoWeb.RaiseEvent method
						ExoWeb.RaiseEvent = function(eventType, instance, event, changes, onSuccess, onFailure)
						{
							Sys.Net.WebServiceProxy.invoke('" + context.Request.ApplicationPath + @"/ExoWeb.axd', 'RaiseEvent/' + eventType, false, { instance: instance, event: event, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
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
	}
}
