using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using ExoRule;
using System.Reflection;
using System.Collections;
using System.Text.RegularExpressions;

namespace ExoWeb
{
	public class ServiceRequest : IJsonSerializable
	{
		#region Constructors

		ServiceRequest()
		{ }

		internal ServiceRequest(Query[] queries)
		{
			Queries = queries;
			Config = new Dictionary<string, object>();
		}

		internal ServiceRequest(string[] types)
		{
			Types = types;
			Config = new Dictionary<string, object>();
		}

		#endregion

		#region Properties

		/// <summary>
		/// The set of type metadata to return.
		/// </summary>
		public string[] Types { get; private set; }

		/// <summary>
		/// The set of queries to load.
		/// </summary>
		public Query[] Queries { get; private set; }

		/// <summary>
		/// The set of domain events to raise.
		/// </summary>
		public DomainEvent[] Events { get; private set; }

		/// <summary>
		/// The set of changes to apply before raising events or loading data.
		/// </summary>
		public ChangeSet[] Changes { get; private set; }

		/// <summary>
		/// Optional configuration information to customize the behavior of the request.
		/// </summary>
		public Dictionary<string, object> Config { get; private set; }

		#endregion

		#region Methods

		/// <summary>
		/// Outputs the JSON for the specified instance to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal ServiceResponse Invoke(ModelTransaction initChanges)
		{
			// Raise the begin request event
			ExoWeb.OnBeginRequest(this);

			// Create a response for the request
			ServiceResponse response = new ServiceResponse();
			response.ServerInfo = new ServerInformation();
			response.Changes = initChanges;

			try
			{
				// Set the types to return from the request
				response.Types = Types;

				// Apply view initialization changes
				if (Changes != null && Changes.Length > 0 && Changes[0].Source == ChangeSource.Init)
				{
					response.Changes = Changes[0].Changes;
					response.Changes.Perform();
				}

				// Load root instances
				if (Queries != null)
				{
					foreach (var query in Queries)
					{
						query.Prepare(response);
						query.LoadRoots(response.Changes);
					}
				}

				// Preload the scope of work before applying changes
				PerformQueries(response, false, initChanges != null);

				// Apply additional changes and raise domain events
				ApplyChanges(response);

				// Load instances specified by load queries
				PerformQueries(response, true, initChanges != null);

				// Condense the transaction log
				if (response.Changes != null)
					response.Changes.Condense();

				// Send conditions for instances loaded in the request
				if (response.Instances != null || response.Changes != null)
				{
					// Get instances loaded by the request
					var instances = response.Instances != null ?
						response.Instances.Values.SelectMany(d => d.Instances.Values).Select(instance => instance.Instance) :
						new ModelInstance[0];

					// Add instances created during the request
					instances = response.Changes != null ?
						instances.Union(response.Changes.OfType<ModelInitEvent.InitNew>().Select(modelEvent => modelEvent.Instance)) :
						instances;

					// Ensure conditions are evaluated before extracting them
					ExoWeb.OnEnsureConditions(response, instances);

					// Extract conditions for all instances involved in the request
					Dictionary<string, List<Condition>> conditionsByType = new Dictionary<string, List<Condition>>();
					foreach (var condition in instances.SelectMany(instance => Condition.GetConditions(instance)))
					{
						List<Condition> conditions;
						if (!conditionsByType.TryGetValue(condition.Type.Code, out conditions))
							conditionsByType[condition.Type.Code] = conditions = new List<Condition>();

						if (!conditions.Contains(condition))
							conditions.Add(condition);
					}
					response.Conditions = conditionsByType;
				}
			}
			finally
			{
				// Raise the end request event
				ExoWeb.OnEndRequest(this, response);
			}

			// Return the response
			return response;
		}

		/// <summary>
		/// Performs the queries for the current request, either to prepare the model before 
		/// applying changes (forLoad = false), or to actually load the model and transmit the 
		/// requested instances to the client.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="forLoad"></param>
		void PerformQueries(ServiceResponse response, bool forLoad, bool forInit)
		{
			// Load data based on the specified queries
			if (Queries != null)
			{
				// Record changes while processing queries
				if (forInit)
				{
					response.Changes.Record(() => ProcessQueryInstances(response, forLoad), evt =>
					{
						if (evt.Instance.IsNew)
							return true;

						var refChange = evt as ModelReferenceChangeEvent;
						if (refChange != null)
						{
							return (refChange.OldValue != null && refChange.OldValue.IsNew) ||
								(refChange.NewValue != null && refChange.NewValue.IsNew);
						}

						var listChange = evt as ModelListChangeEvent;
						if (listChange != null)
						{
							return (listChange.Added != null && listChange.Added.Any(i => i.IsNew)) ||
								(listChange.Removed != null && listChange.Removed.Any(i => i.IsNew));
						}

						return false;
					});
				}
				else if (forLoad)
					(response.Changes ?? new ModelTransaction()).Record(() => ProcessQueryInstances(response, forLoad));
				else
					ProcessQueryInstances(response, forLoad);
			}
		}

