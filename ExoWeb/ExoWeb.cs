using System;
using System.Collections.Generic;
using System.Linq;
using ExoModel;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using ExoRule.Validation;
using ExoRule;
using System.Collections;
using ExoWeb.Templates;
using System.IO;
using ExoWeb.Templates.JavaScript;
using System.Web;

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
		static MethodInfo createHtmlString = Type.GetType("System.Web.Mvc.MvcHtmlString, System.Web.Mvc") != null ?
			Type.GetType("System.Web.Mvc.MvcHtmlString, System.Web.Mvc").GetMethod("Create", BindingFlags.Static | BindingFlags.Public, null, new Type[] { typeof(string) }, null) : null;

		#endregion

		#region Constructors

		static ExoWeb()
		{
			// Configure default serialization
			InitializeSerialization();

			// Cache the .NET 4.0 method info to create HTML strings when using MVC
			var assembly = Assembly.LoadWithPartialName("System.Web.Mvc");
			if (assembly != null)
			{
				var type = assembly.GetType("System.Web.Mvc.MvcHtmlString");
				if (type != null)
					createHtmlString = type.GetMethod("Create", BindingFlags.Static | BindingFlags.Public, null, new Type[] { typeof(string) }, null);
			}

			// Initialize the default implementation of the cache hash provider
			CacheHashProvider = () =>
			{
				if (cacheHash == null)
				{
					int code = 0;

					foreach (Assembly a in AppDomain.CurrentDomain.GetAssemblies())
						code = code == 0 ? a.GetHashCode() : code ^ a.GetHashCode();

					cacheHash = code.ToString();
				}
				return cacheHash;
			};

			// Enable server rendering by default
			EnableServerRendering = true;
		}

		#endregion

		#region Properties

		/// <summary>
		/// Gets a unique cache key to use when referencing client scripts to ensure that application
		/// changes cause browsers to pull down new type schema information.
		/// </summary>
		public static Func<string> CacheHashProvider { get; set; }

		/// <summary>
		/// Gets a unique cache key to use when referencing client scripts to ensure that application
		/// changes cause browsers to pull down new type schema information.
		/// </summary>
		public static string CacheHash
		{
			get
			{
				return CacheHashProvider();
			}
		}

		/// <summary>
		/// Indicates whether all error information should be available on 
		/// the client.  This option should be used with caution.
		/// </summary>
		public static bool EnableExceptionInformation { get; set; }

		/// <summary>
		/// Indicates whether server rendering should be enabled either using the <see cref="Render"/> method
		/// or the <see cref="Templates.Render"/> server control to render templates on the server as
		/// part of the initial page request.
		/// </summary>
		public static bool EnableServerRendering { get; set; }

		#endregion

		#region Events

		public static event EventHandler<ServiceRequestEventArgs> BeginRequest;

		public static event EventHandler<ServiceRequestEventArgs> EndRequest;

		public static event EventHandler<Templates.RenderEventArgs> BeginRender;

		public static event EventHandler<Templates.RenderEventArgs> EndRender;

		public static event EventHandler<ServiceErrorEventArgs> Error;

		/// <summary>
		/// Raised before conditions related to a model instance are included in the service response
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
		/// Raises the <see cref="BeginRender"/> event for the specified <see cref="Page"/> and <see cref="ITemplate"/>.
		/// </summary>
		/// <param name="error"></param>
		internal static void OnBeginRender(Page page, ITemplate template)
		{
			if (BeginRender != null)
				BeginRender(page, new RenderEventArgs(page, template));
		}

		/// <summary>
		/// Raises the <see cref="EndRender"/> event for the specified <see cref="Page"/> and <see cref="ITemplate"/>.
		/// </summary>
		/// <param name="error"></param>
		internal static void OnEndRender(Page page, ITemplate template)
		{
			if (EndRender != null)
				EndRender(page, new RenderEventArgs(page, template));
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
		internal static void OnEnsureConditions(ServiceResponse response, IEnumerable<ModelInstance> instances)
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
		public static object Model(object query)
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
		public static object Model<T>(object query, Action<T> init)
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
		public static object Model<T1, T2>(object query, Action<T1, T2> init)
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
		public static object Model<T1, T2, T3>(object query, Action<T1, T2, T3> init)
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
		public static object Model<T1, T2, T3, T4>(object query, Action<T1, T2, T3, T4> init)
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
		static object Model(object query, Delegate init)
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

			// Create the request object
			ServiceRequest request = new ServiceRequest(roots.Select(r => r.Value).ToArray());

			// Synthesize init new changes for new query roots
			ModelTransaction initChanges = (ModelTransaction)request.Queries
					.SelectMany(q => q.Roots)
					.Where(i => i.IsNew)
					.Select(i => new ModelInitEvent.InitNew(i))
					.Cast<ModelEvent>()
					.ToList();

			// Perform the initialization action, if specified
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
				initChanges.Record(() =>
				{
					// Prevent property change rules from running until after initialization
					ModelEventScope.Perform(() => init.DynamicInvoke(parameters));
				});
			}

			// Invoke the request queries
			ServiceResponse response = request.Invoke(initChanges);

			response.Model = roots.ToDictionary(r => r.Key, r => r.Value);
			foreach (var q in response.Model.Values)
				q.ReducePaths();

			// Track the current model roots to support server template rendering
			foreach (var root in response.Model)
				Templates.Page.Current.Model[root.Key] = root.Value.IsList ? (object)root.Value.Roots : (root.Value.Roots.Length == 1 ?root.Value.Roots[0] : null);

			// Return the response
			return GetHtmlString("<script type=\"text/javascript\">$exoweb(" + ToJson(typeof(ServiceResponse), response) + ");</script>");
		}

		/// <summary>
		/// Loads the specified templates and emits the script logic register them for use on the client while also making them available for server rendering.
		/// </summary>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static object LoadTemplates(params string[] paths)
		{
			Templates.Page.Current.Templates.AddRange(paths.SelectMany(p => Templates.Page.Current.LoadTemplates(System.Web.HttpContext.Current.Server.MapPath(p))).Reverse());
			var urls = paths.Select(p => p.StartsWith("~") ? System.Web.VirtualPathUtility.ToAbsolute(p) : p).Select(p => p + (p.Contains("?") ? "&" : "?") + "cachehash=" + ExoWeb.CacheHash);
			return GetHtmlString("<script type=\"text/javascript\">$exoweb(function () {" + urls.Aggregate("", (js, url) => js + "ExoWeb.UI.Template.load(\"" + url + "\"); ") + "});</script>");
		}

		/// <summary>
		/// Renders the specified template using the current model and loaded templates.
		/// </summary>
		/// <param name="template"></param>
		/// <returns>
		/// The HTML result of the rendering process, either as <see cref="string"/> or
		/// <see cref="IHtmlString"/> if MVC assemblies are available.
		/// </returns>
		public static object Render(Func<object, object> template)
		{
			var markup = template(null).ToString();
			if (EnableServerRendering)
			{
				using (var writer = new StringWriter())
				{
					Page.Current.Parse(HttpContext.Current.Request.Path, markup).Render(Page.Current, writer);
					return GetHtmlString(writer.ToString());

				}
			}
			else
				return GetHtmlString(markup);
		}

		/// <summary>
		/// Attempts to coerce a string into an IHtmlString for use in MVC applications.
		/// Since ExoWeb currently targets .NET 3.5, this method attempts to call a .NET 4.0 
		/// method via reflection but gracefully degrades by returning the original string.
		/// </summary>
		/// <param name="value"></param>
		/// <returns></returns>
		static object GetHtmlString(string value)
		{
			return createHtmlString != null ? createHtmlString.Invoke(null, new object[] { value }) : value;
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
			return new ServiceRequest.Query(ModelContext.Current.GetModelType(type), new string[] { id }, true, false, paths);
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
			return Query(typeof(T), id, paths);
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
			return new ServiceRequest.Query(ModelContext.Current.GetModelType(type), new string[] { id }, scope == ViewScope.InScope, false, paths);
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
			return Query(typeof(T), id, scope, paths);
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <param name="type"></param>
		/// <param name="id"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query(Type type, string id, params string[] paths)
		{
			return new ServiceRequest.Query(ModelContext.Current.GetModelType(type), new string[] { id }, true, false, paths);
		}

		/// <summary>
		/// Creates a query to load an instance and a set of options paths.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="id"></param>
		/// <param name="scope"></param>
		/// <param name="paths"></param>
		/// <returns></returns>
		public static ServiceRequest.Query Query(Type type, string id, ViewScope scope, params string[] paths)
		{
			return new ServiceRequest.Query(ModelContext.Current.GetModelType(type), new string[] { id }, scope == ViewScope.InScope, false, paths);
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
			ModelType type;
			ModelInstance[] roots;
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
		internal static bool TryConvertQueryInstance(object instance, out ModelType type, out ModelInstance[] roots, out bool isList)
		{
			// Default the out parameters to null
			type = null;
			roots = null;
			isList = false;

			// Immediately return null if the query instance is null
			if (instance == null)
				return false;

			// Get the current model context
			var context = ModelContext.Current;

			// Determine if the instance is a model instance
			type = context.GetModelType(instance);
			if (type != null)
			{
				roots = new ModelInstance[] { type.GetModelInstance(instance) };

				if (roots[0].Type.Properties.Any())
					roots[0].OnPropertyGet(roots[0].Type.Properties.First());

				isList = false;
				return true;
			}

			// Otherwise, determine if the instance is a list of model instances
			else if (instance is IEnumerable)
			{
				// Convert the list to an array of model instances
				roots =
				(
					from element in ((IEnumerable)instance).Cast<object>()
					let elementType = context.GetModelType(element)
					where elementType != null
					select elementType.GetModelInstance(element)
				).ToArray();

				// Indicate that the instance represents a list
				isList = true;

				// If the array contains at least one model instance, determine the base model type
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

				// Otherwise, attempt to infer the model type from the type of the list
				else
				{
					// First see if the type implements IEnumerable<T>
					var listType = instance.GetType();
					foreach (Type interfaceType in listType.GetInterfaces())
					{
						if (interfaceType.IsGenericType && interfaceType.GetGenericTypeDefinition() == typeof(ICollection<>))
						{
							type = context.GetModelType(interfaceType.GetGenericArguments()[0]);
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
							type = context.GetModelType(itemProperty.PropertyType);
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
		/// <param name="property">The model property that may be included.</param>
		/// <returns>A boolean value indicating whether to include the property.</returns>
		internal static bool IncludeInClientModel(ModelProperty property)
		{
			return !(property is ModelValueProperty) ||
				JsonConverter.GetJsonValueType(((ModelValueProperty)property).PropertyType) != null;
		}

		/// <summary>
		/// Manually registers a type to be included in list of allowable serializable type.  Use this method to use default serialization
		/// </summary>
		/// <param name="type"></param>
		public static void RegisterSerializableValueType(Type type)
		{
			serializableTypes.Add(type);
		}

		private static string FixJsonDates(string json)
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
			return ExoWeb.ToJson(typeof(ServiceResponse), request.Invoke(null));
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
			return GetTypes(types.Select(type => ModelContext.Current.GetModelType(type)).ToArray());
		}

		public static string GetType<T>()
		{
			return GetTypes(ModelContext.Current.GetModelType<T>());
		}

		static string GetTypes(params ModelType[] types)
		{
			var json = ToJson(typeof(ServiceResponse), new ServiceRequest(types).Invoke(null));
			return json.Substring(1, json.Length - 2);
		}

		#endregion

		#region JSON Serialization

		static void InitializeSerialization()
		{
			serializer = new JavaScriptSerializer() { MaxJsonLength = Int32.MaxValue };
			serializableTypes = new HashSet<Type>();

			// Register converters for types implementing IJsonSerializable or that have DataContract attributes
			// Include all types in ExoWeb and ExoRule automatically
			RegisterConverters(JsonConverter.Infer(
				typeof(ServiceHandler).Assembly.GetTypes().Union(
				typeof(Rule).Assembly.GetTypes().Where(type => typeof(Rule).IsAssignableFrom(type))))
				.Cast<JavaScriptConverter>());

			// Deserialize Value Change Event
			Func<Json, ModelValueChangeEvent> deserializeValueChangeEvent = (json) =>
			{
				ModelInstance instance = json.Get<ModelInstance>("instance");
				ModelValueProperty property = (ModelValueProperty)instance.Type.Properties[json.Get<string>("property")];
				return new ModelValueChangeEvent(instance, property, json.IsNull("oldValue") ? null : json.Get(property.PropertyType, "oldValue"), json.IsNull("newValue") ? null : json.Get(property.PropertyType, "newValue"));
			};

			// Deserialize Reference Change Event
			Func<Json, ModelReferenceChangeEvent> deserializeReferenceChangeEvent = (json) =>
			{
				ModelInstance instance = json.Get<ModelInstance>("instance");
				ModelReferenceProperty property = (ModelReferenceProperty)instance.Type.Properties[json.Get<string>("property")];
				return new ModelReferenceChangeEvent(instance, property, json.Get<ModelInstance>("oldValue"), json.Get<ModelInstance>("newValue"));
			};

			// Deserialize List Change Event
			Func<Json, ModelListChangeEvent> deserializeListChangeEvent = (json) =>
			{
				ModelInstance instance = json.Get<ModelInstance>("instance");
				ModelReferenceProperty property = (ModelReferenceProperty)instance.Type.Properties[json.Get<string>("property")];
				return new ModelListChangeEvent(instance, property, json.Get<ModelInstance[]>("added"), json.Get<ModelInstance[]>("removed"));
			};

			// Deserialize Init New Event
			Func<Json, ModelInitEvent.InitNew> deserializeInitNewEvent =
				(json) => new ModelInitEvent.InitNew(json.Get<ModelInstance>("instance"));

			// Deserialize Init Existing Event
			Func<Json, ModelInitEvent.InitExisting> deserializeInitExistingEvent =
				(json) => new ModelInitEvent.InitExisting(json.Get<ModelInstance>("instance"));

			// Deserialize Delete Event
			Func<Json, ModelDeleteEvent> deserializeDeleteEvent = (json) => new ModelDeleteEvent(json.Get<ModelInstance>("instance"), json.Get<bool>("isPendingDelete"));

			// Construct Model Instance
			var createModelInstance = typeof(ModelInstance).GetConstructor(
				BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance,
				null,
				new Type[] { typeof(ModelType), typeof(string) },
				null);

			// Register custom converters for ModelType, ModelProperty, ModelMethod, ModelInstance, ModelEvent
			RegisterConverters(
				new JavaScriptConverter[] 
			{
				// Model Type
				new JsonConverter<ModelType>(
					(modelType, json) =>
					{
						// Base Type
						if (modelType.BaseType != null)
							json.Set("baseType", JsonConverter.GetJsonReferenceType(modelType.BaseType));

						// Base Type
						if (!String.IsNullOrEmpty(modelType.Format))
							json.Set("format", modelType.Format);

						// Properties
						json.Set("properties", modelType.Properties
							.Where(property => property.DeclaringType == modelType && IncludeInClientModel(property))
							.ToDictionary(property => property.Name));

						// Methods
						json.Set("methods", modelType.Methods.ToDictionary(method => method.Name));

						// Condition Types
						json.Set("conditionTypes", 
							Rule.GetRegisteredRules(modelType)
								.Where(rule => !(rule is PropertyRule) || IncludeInClientModel(((PropertyRule)rule).Property))
								.SelectMany(rule => rule.ConditionTypes)
								.ToDictionary(conditionType => conditionType.Code));
					}, 
					json => { throw new NotSupportedException("ModelType cannot be deserialized."); }),

				// Model Property
				new JsonConverter<ModelProperty>(
					(property, json) =>
					{
						// Type
						string type = (property is ModelValueProperty ?
							JsonConverter.GetJsonValueType(((ModelValueProperty)property).PropertyType) ?? "Object" :
							JsonConverter.GetJsonReferenceType(((ModelReferenceProperty)property).PropertyType)) +
							(property.IsList ? "[]" : "");
						json.Set("type", type);

						// IsStatic
						if (property.IsStatic)
							json.Set("isStatic", true);

						// IsPersisted
						if (!property.IsPersisted && !property.IsStatic)
							json.Set("isPersisted", false);

						// Index
						int index = 0;
						foreach (ModelProperty p in property.DeclaringType.Properties)
						{
							if (p == property)
								break;
							if (IncludeInClientModel(p) && !p.IsStatic)
								index++;
						}
						if (!property.IsStatic)
							json.Set("index", index);

						// Format
						string format = property.Format;
						if (!string.IsNullOrEmpty(format))
							json.Set("format", format);

						// Label
						string label = property.Label;
						if (!string.IsNullOrEmpty(label))
							json.Set("label", label);
					}, 
					json => { throw new NotSupportedException("ModelProperty cannot be deserialized."); }),

					// Model Method
					new JsonConverter<ModelMethod>(
						(method, json) =>
						{
							// Parameters
							json.Set("parameters", method.Parameters.Select(p => p.Name));

							// IsStatic
							json.Set("isStatic", method.IsStatic);
						},
						json => { throw new NotSupportedException("ModelMethod cannot be deserialized."); }),

					// Model Instance
					new JsonConverter<ModelInstance>(
						(instance, json) =>
						{
							json.Set("id", instance.Id);
							json.Set("type", instance.Type.Name);
						},
						json => 
							(ModelInstance)createModelInstance.Invoke(new object[] { 
								ModelContext.Current.GetModelType(json.Get<string>("type")), 
								json.Get<string>("id") })),

					// Model Event
					new JsonConverter<ModelEvent>(
						(instance, json) => { throw new NotSupportedException("ModelEvent cannot be serialized."); },
						(json) =>
						{
							string eventName = json.Get<string>("type");
							switch (eventName)
							{
								case "ValueChange" : return deserializeValueChangeEvent(json);
								case "ReferenceChange" : return deserializeReferenceChangeEvent(json);
								case "ListChange" : return deserializeListChangeEvent(json);
								case "InitNew" : return deserializeInitNewEvent(json);
								case "InitExisting" : return deserializeInitExistingEvent(json);
								case "Delete" : return deserializeDeleteEvent(json);
							}
							throw new NotSupportedException(eventName + " event cannot be deserialized.");;
						}),

					// Model Value Change Event
					new JsonConverter<ModelValueChangeEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "ValueChange");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("property", modelEvent.Property.Name);
							json.Set("oldValue", modelEvent.OldValue);
							json.Set("newValue", modelEvent.NewValue);
						},
						deserializeValueChangeEvent),
							
					// Model Reference Change Event
					new JsonConverter<ModelReferenceChangeEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "ReferenceChange");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("property", modelEvent.Property.Name);
							json.Set("oldValue", GetEventInstance(modelEvent.OldValue, modelEvent.OldValueId));
							json.Set("newValue", GetEventInstance(modelEvent.NewValue, modelEvent.NewValueId));
						},
						deserializeReferenceChangeEvent),
							
					// Model List Change Event
					new JsonConverter<ModelListChangeEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "ListChange");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("property", modelEvent.Property.Name);
							json.Set("added", modelEvent.Added.Select((instance, index) => GetEventInstance(instance, modelEvent.AddedIds.ElementAt(index))));
							json.Set("removed", modelEvent.Removed.Select((instance, index) => GetEventInstance(instance, modelEvent.RemovedIds.ElementAt(index))));
						},
						deserializeListChangeEvent),
							
					// Model Init New Event
					new JsonConverter<ModelInitEvent.InitNew>(
						(modelEvent, json) =>
						{
							json.Set("type", "InitNew");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
						},
						deserializeInitNewEvent),
							
					// Model Init Existing Event
					new JsonConverter<ModelInitEvent.InitExisting>(
						(modelEvent, json) =>
						{
							json.Set("type", "InitExisting");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
						},
						deserializeInitExistingEvent),
							
					// Model Delete Event
					new JsonConverter<ModelDeleteEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "Delete");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("isPendingDelete", modelEvent.IsPendingDelete);
						},
						deserializeDeleteEvent),
														
					// Model Save Event
					new JsonConverter<ModelSaveEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "Save");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("added", modelEvent.Added.Select(instance => new Dictionary<string, string>() 
								{ { "type", instance.Type.Name }, { "oldId", instance.OriginalId }, { "newId", instance.Id } }));
							json.Set("modified", modelEvent.Modified);
							json.Set("deleted", modelEvent.Deleted);
						},
						json => { throw new NotSupportedException("ModelSaveEvent cannot be deserialized."); }),

					// Condition Type
					new JsonConverter<ConditionType>(
						(conditionType, json) =>
						{
							json.Set("category", conditionType.Category.ToString());

							if (conditionType.Sets != null && conditionType.Sets.Any())
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
							SerializePropertyRule(rule, json);
							json.Set("source", rule.IsStaticSource ? rule.Source : "this." + rule.Source);
						},
						json => { throw new NotSupportedException("AllowedValuesRule cannot be deserialized."); }),
						
					// CompareRule
					new JsonConverter<CompareRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("compareOperator", rule.CompareOperator.ToString());
							json.Set("compareSource", rule.CompareSourceIsStatic ? rule.CompareSource : "this." + rule.CompareSource);
						},
						json => { throw new NotSupportedException("CompareRule cannot be deserialized."); }),

					// ListLengthRule
					new JsonConverter<ListLengthRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("compareOperator", rule.CompareOperator.ToString());
							json.Set("compareSource", rule.CompareSourceIsStatic ? rule.CompareSource : "this." + rule.CompareSource);
							json.Set("staticLength", rule.StaticLength.ToString());
						},
						json => { throw new NotSupportedException("ListLengthRule cannot be deserialized."); }),

					// RangeRule
					new JsonConverter<RangeRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("min", rule.Minimum);
							json.Set("max", rule.Maximum);
						},
						json => { throw new NotSupportedException("RangeRule cannot be deserialized."); }),

					// RequiredRule
					new JsonConverter<RequiredRule>(
						(rule, json) =>
						{
							json.Set("type", "required");
							json.Set("property", rule.Property.Name);
						},
						json => { throw new NotSupportedException("RequiredRule cannot be deserialized."); }),

					// RequiredIfRule
					new JsonConverter<RequiredIfRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("compareOperator", rule.CompareOperator.ToString());
							json.Set("compareSource", rule.CompareSourceIsStatic ? rule.CompareSource : "this." + rule.CompareSource);
							json.Set("compareValue", rule.CompareValue);
						},
						json => { throw new NotSupportedException("RequiredIfRule cannot be deserialized."); }),

					// OwnerRule
					new JsonConverter<OwnerRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
						},
						json => { throw new NotSupportedException("OwnerRule cannot be deserialized."); }),

					// StringLengthRule
					new JsonConverter<StringLengthRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							if (rule.Minimum > 0)
								json.Set("min", rule.Minimum);
							if (rule.Maximum > 0)
								json.Set("max", rule.Maximum);
						},
						json => { throw new NotSupportedException("StringLengthRule cannot be deserialized."); }),

					// StringFormatRule
					new JsonConverter<StringFormatRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							if (!String.IsNullOrEmpty(rule.FormatDescription))
								json.Set("description", rule.FormatDescription);
							json.Set("expression", rule.FormatExpression.ToString());
							if (!String.IsNullOrEmpty(rule.ReformatExpression))
								json.Set("reformat", rule.ReformatExpression);
						},
						json => { throw new NotSupportedException("StringFormatRule cannot be deserialized."); }),

			});

			// Cache the method info of the deserialize method
			// The non-generic version of this method was added in .NET 4.0
			deserialize = serializer.GetType().GetMethod("Deserialize", new Type[] { typeof(string) });
		}

		/// <summary>
		/// Performs default serialization for subclasses of <see cref="PropertyRule"/>.
		/// </summary>
		/// <param name="rule"></param>
		/// <param name="json"></param>
		static void SerializePropertyRule(PropertyRule rule, Json json)
		{
			string ruleName = rule.GetType().Name;
			if (ruleName.EndsWith("Rule"))
				ruleName = ruleName.Substring(0, ruleName.Length - 4);
			ruleName = ruleName[0].ToString().ToLower() + ruleName.Substring(1);
			json.Set("type", ruleName);
			json.Set("property", rule.Property.Name);
			//json.Set("error", rule.ConditionTypes.First().Code);
		}

		static Dictionary<string, string> GetEventInstance(ModelInstance instance, string id)
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
		public static T FromJson<T>(string json)
		{
			return (T)FromJson(typeof(T), json);
		}

		/// <summary>
		/// Deserializes a JSON string into the specified type.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="json"></param>
		/// <returns></returns>
		public static object FromJson(Type type, string json)
		{
			return deserialize.MakeGenericMethod(type).Invoke(serializer, new object[] { json });
		}

		/// <summary>
		/// Serializes a typed value into a JSON string.
		/// </summary>
		/// <param name="type"></param>
		/// <param name="value"></param>
		/// <returns></returns>
		public static string ToJson(Type type, object value)
		{
			return FixJsonDates(serializer.Serialize(value));
		}

		#endregion
	}
}
