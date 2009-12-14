using System;
using System.Linq;
using System.Collections.Generic;
using System.Web;
using System.Web.Services;
using System.IO;
using System.Runtime.Serialization;
using System.ServiceModel.Dispatcher;
using ExoGraph;
using System.Collections.Specialized;
using System.Xml;
using System.Runtime.Serialization.Json;
using System.Text;

namespace ExoWeb
{
	/// <summary>
	/// Summary description for $codebehindclassname$
	/// </summary>
	public class ServiceHandler : IHttpHandler
	{
		static IRuleProvider ruleProvider;
		static Dictionary<string, Type> customEvents = new Dictionary<string,Type>();

		/// <summary>
		/// Processes incoming requests and routes them to the appropriate JSON handler method.
		/// </summary>
		/// <param name="context"></param>
		public void ProcessRequest(HttpContext context)
		{
			if (context.Request.PathInfo == "/Script")
				OutputScript(context.Response);
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

		public static IRuleProvider RuleProvider
		{
			get
			{
				return ruleProvider;
			}
			set
			{
				ruleProvider = value;
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
		void OutputScript(HttpResponse response)
		{
			response.ContentType = "application/javascript";

			response.Write(
			@"
				// Indicate that the script requires the WebServices component
				Sys.require([Sys.scripts.WebServices]);

				// Declare the ExoWeb namespace
				Type.registerNamespace('ExoWeb');

				// Define the ExoWeb.GetType method
				ExoWeb.GetType = function(type, onSuccess, onFailure)
				{
					Sys.Net.WebServiceProxy.invoke('ExoWeb.axd', 'GetType', true, { type: type }, onSuccess, onFailure, null, 1000000, false, null);
				}

				// Define the ExoWeb.Load method
				ExoWeb.Load = function(type, ids, includeAllowedValues, includeTypes, paths, changes, onSuccess, onFailure)
				{
					Sys.Net.WebServiceProxy.invoke('ExoWeb.axd', 'Load', false, { type: type, ids: ids, includeAllowedValues: includeAllowedValues, includeTypes: includeTypes, paths: paths, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
				}

				// Define the ExoWeb.Save method
				ExoWeb.Save = function(root, changes, onSuccess, onFailure)
				{
					Sys.Net.WebServiceProxy.invoke('ExoWeb.axd', 'Save', false, { root: root, changes: changes }, onSuccess, onFailure, null, 1000000, false, null);
				}

			");

		}
	}
}