		private void ProcessQueryInstances(ServiceResponse response, bool forLoad)
		{
			// Recursively build up the list of instances to serialize
			foreach (Query query in Queries)
			{
				if ((forLoad && query.ForLoad) || query.InScope)
					foreach (ModelInstance root in query.Roots)
						ProcessInstance(root, query.Path != null ? query.Path.FirstSteps : null, forLoad && query.ForLoad, query.InScope, forLoad, response);
			}
		}

		/// <summary>
		/// Apply changes and raises domain events.
		/// </summary>
		void ApplyChanges(ServiceResponse response)
		{
			// Consolidate previous changes
			ModelTransaction transaction =
				ModelTransaction.Combine((Changes ?? new ChangeSet[0])
				.Where(cs => cs.Source != ChangeSource.Init)
				.Select(cs => cs.Changes));

			// Chain the transactions about to be applied to any previously applied initialization changes
			if (response.Changes != null && transaction != null)
				response.Changes.Chain(transaction);

			// Apply changes and raise domain events
			if (transaction != null)
				response.Changes = transaction.Perform(() => RaiseEvents(response, transaction));

			// Otherwise, just raise events
			else
				response.Changes = (response.Changes ?? new ModelTransaction()).Record(() => RaiseEvents(response, null));
		}

		/// <summary>
		/// Raises domain events.
		/// </summary>
		void RaiseEvents(ServiceResponse response, ModelTransaction transaction)
		{
			// Process each event in the request
			if (Events != null)
			{
				response.Events = Events
					.Select((domainEvent) =>
					{
						// Restore the instance to be a valid model instance
						if (domainEvent.Instance != null)
						{
							if (transaction != null)
								domainEvent.Instance = transaction.GetInstance(domainEvent.Instance.Type, domainEvent.Instance.Id);
							else
								domainEvent.Instance.Type.Create(domainEvent.Instance.Id);
						}

						var result = domainEvent.Raise(transaction);

						if (result == null)
							return null;

						ModelType type;
						ModelInstance[] roots;
						bool isList;

						if (ExoWeb.TryConvertQueryInstance(result, out type, out roots, out isList))
						{
							Query newQuery = new Query(type, roots, true, isList, domainEvent.Include);
							newQuery.Prepare(response);

							Query[] newQueries = new Query[] { newQuery };
							Queries = Queries == null ? newQueries : Queries.Union(newQueries).ToArray();

							return isList ? (object)roots : (object)roots[0];
						}
						else if (domainEvent.Include != null && domainEvent.Include.Length > 0)
						{
							Query newQuery = new Query(domainEvent.Instance.Type, new[] { domainEvent.Instance }, true, false, domainEvent.Include);
							newQuery.Prepare(response);

							Query[] newQueries = new Query[] { newQuery };
							Queries = Queries == null ? newQueries : Queries.Union(newQueries).ToArray();

							return result;
						}
						else
							return result;
					})
					.ToArray();
			}
		}

		/// <summary>
		/// Recursively builds up a list of instances to serialize.
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="instances"></param>
		/// <param name="paths"></param>
		/// <param name="path"></param>
		static void ProcessInstance(ModelInstance instance, ModelStepList steps, bool includeInResponse, bool inScope, bool forLoad, ServiceResponse response)
		{
			ModelInstanceInfo instanceInfo = null;

			// Track the instance if the query represents a load request
			if (includeInResponse)
			{
				// Fetch or initialize the dictionary of instances for the type of the current instance
				ModelTypeInfo typeInfo = response.GetModelTypeInfo(instance.Type);

				// Add the current instance to the dictionary if it is not already there
				if (!typeInfo.Instances.TryGetValue(instance.Id, out instanceInfo))
					typeInfo.Instances[instance.Id] = instanceInfo = new ModelInstanceInfo(instance);
			}

			// Exit immediately if there are no child steps to process
			if (steps == null)
				return;

			// Process query steps for the current instance
			foreach (var step in steps)
			{
				// Recursively process child instances
				foreach (var childInstance in step.GetInstances(instance))
					ProcessInstance(childInstance, step.NextSteps, includeInResponse, inScope, forLoad, response);

				// Mark value lists to be included during serialization
				if (step.Property.IsList && includeInResponse)
					instanceInfo.IncludeList(step.Property);
			}

			// Run all property get rules on the instance
			if (inScope)
			{
				if (forLoad)
					instance.RunPendingPropertyGetRules(p => p is ModelValueProperty || steps.Any(s => s.Property == p));
				else
					instance.RunPendingPropertyGetRules(p => p is ModelValueProperty);
			}
		}

