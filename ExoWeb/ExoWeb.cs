using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using ExoRule.Validation;
using ExoRule;
using System.Collections;
using System.Runtime.Serialization;
using System.Collections.Specialized;

namespace ExoWeb
{
	public static class ExoWeb
	{
		#region Fields

		static readonly Regex dateRegex = new Regex("\"\\\\/Date\\((?<ticks>-?[0-9]+)(?:[a-zA-Z]|(?:\\+|-)[0-9]{4})?\\)\\\\/\"", RegexOptions.Compiled);
		static string cacheHash;
		static JavaScriptSerializer serializer;
		static HashSet<Type> serializableTypes;
		static MethodInfo deserialize;
		static long minJsonTicks = new DateTime(0x7b2, 1, 1, 0, 0, 0, DateTimeKind.Utc).Ticks;


		#endregion

		#region Constructors

		static ExoWeb()
		{
			Adapter = new ServiceAdapter();
			InitializeSerialization();
		}

		#endregion

		#region Properties

		/// <summary>
		/// Gets a unique cache key to use when referencing client scripts to ensure that application
		/// changes cause browsers to pull down new type schema information.
		/// </summary>
		public static string CacheHash
		{
			get
			{
				if (cacheHash == null)
				{
					int code = 0;

					foreach (Assembly a in AppDomain.CurrentDomain.GetAssemblies())
						code = code == 0 ? a.GetHashCode() : code ^ a.GetHashCode();

					cacheHash = code.ToString();
				}
				return cacheHash;
			}
		}

		public static ServiceAdapter Adapter { get; set; }

		/// <summary>
		/// Indicates whether all error information should be available on 
		/// the client.  This option should be used with caution.
		/// </summary>
		public static bool EnableExceptionInformation { get; set; }

		#endregion

		#region Events

		public static event EventHandler<ServiceRequestEventArgs> BeginRequest;

		public static event EventHandler<ServiceRequestEventArgs> EndRequest;

		public static event EventHandler<ServiceErrorEventArgs> Error;

		/// <summary>
		/// Raised before conditions related to a graph instance are included in the service response
		/// </summary>
		public static event EventHandler<EnsureConditionsEventArgs> EnsureConditions;

		/// <summary>
		/// Raises the <see cref="BeginRequest"/> event for the specified <see cref="ServiceRequest"/>.
		/// </summary>
		/// <param name="error"></param>
		internal static void OnBeginRequest(ServiceRequest request)
		{
			if (BeginRequest != null)
				BeginRequest(request, new ServiceRequestEventArgs(request, null));
		}

		/// <summary>
		/// Raises the <see cref="EndRequest"/> event for the specified <see cref="ServiceRequest"/>.
		/// </summary>
		/// <param name="error"></param>
		internal static void OnEndRequest(ServiceRequest request, ServiceResponse response)
		{
			if (EndRequest != null)
				EndRequest(request, new ServiceRequestEventArgs(request, response));
		}

		/// <summary>
		/// Raises the <see cref="Error"/> event for the specified <see cref="ServiceError"/>.
		/// </summary>
		/// <param name="error"></param>
		internal static void OnError(ServiceError error)
		{
			if (Error != null)
				Error(error, new ServiceErrorEventArgs(error));
		}

		/// <summary>
		/// Raises the <see cref="EnsureConditions"/> event
		/// </summary>
		/// <param name="dictionary"></param>
		internal static void OnEnsureConditions(ServiceResponse response, IEnumerable<GraphInstance> instances)
		{
			if (EnsureConditions != null)
				EnsureConditions(response, new EnsureConditionsEventArgs(instances));
		}
		#endregion

		#region Methods

		/// <summary>
		/// Generates a script tag to embed a model including instance data into a server-rendered view.
		/// </summary>
		/// <param name="query"></param>
		/// <returns></returns>
		public static string Model(object query)
		{
			return Model(query, (Delegate)null);
		}

		/// <summary>
		/// Generates a script tag to embed a model including instance data into a server-rendered view.
		/// Supports initial customization of the model via an initialization delegate.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="query"></param>
		/// <param name="init"></param>
		/// <returns></returns>
		public static string Model<T>(object query, Action<T> init)
		{
			return Model(query, (Delegate)init);
		}

