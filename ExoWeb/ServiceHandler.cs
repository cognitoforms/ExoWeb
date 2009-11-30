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

namespace ExoWeb
{
	/// <summary>
	/// Summary description for $codebehindclassname$
	/// </summary>
	public class ServiceHandler : IHttpHandler
	{
		#region IHttpHandler Implementation

		/// <summary>
		/// Processes incoming requests and routes them to the appropriate JSON handler method.
		/// </summary>
		/// <param name="context"></param>
		public void ProcessRequest(HttpContext context)
		{
			// Read the request JSON
			string request;
			if (context.Request.RequestType == "GET")
			{
				request = "{";
				foreach (string property in context.Request.QueryString.AllKeys)
					request += "\"" + property + "\":" + context.Request.QueryString[property] + ",";
				request = request.Substring(0, request.Length - 1) + "}";
			}
			else
			{
				using (StreamReader reader = new StreamReader(context.Request.InputStream))
					request = reader.ReadToEnd();
			}

			// Determine the method to call
			switch (context.Request.PathInfo)
			{
				case "/GetInstance":
					context.Response.ContentType = "application/json";
					GetInstance(context.Response, FromJson<GetInstanceArgs>(request));
					break;

				case "/GetType":
					context.Response.ContentType = "application/json";
					GetType(context.Response, FromJson<GetTypeArgs>(request));
					break;

				case "/Script":
					context.Response.ContentType = "application/javascript";
					Script(context.Response);
					break;
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

		#endregion

		#region JSON Serialization

		// Cache a converter to serialize and deserialize JSON data
		static JsonQueryStringConverter converter = new JsonQueryStringConverter();

		/// <summary>
		/// Deserializes a JSON string into the specified type.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="json"></param>
		/// <returns></returns>
		T FromJson<T>(string json)
		{
			return (T)converter.ConvertStringToValue(json, typeof(T));
		}

		/// <summary>
		/// Serializes a typed value into a JSON string.
		/// </summary>
		/// <param name="type"></param>
		/// <param name="value"></param>
		/// <returns></returns>
		string ToJson(Type type, object value)
		{
			try
			{
				return converter.ConvertValueToString(value, type);
			}
			catch
			{
				return "\"???\"";
			}
		}

		#endregion

		#region GetType Method

		static Dictionary<Type, string> jsonIntrinsicTypes = new Dictionary<Type, string>();

		static ServiceHandler()
		{
			jsonIntrinsicTypes[typeof(string)] = "String";
			jsonIntrinsicTypes[typeof(bool)] = "Boolean";
			jsonIntrinsicTypes[typeof(byte)] = "Number";
			jsonIntrinsicTypes[typeof(int)] = "Number";
			jsonIntrinsicTypes[typeof(long)] = "Number";
			jsonIntrinsicTypes[typeof(float)] = "Number";
			jsonIntrinsicTypes[typeof(double)] = "Number";
			jsonIntrinsicTypes[typeof(decimal)] = "Number";
			jsonIntrinsicTypes[typeof(DateTime)] = "Date";
		}

		static string GetJsonValueType(Type type)
		{
			string jsonType;
			if (jsonIntrinsicTypes.TryGetValue(type, out jsonType))
				return jsonType;

			return null;
		}

		void GetType(HttpResponse response, GetTypeArgs args)
		{
			// Get the requested graph type
			GraphType type = GraphContext.Current.GraphTypes[args.Type];

			// Output the type meta data
			response.Write("{\r\n   \"" + type.Name + "\": {");
			if (type.BaseType != null)
				response.Write("\r\n      \"baseType\": \"" + type.BaseType.Name + "\",");
			if (type.SubTypes != null && type.SubTypes.Count > 0)
			{
				System.Text.StringBuilder subTypesList = new System.Text.StringBuilder();
				foreach (GraphType subType in type.SubTypes)
					subTypesList.Append((subTypesList.Length > 0 ? ", \"" : "\"") + subType.Name + "\"");
				response.Write("\r\n      \"derivedTypes\": [ " + subTypesList.ToString() + " ],");
			}
			response.Write("\r\n      \"properties\": {\r\n");
			bool isFirstProperty = true;
			foreach (GraphProperty property in type.Properties)
			{
				// Skip properties that cannot be serialized
				if (property is GraphValueProperty && GetJsonValueType(((GraphValueProperty)property).PropertyType) == null)
					continue;
		
				// Handle trailing commas after each property
				if (isFirstProperty)
					isFirstProperty = false;
				else
					response.Write(",\r\n");

				// Output the property schema
				if (property is GraphValueProperty)
					response.Write("         \"" + property.Name + "\": { \"type\": \"" + GetJsonValueType(((GraphValueProperty)property).PropertyType) + "\" }");
				else
					response.Write("         \"" + property.Name + "\": { \"type\": \"" + ((GraphReferenceProperty)property).PropertyType.Name + "\"" + (((GraphReferenceProperty)property).IsList ? ", \"isList\": true" : "") + " }");
			}
			response.Write("\r\n      }\r\n   }\r\n}");
		}

		[DataContract]
		class GetTypeArgs
		{
			[DataMember]
			public string Type { get; set; }
		}

		#endregion

		#region GetInstance Method

		/// <summary>
		/// Outputs the JSON for the specified instance to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="args"></param>
		void GetInstance(HttpResponse response, GetInstanceArgs args)
		{
			// Build a set of unique property paths to match during recursion
			StringDictionary paths = new StringDictionary();
			if (args.Paths != null)
				foreach (string path in args.Paths)
				{
					string p = "";
					foreach (string step in path.Split('.'))
					{
						p += "." + step;
						if (!paths.ContainsKey(p))
							paths.Add(p, p);
					}
				}

			// Get the root instance
			Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> instances = new Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>>();
			GraphInstance root = GraphContext.Current.GraphTypes[args.Type].Create(args.Id);
			
			// Recursively build up the list of instances to serialize
			ProcessInstance(root, instances, paths, "");

			// Serialize the list of instances
			response.Write("{\r\n");
			bool isFirstType = true;
			foreach (KeyValuePair<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> type in instances)
			{
				// Handle trailing commas after each type
				if (isFirstType)
					isFirstType = false;
				else
					response.Write(",\r\n");

				response.Write("   \"" + type.Key.Name + "\": {\r\n");
				bool isFirstInstance = true;
				foreach (GraphInstanceInfo instance in type.Value.Values)
				{
					// Handle trailing commas after each instance
					if (isFirstInstance)
						isFirstInstance = false;
					else
						response.Write(",\r\n");

					response.Write("      \"" + instance.Instance.Id + "\" : {\r\n");
					bool isFirstProperty = true;
					foreach (GraphProperty property in type.Key.Properties)
					{
						// Skip properties that cannot be serialized
						if (property is GraphValueProperty && GetJsonValueType(((GraphValueProperty)property).PropertyType) == null)
							continue;

						// Handle trailing commas after each property
						if (isFirstProperty)
							isFirstProperty = false;
						else
							response.Write(",\r\n");

						// Write out the property name and value
						response.Write("         \"" + property.Name + "\": ");
						GraphReferenceProperty reference = property as GraphReferenceProperty;
						if (reference != null)
						{
							// Serialize lists
							if (reference.IsList)
							{
								if (instance.HasList(reference))
								{
									response.Write("[ ");
									bool isFirstItem = true;
									foreach (GraphInstance child in instance.Instance.GetList(reference))
									{
										if (isFirstItem)
											isFirstItem = false;
										else
											response.Write(", ");
										response.Write("\"" + child.Id + "\"");
									}
									response.Write(" ]");
								}
								else
									response.Write("\"deferred\"");
							}

							// Serialize references
							else
							{
								GraphInstance child = instance.Instance.GetReference(reference);
								if (child != null)
									response.Write("\"" + child.Id + "\"");
								else
									response.Write("null");
							}
						}

						// Serialize values
						else
							response.Write(ToJson(((GraphValueProperty)property).PropertyType, instance.Instance.GetValue((GraphValueProperty)property)));
					}
					response.Write("\r\n      }");
				}
				response.Write("\r\n   }");
			}
			response.Write("\r\n}");
		}

		/// <summary>
		/// Recursively builds up a list of instances to serialize.
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="instances"></param>
		/// <param name="paths"></param>
		/// <param name="path"></param>
		void ProcessInstance(GraphInstance instance, Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> instances, StringDictionary paths, string path)
		{
			// Fetch or initialize the dictionary of instances for the type of the current instance
			Dictionary<GraphInstance, GraphInstanceInfo> typeInstances;
			if (!instances.TryGetValue(instance.Type, out typeInstances))
				instances[instance.Type] = typeInstances = new Dictionary<GraphInstance, GraphInstanceInfo>();

			// Add the current instance to the dictionary if it is not already there
			GraphInstanceInfo instanceInfo;
			if (!typeInstances.TryGetValue(instance, out instanceInfo))
				typeInstances[instance] = instanceInfo = new GraphInstanceInfo(instance);

			// Process all reference property paths on the current instance
			foreach (GraphProperty property in instance.Type.Properties)
			{
				// Cast the property to a reference property
				GraphReferenceProperty reference = property as GraphReferenceProperty;

				// Skip the property if it is not a reference property
				if (reference == null)
					continue;

				// Get the full path to the property
				string childPath = path + "." + reference.Name;

				// Skip the property if it is not part of a valid path
				if (!paths.ContainsKey(childPath))
					continue;

				// Process all items in a child list and register the list to be serialized
				if (reference.IsList)
				{
					// Process each child instance
					foreach (GraphInstance childInstance in instance.GetList(reference))
						ProcessInstance(childInstance, instances, paths, childPath);

					// Mark the list to be included during serialization
					instanceInfo.IncludeList(reference);
				}

				// Process child references
				else
				{
					GraphInstance childInstance = instance.GetReference(reference);
					if (childInstance != null)
						ProcessInstance(childInstance, instances, paths, childPath);
				}
			}
		}

		/// <summary>
		/// Tracks an instance being serialized and each list property that must be serialized with it.
		/// </summary>
		class GraphInstanceInfo
		{
			Dictionary<GraphReferenceProperty, GraphReferenceProperty> lists;

			internal GraphInstance Instance { get; private set; }

			internal GraphInstanceInfo(GraphInstance instance)
			{
				this.Instance = instance;
			}

			internal void IncludeList(GraphReferenceProperty list)
			{
				if (lists == null)
					lists = new Dictionary<GraphReferenceProperty, GraphReferenceProperty>();
				lists[list] = list;
			}

			internal bool HasList(GraphReferenceProperty list)
			{
				return lists != null && lists.ContainsKey(list);
			}
		}

		/// <summary>
		/// Defines arguments for the <see cref="GetInstance"/> method.
		/// </summary>
		[DataContract]
		class GetInstanceArgs
		{
			[DataMember]
			public string Type { get; set; }

			[DataMember]
			public string Id { get; set; }

			[DataMember]
			public string[] Paths { get; set; }
		}

		#endregion

		#region Script

		/// <summary>
		/// Outputs the javascript used to enable ExoWeb usage.
		/// </summary>
		/// <param name="response"></param>
		void Script(HttpResponse response)
		{
			response.Write(
			@"
				// Indicate that the script requires the WebServices component
				Sys.require([Sys.scripts.WebServices]);

				// Declare the ExoWeb namespace
				Type.registerNamespace('ExoWeb');

				// Define the ExoWeb.GetType method
				ExoWeb.GetType = function(type, onSuccess, onFailure)
				{
					Sys.Net.WebServiceProxy.invoke('ExoWeb.axd', 'GetType', false, { Type: type }, onSuccess, onFailure, null, 1000000, false, null);
				}

				// Define the ExoWeb.GetInstance method
				ExoWeb.GetInstance = function(type, id, paths, onSuccess, onFailure)
				{
					Sys.Net.WebServiceProxy.invoke('ExoWeb.axd', 'GetInstance', false, { Type: type, Id: id, Paths: paths }, onSuccess, onFailure, null, 1000000, false, null);
				}
			");

		}
		#endregion
	}
}