		/// <summary>
		/// Returns the string representation of the current request.
		/// </summary>
		/// <returns></returns>
		public override string ToString()
		{
			return
				(Types != null && Types.Length > 0 ? "Types: " + String.Join(",", Types) : "") +
				(Queries != null && Queries.Length > 0 ? Queries.Aggregate("Queries: ", (p, q) => p.Length > 7 ? p + "," + q : q.ToString()) : "");
		}

		#endregion

		#region ChangeSet

		public class ChangeSet : IJsonSerializable
		{
			/// <summary>
			/// The source of the change (Init, Client or Server)
			/// </summary>
			public ChangeSource Source { get; private set; }

			/// <summary>
			/// The changes to apply before raising events or loading data.
			/// </summary>
			public ModelTransaction Changes { get; private set; }

			#region IJsonSerializable

			public void Serialize(Json json)
			{
				throw new NotImplementedException();
			}

			public object Deserialize(Json json)
			{
				// Events
				Source = json.Get<ChangeSource>("source");

				// Changes
				Changes = json.Get<List<ModelEvent>>("changes");

				return this;
			}

			#endregion
		}

		#endregion

		#region ChangeSource

		/// <summary>
		/// Indicates the source of the change.
		/// </summary>
		public enum ChangeSource
		{
			Init,		// Changes performed during view initialization on the server
			Client,		// Changes performed on the client
			Server		// Changes performed on the server during roundtrips
		}

		#endregion

		#region DomainEvent

		/// <summary>
		/// Represents a domain event to be raised on a specific <see cref="ModelInstance"/>.
		/// </summary>
		public class DomainEvent : IJsonSerializable
		{
			public ModelInstance Instance { get; internal set; }

			public string[] Include { get; internal set; }

			internal virtual object Raise(ModelTransaction transaction)
			{
				throw new NotImplementedException();
			}

			#region IJsonSerializable

			void IJsonSerializable.Serialize(Json json)
			{
				throw new NotSupportedException();
			}

			object IJsonSerializable.Deserialize(Json json)
			{
				// Get the event target
				var instance = json.Get<ModelInstance>("instance");

				// Get the property paths to include
				Include = json.Get<string[]>("include");

				// Get the type of event
				string eventName = json.Get<string>("type");

				// First see if it is a custom domain event
				if (instance != null || eventName == "Save")
				{
					Type eventType = eventName == "Save" ? typeof(SaveEvent) : instance.Type.GetEventType(eventName);

					// Strongly-type event
					if (eventType != null)
					{
						// Create a generic event instance
						DomainEvent domainEvent = (DomainEvent)typeof(DomainEvent<>)
							.MakeGenericType(eventType)
							.GetConstructor(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance, null, new Type[] { eventType }, null)
							.Invoke(new object[] { json.Get(eventType, "event") });

						// Set the event target and inclusion paths
						domainEvent.Instance = instance;
						domainEvent.Include = Include;

						// Return the new event
						return domainEvent;
					}
				}

				// Then see if it is a model method invocation
				var separator = eventName.LastIndexOf(".");
				if (separator > 0)
				{
					var type = ModelContext.Current.GetModelType(eventName.Substring(0, separator));
					var methodName = eventName.Substring(separator + 1);
					ModelMethod method = null;
					while (type != null && method == null)
					{
						method = type.Methods[methodName];
						type = type.BaseType;
					}

					if (method != null)
						return new ModelMethodEvent(instance, method, json.Get<Json>("event"), Include);
				}

				// Indicate that the event name could not be resolved
				throw new ArgumentException(eventName + " is not a valid event for " + instance.Type.Name);
			}

			#endregion
		}

		/// <summary>
		/// Represents a domain event for a specific target event type.
		/// </summary>
		/// <typeparam name="TEvent">The type of domain event to raise</typeparam>
		public class DomainEvent<TEvent> : DomainEvent
		{
			internal DomainEvent(TEvent evt)
			{
				this.Event = evt;
			}

			/// <summary>
			/// The domain event to raise.
			/// </summary>
			public TEvent Event { get; private set; }