		/// <summary>
		/// Generates a script tag to embed a model including instance data into a server-rendered view.
		/// Supports initial customization of the model via an initialization delegate.
		/// </summary>
		/// <typeparam name="T1"></typeparam>
		/// <typeparam name="T2"></typeparam>
		/// <param name="query"></param>
		/// <param name="init"></param>
		/// <returns></returns>
		public static string Model<T1, T2>(object query, Action<T1, T2> init)
		{
			return Model(query, (Delegate)init);
		}

		/// <summary>
		/// Generates a script tag to embed a model including instance data into a server-rendered view.
		/// Supports initial customization of the model via an initialization delegate.
		/// </summary>
		/// <typeparam name="T1"></typeparam>
		/// <typeparam name="T2"></typeparam>
		/// <typeparam name="T3"></typeparam>
		/// <param name="query"></param>
		/// <param name="init"></param>
		/// <returns></returns>
		public static string Model<T1, T2, T3>(object query, Action<T1, T2, T3> init)
		{
			return Model(query, (Delegate)init);
		}

		/// <summary>
		/// Generates a script tag to embed a model including instance data into a server-rendered view.
		/// Supports initial customization of the model via an initialization delegate.
		/// </summary>
		/// <typeparam name="T1"></typeparam>
		/// <typeparam name="T2"></typeparam>
		/// <typeparam name="T3"></typeparam>
		/// <typeparam name="T4"></typeparam>
		/// <param name="query"></param>
		/// <param name="init"></param>
		/// <returns></returns>
		public static string Model<T1, T2, T3, T4>(object query, Action<T1, T2, T3, T4> init)
		{
			return Model(query, (Delegate)init);
		}

		/// <summary>
		/// Generates a script tag to embed a model including instance data into a server-rendered view.
		/// Supports initial customization of the model via an initialization delegate.
		/// </summary>
		/// <param name="query"></param>
		/// <param name="init"></param>
		/// <returns></returns>
		static string Model(object query, Delegate init)
		{
			// Get the roots for each query
			var roots = new List<KeyValuePair<string, ServiceRequest.Query>>();
			foreach (var prop in query.GetType().GetProperties())
			{
				// Get the value of the model property
				var m = prop.GetValue(query, null);
				if (m == null)
					continue;

				// Convert the value into a query, if necessary
				var q = m as ServiceRequest.Query ?? Query(m);
				if (q != null)
				{
					q.LoadRoots(null);
					roots.Add(new KeyValuePair<string, ServiceRequest.Query>(prop.Name, q));
				}
			}

			// Perform the initialization action, if specified
			GraphTransaction initChanges = null;
			if (init != null)
			{
				// Determine matching parameters
				var parameters = new object[init.Method.GetParameters().Length];
				foreach (var p in init.Method.GetParameters())
				{
					foreach (var root in roots)
					{
						if (p.Name.Equals(root.Key, StringComparison.InvariantCultureIgnoreCase))
						{
							// List parameter
							if (p.ParameterType.IsArray)
								parameters[p.Position] = root.Value.Roots.Select(r => r.Instance).ToArray();

							// Instance parameter
							else
								parameters[p.Position] = root.Value.Roots.Select(r => r.Instance).FirstOrDefault();

							break;
						}
					}

					// Throw an exception if the model property value cannot be cast to the corresponding initialization parameter
					if (parameters[p.Position] != null && !p.ParameterType.IsAssignableFrom(parameters[p.Position].GetType()))
						throw new ArgumentException(String.Format("The model property '{0}' cannot be converted into the initialization parameter type of '{1}'.", p.Name, p.ParameterType.FullName));

					// Throw an exception if a valid model parameter could not be found to pass to the initialization delegate
					if (parameters[p.Position] == null && query.GetType().GetProperty(p.Name, BindingFlags.Public | BindingFlags.IgnoreCase | BindingFlags.Instance) == null)
						throw new ArgumentException(String.Format("A model property could not be found to pass to the initialization parameter '{0}'.", p.Name));
				}

				// Perform initialization while capturing changes
				using (initChanges = GraphContext.Current.BeginTransaction())
				{
					// Prevent property change rules from running until after initialization
					using (new GraphEventScope())
					{
						init.DynamicInvoke(parameters);
					}
					initChanges.Commit();
				}
			}

			// Execute the queries
			ServiceRequest request = new ServiceRequest(roots.Select(r => r.Value).ToArray());
			ServiceResponse response = request.Invoke();

			// Keep init and property get changes that were captured when processing the queries.
			GraphTransaction queryChanges = response.Changes;

			// Prepend initialization events for each instance created by the model queries
			var rootChanges = (GraphTransaction)request.Queries
					.SelectMany(q => q.Roots)
					.Where(i => i.IsNew)
					.Select(i => new GraphInitEvent.InitNew(i))
					.Cast<GraphEvent>()
					.ToList();

			// Combine all changes into a single graph transaction.
			response.Changes = GraphTransaction.Combine(new GraphTransaction[] { rootChanges, initChanges, queryChanges }.Where(t => t != null));

			response.Model = roots.ToDictionary(r => r.Key, r => r.Value);
			foreach (var q in response.Model.Values)
				q.ReducePaths();

			// Return the response
			return "<script type=\"text/javascript\">$exoweb(" + FixJsonDates(ToJson(typeof(ServiceResponse), response)) + ");</script>";
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <param name="type"></param>
		/// <param name="id"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query(string type, string id, params string[] paths)
		{
			return new ServiceRequest.Query(GraphContext.Current.GetGraphType(type), new string[] { id }, true, false, paths);
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="id"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query<T>(string id, params string[] paths)
		{
			return new ServiceRequest.Query(GraphContext.Current.GetGraphType<T>(), new string[] { id }, true, false, paths);
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <param name="type"></param>
		/// <param name="scope"></param>
		/// <param name="id"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query(string type, string id, ViewScope scope, params string[] paths)
		{
			return new ServiceRequest.Query(GraphContext.Current.GetGraphType(type), new string[] { id }, scope == ViewScope.InScope, false, paths);
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="id"></param>
		/// <param name="scope"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query<T>(string id, ViewScope scope, params string[] paths)
		{
			return new ServiceRequest.Query(GraphContext.Current.GetGraphType<T>(), new string[] { id }, scope == ViewScope.InScope, false, paths);
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query(object instance, params string[] paths)
		{
			return Query(instance, ViewScope.InScope, paths);
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="scope"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query(object instance, ViewScope scope, params string[] paths)
		{
			GraphType type;
			GraphInstance[] roots;
			bool isList;

			if (ExoWeb.TryConvertQueryInstance(instance, out type, out roots, out isList))
				return new ServiceRequest.Query(type, roots, scope == ViewScope.InScope, isList, paths);
			else
				return null;
		}

		public static ServiceRequest.Query Include(this object instance, params string[] paths)
		{
			var query = instance as ServiceRequest.Query;
			if (query != null)
				query.Include = query.Include.Concat(paths).ToArray();
			else
				query = Query(instance, paths);
			return query;
		}

		public static ServiceRequest.Query OutOfScope(this object instance)
		{
			var query = instance as ServiceRequest.Query;
			if (query != null)
				query.InScope = false;
			else
				query = Query(instance, ViewScope.OutOfScope);
			return query;
		}

		/// <summary>
		/// Attempt to infer a query request from an instance object.
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="type"></param>
		/// <param name="roots"></param>
		/// <param name="isList"></param>
		/// <returns></returns>
		internal static bool TryConvertQueryInstance(object instance, out GraphType type, out GraphInstance[] roots, out bool isList)
		{
			// Default the out parameters to null
			type = null;
			roots = null;
			isList = false;

			// Immediately return null if the query instance is null
			if (instance == null)
				return false;

			// Get the current graph context
			var context = GraphContext.Current;

			// Determine if the instance is a graph instance
			type = context.GetGraphType(instance);
			if (type != null)
			{
				roots = new GraphInstance[] { type.GetGraphInstance(instance) };

				if (roots[0].Type.Properties.Any())
					roots[0].OnPropertyGet(roots[0].Type.Properties.First());

				isList = false;
				return true;
			}

			// Otherwise, determine if the instance is a list of graph instances
			else if (instance is IEnumerable)
			{
				// Convert the list to an array of graph instances
				roots =
				(
					from element in ((IEnumerable)instance).Cast<object>()
					let elementType = context.GetGraphType(element)
					where elementType != null
					select elementType.GetGraphInstance(element)
				).ToArray();

				// Indicate that the instance represents a list
				isList = true;

				// If the array contains at least one graph instance, determine the base graph type
				if (roots.Length > 0)
				{
					type = roots[0].Type;
					foreach (var rootType in roots.Select(r => r.Type))
					{
						if (rootType.IsSubType(type))
							type = rootType;
					}
					return true;
				}

				// Otherwise, attempt to infer the graph type from the type of the list
				else
				{
					// First see if the type implements IEnumerable<T>
					var listType = instance.GetType();
					foreach (Type interfaceType in listType.GetInterfaces())
					{
						if (interfaceType.IsGenericType && interfaceType.GetGenericTypeDefinition() == typeof(ICollection<>))
						{
							type = context.GetGraphType(interfaceType.GetGenericArguments()[0]);
							if (type != null)
								return true;
						}
					}

					// Then see if the type implements IList and has a strongly-typed Item property indexed by an integer value
					if (typeof(IList).IsAssignableFrom(listType))
					{
						PropertyInfo itemProperty = listType.GetProperty("Item", new Type[] { typeof(int) });
						if (itemProperty != null)
						{
							type = context.GetGraphType(itemProperty.PropertyType);
							if (type != null)
								return true;
						}
					}
				}
			}

			// Return false to indicate that the instance could not be coerced into a valid query definition
			return false;
		}

		/// <summary>
		/// Determines whether a given property should be included in the
		/// model on the client.  
		/// </summary>
		/// <param name="property">The graph property that may be included.</param>
		/// <returns>A boolean value indicating whether to include the property.</returns>
		internal static bool IncludeInClientModel(GraphProperty property)
		{
			return !(property is GraphValueProperty) ||
				JsonConverter.GetJsonValueType(((GraphValueProperty)property).PropertyType) != null;
		}

		/// <summary>
		/// Manually registers a type to be included in list of allowable serializable type.  Use this method to use default serialization
		/// </summary>
		/// <param name="type"></param>
		public static void RegisterSerializableValueType(Type type)
		{
			serializableTypes.Add(type);
		}

		internal static string FixJsonDates(string json)
		{
			return dateRegex.Replace(json,
				(match) =>
				{
					var date = new DateTime((long.Parse(match.Groups["ticks"].Value) * 0x2710L) + minJsonTicks, DateTimeKind.Utc);
					return date.ToString(@"\""yyyy-MM-dd\THH:mm:ss.fff\Z\""");
				});
		}

		public static void RegisterConverters(IEnumerable<JavaScriptConverter> converters)
		{
			serializer.RegisterConverters(converters);
			serializableTypes.UnionWith(converters.SelectMany(c => c.SupportedTypes));
		}

		public static string ProcessRequest(string json)
		{
			ServiceRequest request = ExoWeb.FromJson<ServiceRequest>(json);
			return ExoWeb.FixJsonDates(ExoWeb.ToJson(typeof(ServiceResponse), request.Invoke()));
		}

		public static void RegisterForSerialization(Assembly assembly)
		{
			RegisterConverters(JsonConverter.Infer(assembly.GetTypes()).Cast<JavaScriptConverter>());
		}

		/// <summary>
		/// Indicates whether the specified type can be serialized.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		internal static bool IsSerializable(Type type)
		{
			return serializableTypes.Contains(type);
		}

		public static string GetTypes(params string[] types)
		{
			return GetTypes(types.Select(type => GraphContext.Current.GetGraphType(type)).ToArray());
		}

		public static string GetType<T>()
		{
			return GetTypes(GraphContext.Current.GetGraphType<T>());
		}

		static string GetTypes(params GraphType[] types)
		{
			var json = ToJson(typeof(ServiceResponse), new ServiceRequest(types).Invoke());
			return json.Substring(1, json.Length - 2);
		}

		#endregion

		#region JSON Serialization

		static void InitializeSerialization()
		{
			serializer = new JavaScriptSerializer();
			serializableTypes = new HashSet<Type>();

			// Register converters for types implementing IJsonSerializable or that have DataContract attributes
			// Include all types in ExoWeb and ExoRule automatically
			RegisterConverters(JsonConverter.Infer(
				typeof(ServiceHandler).Assembly.GetTypes().Union(
				typeof(Rule).Assembly.GetTypes().Where(type => typeof(Rule).IsAssignableFrom(type))))
				.Cast<JavaScriptConverter>());

			// Deserialize Value Change Event
			Func<Json, GraphValueChangeEvent> deserializeValueChangeEvent = (json) =>
			{
				GraphInstance instance = json.Get<GraphInstance>("instance");
				GraphValueProperty property = (GraphValueProperty)instance.Type.Properties[json.Get<string>("property")];
				return new GraphValueChangeEvent(instance, property, json.IsNull("oldValue") ? null : json.Get(property.PropertyType, "oldValue"), json.IsNull("newValue") ? null : json.Get(property.PropertyType, "newValue"));
			};

			// Deserialize Reference Change Event
			Func<Json, GraphReferenceChangeEvent> deserializeReferenceChangeEvent = (json) =>
			{
				GraphInstance instance = json.Get<GraphInstance>("instance");
				GraphReferenceProperty property = (GraphReferenceProperty)instance.Type.Properties[json.Get<string>("property")];
				return new GraphReferenceChangeEvent(instance, property, json.Get<GraphInstance>("oldValue"), json.Get<GraphInstance>("newValue"));
			};

			// Deserialize List Change Event
			Func<Json, GraphListChangeEvent> deserializeListChangeEvent = (json) =>
			{
				GraphInstance instance = json.Get<GraphInstance>("instance");
				GraphReferenceProperty property = (GraphReferenceProperty)instance.Type.Properties[json.Get<string>("property")];
				return new GraphListChangeEvent(instance, property, json.Get<GraphInstance[]>("added"), json.Get<GraphInstance[]>("removed"));
			};

			// Deserialize Init New Event
			Func<Json, GraphInitEvent.InitNew> deserializeInitNewEvent =
				(json) => new GraphInitEvent.InitNew(json.Get<GraphInstance>("instance"));

			// Deserialize Init Existing Event
			Func<Json, GraphInitEvent.InitExisting> deserializeInitExistingEvent =
				(json) => new GraphInitEvent.InitExisting(json.Get<GraphInstance>("instance"));

			// Deserialize Delete Event
			Func<Json, GraphDeleteEvent> deserializeDeleteEvent = (json) => new GraphDeleteEvent(json.Get<GraphInstance>("instance"));

			// Construct Graph Instance
			var createGraphInstance = typeof(GraphInstance).GetConstructor(
				BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance,
				null,
				new Type[] { typeof(GraphType), typeof(string) },
				null);

			// Register custom converters for GraphType, GraphProperty, GraphMethod, GraphInstance, GraphEvent
			RegisterConverters(
				new JavaScriptConverter[] 
			{
				// Graph Type
				new JsonConverter<GraphType>(
					(graphType, json) =>
					{
						// Base Type
						if (graphType.BaseType != null)
							json.Set("baseType", JsonConverter.GetJsonReferenceType(graphType.BaseType));

						// Properties
						json.Set("properties", graphType.Properties
							.Where(property => property.DeclaringType == graphType && IncludeInClientModel(property))
							.ToDictionary(property => property.Name));

						// Methods
						json.Set("methods", graphType.Methods.ToDictionary(method => method.Name));

						// Condition Types
						json.Set("conditionTypes", 
							Rule.GetRegisteredRules(graphType)
								.Where(rule => !(rule is PropertyRule) || IncludeInClientModel(((PropertyRule)rule).Property))
								.SelectMany(rule => rule.ConditionTypes)
								.ToDictionary(conditionType => conditionType.Code));
					}, 
					json => { throw new NotSupportedException("GraphType cannot be deserialized."); }),

				// Graph Property
				new JsonConverter<GraphProperty>(
					(property, json) =>
					{
						// Type
						json.Set("type", (property is GraphValueProperty ?
							JsonConverter.GetJsonValueType(((GraphValueProperty)property).PropertyType) ?? "Object" :
							JsonConverter.GetJsonReferenceType(((GraphReferenceProperty)property).PropertyType)) +
							(property.IsList ? "[]" : ""));

						// IsStatic
						if (property.IsStatic)
							json.Set("isStatic", true);

						// Index
						int index = 0;
						foreach (GraphProperty p in property.DeclaringType.Properties)
						{
							if (p == property)
								break;
							if (IncludeInClientModel(p) && !p.IsStatic)
								index++;
						}
						if (!property.IsStatic)
							json.Set("index", index);

						// Format
						string formatName = ExoWeb.Adapter.GetFormatName(property);
						if (!string.IsNullOrEmpty(formatName))
							json.Set("format", formatName);

						// Label
						string label = ExoWeb.Adapter.GetLabel(property);
						if (!string.IsNullOrEmpty(label))
							json.Set("label", label);
					}, 
					json => { throw new NotSupportedException("GraphProperty cannot be deserialized."); }),

					// Graph Method
					new JsonConverter<GraphMethod>(
						(method, json) =>
						{
							// Parameters
							json.Set("parameters", method.Parameters.Select(p => p.Name));

							// IsStatic
							json.Set("isStatic", method.IsStatic);
						},
						json => { throw new NotSupportedException("GraphMethod cannot be deserialized."); }),

					// Graph Instance
					new JsonConverter<GraphInstance>(
						(instance, json) =>
						{
							json.Set("id", instance.Id);
							json.Set("type", instance.Type.Name);
						},
						json => 
							(GraphInstance)createGraphInstance.Invoke(new object[] { 
								GraphContext.Current.GetGraphType(json.Get<string>("type")), 
								json.Get<string>("id") })),

					// Graph Event
					new JsonConverter<GraphEvent>(
						(instance, json) => { throw new NotSupportedException("GraphEvent cannot be serialized."); },
						(json) =>
						{
							switch (json.Get<string>("type"))
							{
								case "ValueChange" : return deserializeValueChangeEvent(json);
								case "ReferenceChange" : return deserializeReferenceChangeEvent(json);
								case "ListChange" : return deserializeListChangeEvent(json);
								case "InitNew" : return deserializeInitNewEvent(json);
								case "InitExisting" : return deserializeInitExistingEvent(json);
								case "Delete" : return deserializeDeleteEvent(json);
							}
							return null;
						}),

					// Graph Value Change Event
					new JsonConverter<GraphValueChangeEvent>(
						(graphEvent, json) =>
						{
							json.Set("type", "ValueChange");
							json.Set("instance", GetEventInstance(graphEvent.Instance, graphEvent.InstanceId));
							json.Set("property", graphEvent.Property.Name);
							json.Set("oldValue", graphEvent.OldValue);
							json.Set("newValue", graphEvent.NewValue);
						},
						deserializeValueChangeEvent),
							
					// Graph Reference Change Event
					new JsonConverter<GraphReferenceChangeEvent>(
						(graphEvent, json) =>
						{
							json.Set("type", "ReferenceChange");
							json.Set("instance", GetEventInstance(graphEvent.Instance, graphEvent.InstanceId));
							json.Set("property", graphEvent.Property.Name);
							json.Set("oldValue", GetEventInstance(graphEvent.OldValue, graphEvent.OldValueId));
							json.Set("newValue", GetEventInstance(graphEvent.NewValue, graphEvent.NewValueId));
						},
						deserializeReferenceChangeEvent),
							
					// Graph List Change Event
					new JsonConverter<GraphListChangeEvent>(
						(graphEvent, json) =>
						{
							json.Set("type", "ListChange");
							json.Set("instance", GetEventInstance(graphEvent.Instance, graphEvent.InstanceId));
							json.Set("property", graphEvent.Property.Name);
							json.Set("added", graphEvent.Added.Select((instance, index) => GetEventInstance(instance, graphEvent.AddedIds.ElementAt(index))));
							json.Set("removed", graphEvent.Removed.Select((instance, index) => GetEventInstance(instance, graphEvent.RemovedIds.ElementAt(index))));
						},
						deserializeListChangeEvent),
							
					// Graph Init New Event
					new JsonConverter<GraphInitEvent.InitNew>(
						(graphEvent, json) =>
						{
							json.Set("type", "InitNew");
							json.Set("instance", GetEventInstance(graphEvent.Instance, graphEvent.InstanceId));
						},
						deserializeInitNewEvent),
							
					// Graph Init Existing Event
					new JsonConverter<GraphInitEvent.InitExisting>(
						(graphEvent, json) =>
						{
							json.Set("type", "InitExisting");
							json.Set("instance", GetEventInstance(graphEvent.Instance, graphEvent.InstanceId));
						},
						deserializeInitExistingEvent),
							
					// Graph Delete Event
					new JsonConverter<GraphDeleteEvent>(
						(graphEvent, json) =>
						{
							json.Set("type", "Delete");
							json.Set("instance", GetEventInstance(graphEvent.Instance, graphEvent.InstanceId));
						},
						deserializeDeleteEvent),
														
					// Graph Save Event
					new JsonConverter<GraphSaveEvent>(
						(graphEvent, json) =>
						{
							json.Set("type", "Save");
							json.Set("instance", GetEventInstance(graphEvent.Instance, graphEvent.InstanceId));
							json.Set("idChanges", graphEvent.IdChanges);
						},
						json => { throw new NotSupportedException("GraphSaveEvent cannot be deserialized."); }),
																					
					// Id Change
					new JsonConverter<GraphSaveEvent.IdChange>(
						(change, json) =>
						{
							json.Set("type", change.Type.Name);
							json.Set("oldId", change.OldId);
							json.Set("newId", change.NewId);
						},
						json => { throw new NotSupportedException("GraphSaveEvent.IdChange cannot be deserialized."); }),

					// Condition Type
					new JsonConverter<ConditionType>(
						(conditionType, json) =>
						{
							json.Set("category", conditionType.Category.ToString());

							if (conditionType.Sets != null && conditionType.Sets.Length > 0)
								json.Set("sets", conditionType.Sets.Select(set => set.Name));

							json.Set("message", conditionType.Message);

							// Only serialize rules that are explicitly marked for client execution
							if ((conditionType.ConditionRule != null && (conditionType.ConditionRule.ExecutionLocation & RuleExecutionLocation.Client) == RuleExecutionLocation.Client))
								json.Set("rule", conditionType.ConditionRule);
						},
						json => { throw new NotSupportedException("ConditionType cannot be deserialized."); }),

					// Condition
					new JsonConverter<Condition>(
						(condition, json) =>
						{
							if (condition.Message != condition.Type.Message)
								json.Set("message", condition.Message);

							json.Set("targets", condition.Targets);
						},
						json => { throw new NotSupportedException("Condition cannot be deserialized."); }),

					// Condition Target
					new JsonConverter<ConditionTarget>(
						(conditionTarget, json) =>
						{
							json.Set("instance", conditionTarget.Target);

							json.Set("properties", conditionTarget.Properties);
						},
						json => { throw new NotSupportedException("ConditionTarget cannot be deserialized."); }),

					// AllowedValuesRule
					new JsonConverter<AllowedValuesRule>(
						(rule, json) =>
						{
							json.Set("type", "allowedValues");

							json.Set("property", rule.Property.Name);

							json.Set("source", rule.IsStaticSource ? rule.Source : "this." + rule.Source);
						},
						json => { throw new NotSupportedException("AllowedValuesRule cannot be deserialized."); }),
						
					// CompareRule
					new JsonConverter<CompareRule>(
						(rule, json) =>
						{
							json.Set("type", "compare");

							json.Set("property", rule.Property.Name);

							json.Set("compareSource", rule.CompareSourceIsStatic ? rule.CompareSource : "this." + rule.CompareSource);

							json.Set("compareOperator", rule.CompareOperator.ToString());
						},
						json => { throw new NotSupportedException("CompareRule cannot be deserialized."); }),

					// RequiredIfRule
					new JsonConverter<RequiredIfRule>(
						(rule, json) =>
						{
							json.Set("type", "requiredIf");

							json.Set("property", rule.Property.Name);

							json.Set("compareSource", rule.CompareSourceIsStatic ? rule.CompareSource : "this." + rule.CompareSource);

							json.Set("compareOperator", rule.CompareOperator.ToString());

							json.Set("compareValue", rule.CompareValue);
						},
						json => { throw new NotSupportedException("RequiredIfRule cannot be deserialized."); }),
			});

			// Cache the method info of the deserialize method
			// The non-generic version of this method was added in .NET 4.0
			deserialize = serializer.GetType().GetMethod("Deserialize", new Type[] { typeof(string) });
		}

		static Dictionary<string, string> GetEventInstance(GraphInstance instance, string id)
		{
			if (instance == null)
				return null;
			else
				return new Dictionary<string, string>() { { "type", instance.Type.Name }, { "id", id } };
		}

		/// <summary>
		/// Deserializes a JSON string into the specified type.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="json"></param>
		/// <returns></returns>
		internal static T FromJson<T>(string json)
		{
			return (T)FromJson(typeof(T), json);
		}

		/// <summary>
		/// Deserializes a JSON string into the specified type.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="json"></param>
		/// <returns></returns>
		internal static object FromJson(Type type, string json)
		{
			return deserialize.MakeGenericMethod(type).Invoke(serializer, new object[] { json });
		}

		/// <summary>
		/// Serializes a typed value into a JSON string.
		/// </summary>
		/// <param name="type"></param>
		/// <param name="value"></param>
		/// <returns></returns>
		internal static string ToJson(Type type, object value)
		{
			return serializer.Serialize(value);
		}

		#endregion
	}
}