			/// <summary>
			/// Raises the domain event on the target <see cref="ModelInstance"/>.
			/// </summary>
			internal override object Raise(ModelTransaction transaction)
			{
				if (typeof(TEvent) == typeof(SaveEvent))
				{
					Instance.Save();
					return null;
				}
				else
				{
					Instance.RaiseEvent<TEvent>(Event);
					return Event;
				}
			}
		}

		internal class SaveEvent
		{ }

		#region ModelMethodEvent

		/// <summary>
		/// A domain event that supports calling model methods on the specified instance.
		/// </summary>
		class ModelMethodEvent : DomainEvent
		{
			ModelMethod method;
			Json json;

			internal ModelMethodEvent(ModelInstance instance, ModelMethod method, Json json, string[] include)
			{
				this.Instance = instance;
				this.method = method;
				this.json = json;
				this.Include = include;
			}

			internal override object Raise(ModelTransaction transaction)
			{
				object[] args = method.Parameters.Select(p =>
				{
					if (p.ReferenceType == null)
						return json.Get(p.ParameterType, p.Name);
					else if (p.IsList)
					{
						ModelInstance[] modelInstances = json.Get<ModelInstance[]>(p.Name);
						return modelInstances.Select(gi => transaction.GetInstance(gi.Type, gi.Id)).ToList(p.ReferenceType, p.ParameterType);
					}
					else
					{
						ModelInstance gi = json.Get<ModelInstance>(p.Name);
						if (gi != null)
							gi = transaction.GetInstance(gi.Type, gi.Id);
						return gi == null ? null : gi.Instance;
					}
				})
				.ToArray();

				return method.Invoke(Instance, args);
			}
		}

		#endregion

		#endregion

		#region Query

		/// <summary>
		/// Represents a query for a specific root type and one or more instances.
		/// </summary>
		public class Query : IJsonSerializable
		{
			Query()
			{ }

			internal Query(ModelType type, string[] ids, bool inScope, bool isList, string[] paths)
			{
				this.From = type;
				this.Ids = ids;
				this.Include = paths;
				this.ForLoad = true;
				this.InScope = inScope;
				this.IsList = isList;
			}

			/// <summary>
			/// Used for streaming event results.
			/// </summary>
			/// <param name="roots"></param>
			/// <param name="paths"></param>
			internal Query(ModelType type, ModelInstance[] roots, bool inScope, bool isList, string[] paths)
			{
				this.From = type;
				this.Include = paths ?? new string[] { };
				this.Roots = roots;
				this.ForLoad = true;
				this.InScope = inScope;
				this.IsList = isList;
			}

			public ModelType From { get; set; }

			public string[] Ids { get; internal set; }

			public string[] Include { get; internal set; }

			public bool ForLoad { get; internal set; }

			public bool InScope { get; internal set; }

			public bool IsList { get; internal set; }

			/// <summary>
			/// Gets the set of root model instances for the current query.
			/// </summary>
			internal ModelInstance[] Roots { get; set; }

			internal ModelPath Path { get; set; }

			/// <summary>
			/// Prepares the query by parsing instance and static paths to determine
			/// what information is being requested by the query.
			/// </summary>
			/// <param name="response"></param>
			internal void Prepare(ServiceResponse response)
			{
				if (Include != null && Include.Length > 0)
				{
					string paths = "{";
					foreach (var p in Include)
					{
						var path = p.Replace(" ", "");
						if (path.StartsWith("this."))
							path = path.Substring(5);
						else if (path.StartsWith("this{"))
							path = path.Substring(4);

						ModelPath instancePath;
						if (From.TryGetPath(path, out instancePath))
							paths += path + ",";
						else
							PrepareStaticPath(path, response);
					}

					if (paths.Length > 1)
						Path = From.GetPath(paths.Substring(0, paths.Length - 1) + "}");
				}
			}

			/// <summary>
			/// Processes static property paths in order to determine the information to serialize.
			/// </summary>
			/// <param name="path"></param>
			internal static void PrepareStaticPath(string path, ServiceResponse response)
			{
				if (path.IndexOf('.') < 0)
					throw new ArgumentException("'" + path + "' is not a valid static property path.");

				// Split the static property reference
				int propertyIndex = path.LastIndexOf('.');
				string type = path.Substring(0, propertyIndex);
				string property = path.Substring(propertyIndex + 1);

				// Get the model type
				ModelType modelType = ModelContext.Current.GetModelType(type);
				if (modelType == null)
					throw new ArgumentException("'" + type + "' is not a valid model type for the static property path of '" + path + "'.");

				// Get the model property
				ModelProperty modelProperty = modelType.Properties[property];
				if (modelProperty == null || !modelProperty.IsStatic)
					throw new ArgumentException("'" + property + "' is not a valid property for the static property path of '" + path + "'.");

				// Add the property to the set of static properties to serialize
				response.GetModelTypeInfo(modelType).StaticProperties.Add(modelProperty);

				// Register instances for static reference properties to be serialized
				ModelReferenceProperty reference = modelProperty as ModelReferenceProperty;
				if (reference != null)
				{
					// Get the cached set of instances to be serialized for the property type
					ModelTypeInfo propertyTypeInfo = response.GetModelTypeInfo(reference.PropertyType);

					// Static lists
					if (reference.IsList)
					{
						foreach (ModelInstance instance in modelType.GetList(reference))
						{
							ModelTypeInfo typeInfo = instance.Type == reference.PropertyType ? propertyTypeInfo : response.GetModelTypeInfo(instance.Type);
							if (!typeInfo.Instances.ContainsKey(instance.Id))
								typeInfo.Instances.Add(instance.Id, new ModelInstanceInfo(instance));
						}
					}

					// Static references
					else
					{
						ModelInstance instance = modelType.GetReference(reference);
						ModelTypeInfo typeInfo = instance.Type == reference.PropertyType ? propertyTypeInfo : response.GetModelTypeInfo(instance.Type);
						if (instance != null && !typeInfo.Instances.ContainsKey(instance.Id))
							typeInfo.Instances.Add(instance.Id, new ModelInstanceInfo(instance));
					}
				}
			}

			internal void LoadRoots(ModelTransaction transaction)
			{
				// Exit immediately if roots have already been loaded
				if (Roots != null)
					return;

				// Create an array of roots to be loaded
				Roots = new ModelInstance[Ids == null ? 0 : Ids.Length];

				// Get the root instances 
				for (int i = 0; i < Roots.Length; i++)
				{
					// Create the root instance
					Roots[i] = transaction == null ? From.Create(Ids[i]) : transaction.GetInstance(From, Ids[i]);
				}

				// Access a property to force the instance to initialize.  Do a seperate pass so batched loading will work.
				for (int i = 0; i < Roots.Length; i++)
				{
					var initProp = Roots[i].Type.Properties.Where(p => p is ModelValueProperty).First() ?? Roots[i].Type.Properties.Where(p => p is ModelReferenceProperty).First();
					Roots[i].OnPropertyGet(initProp);
				}
			}

			/// <summary>
			/// Removes out of scope paths before sending queries to the client.
			/// </summary>
			internal void ReducePaths()
			{
				Include = Include.Where(p => p.StartsWith("this")).ToArray();
			}

			/// <summary>
			/// Returns the string representation of the current query.
			/// </summary>
			/// <returns></returns>
			public override string ToString()
			{
				return From + "{" + (Include != null && Include.Length > 0 ? Include.Aggregate((s1, s2) => s1 + "," + s2) : "") + "}";
			}

			#region IJsonSerializable

			void IJsonSerializable.Serialize(Json json)
			{
				if (IsList)
					json.Set("ids", Roots.Select(r => r.Id));
				else
					json.Set("id", Roots[0].Id);
				json.Set("from", From.Name);

				if (Include != null)
					json.Set("include", Include);

				json.Set("inScope", InScope);
			}

			object IJsonSerializable.Deserialize(Json json)
			{
				string typeName = json.Get<string>("from");
				if (typeName != null)
					From = ModelContext.Current.GetModelType(typeName);

				if (json.IsNull("id"))
				{
					IsList = true;
					Ids = json.Get<string[]>("ids");
				}
				else
				{
					IsList = false;
					Ids = new string[] { json.Get<string>("id") };
				}

				Include = json.Get<string[]>("include");
				InScope = json.IsNull("inScope") || json.Get<bool>("inScope");
				ForLoad = json.IsNull("forLoad") || json.Get<bool>("forLoad");

				return this;
			}

			#endregion
		}

		#endregion

		#region IJsonSerializable

		void IJsonSerializable.Serialize(Json json)
		{
			throw new NotSupportedException();
		}

		object IJsonSerializable.Deserialize(Json json)
		{
			// Types
			Types = json.Get<string[]>("types");

			// Queries
			Queries = json.Get<Query[]>("queries");

			// Events
			Events = json.Get<DomainEvent[]>("events");

			// Changes
			Changes = json.Get<ChangeSet[]>("changes");

			// Config
			Config = json.Get<Dictionary<string, object>>("config");
			if (Config == null)
				Config = new Dictionary<string, object>(0);

			return this;
		}

		#endregion
	}
}
