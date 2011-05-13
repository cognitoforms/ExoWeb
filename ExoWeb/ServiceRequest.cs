using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule;
using System.Reflection;
using System.Collections;
using System.Text.RegularExpressions;

namespace ExoWeb
{
	public class ServiceRequest : IJsonSerializable
	{
		private GraphContext context = GraphContext.Current;

		#region Constructors

		ServiceRequest()
		{ }

		internal ServiceRequest(Query[] queries)
		{
			Queries = queries;
			Config = new Dictionary<string, object>();
		}

		internal ServiceRequest(GraphType[] types)
		{
			Types = types;
			Config = new Dictionary<string, object>();
		}

		#endregion

		#region Properties

		/// <summary>
		/// The set of type metadata to return.
		/// </summary>
		public GraphType[] Types { get; private set; }

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
		internal ServiceResponse Invoke()
		{
			// Raise the begin request event
			ExoWeb.OnBeginRequest(this);

			// Create a response for the request
			ServiceResponse response = new ServiceResponse();

			// Set the types to return from the request
			if (Types != null)
				response.Types = Types.ToDictionary<GraphType, string>(type => type.Name);

			// Apply view initialization changes
			if (Changes != null && Changes.Length > 0 && Changes[0].Source == ChangeSource.Init)
			{
				response.Changes = Changes[0].Changes;
				response.Changes.Perform();
			}

			// Load root instances
			if (Queries != null)
				foreach (var query in Queries)
					query.LoadRoots(response.Changes);

			// Preload the scope of work before applying changes
			PerformQueries(response, false);

			// Apply additional changes and raise domain events
			ApplyChanges(response);

			// Load instances specified by load queries
			PerformQueries(response, true);

			// Send conditions for instances loaded in the request
			if (response.Instances != null || response.Changes != null)
			{
				// Get instances loaded by the request
				var instances = response.Instances != null ? 
					response.Instances.Values.SelectMany(d => d.Instances.Values).Select(instance => instance.Instance) : 
					new GraphInstance[0];

				// Add instances created during the request
				instances = response.Changes != null ?
					instances.Union(response.Changes.OfType<GraphInitEvent.InitNew>().Select(graphEvent => graphEvent.Instance)) :
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

			// Raise the end request event
			ExoWeb.OnEndRequest(this);

			// Return the response
			return response;
		}

		void PerformQueries(ServiceResponse response, bool forLoad)
		{
			// Load data based on the specified queries
			if (Queries != null)
			{
				// Build a set of unique instance paths to match during recursion
				foreach (Query query in Queries)
				{
					if (query.Include != null)
					{
						query.RootStep = new Query.Step { Property = "this" };
						foreach (string path in query.Include)
							ProcessPath(path, query.RootStep, response);
					}
				}

				// Recursively build up the list of instances to serialize
				foreach (Query query in Queries)
				{
					if ((forLoad && query.ForLoad) || (!forLoad && query.InScope))
						foreach (GraphInstance root in query.Roots)
							ProcessInstance(root, query.RootStep.Children, forLoad, response);
				}
			}
		}

		/// <summary>
		/// Apply changes and raises domain events.
		/// </summary>
		void ApplyChanges(ServiceResponse response)
		{
			// Consolidate previous changes
			GraphTransaction transaction = 
				GraphTransaction.Combine((Changes ?? new ChangeSet[0])
				.Where(cs => cs.Source != ChangeSource.Init)
				.Select(cs => cs.Changes));

			// Chain the transactions about to be applied to any previously applied initialization changes
			if (response.Changes != null)
				response.Changes.Chain(transaction);

			// Apply changes and raise domain events
			if (transaction != null)
				response.Changes = transaction.Perform(() => RaiseEvents(response, transaction));

			// Otherwise, just raise events
			else
			{
				using (response.Changes = context.BeginTransaction())
				{
					RaiseEvents(response, null);
				}
			}	
		}
	
		/// <summary>
		/// Raises domain events.
		/// </summary>
		void RaiseEvents(ServiceResponse response, GraphTransaction transaction)
		{
			// Process each event in the request
			if (Events != null)
			{
				response.Events = Events
					.Select((domainEvent) =>
					{
						if (transaction != null)
							domainEvent.Instance = transaction.GetInstance(domainEvent.Instance.Type, domainEvent.Instance.Id);
						else
							domainEvent.Instance.Type.Create(domainEvent.Instance.Id);

						var result = domainEvent.Raise(transaction);

						if (result == null)
							return null;

						IList<Query> queries = new List<Query>();
						GraphInstance[] roots = null;
						var isList = false;
						
						// Determine if the result is a graph instance
						var type = context.GetGraphType(result);
						if (type != null)
							roots = new GraphInstance[] { type.GetGraphInstance(result) };

						// Otherwise, determine if the result is a list of graph instances
						else if (result is IEnumerable)
						{
							roots =
							(
								from element in ((IEnumerable) result).Cast<object>()
								let elementType = context.GetGraphType(element)
								where elementType != null
								select elementType.GetGraphInstance(element)
							).ToArray();
							isList = true;
						}

						if (roots != null && roots.Length > 0)
						{
							Query[] newQueries = new Query[] { new Query(roots, true, isList, domainEvent.Include) };
							Queries = Queries == null ? newQueries : Queries.Union(newQueries).ToArray();

							return type == null ? (object) roots : (object) roots[0];
						}
						else
							return result;
					})
					.ToArray();
			}
		}

		/// <summary>
		/// Parses query paths into tokens for processing
		/// </summary>
		static Regex pathParser = new Regex(@"^this([a-zA-Z0-9_]+|[{}.,]|\s|(\<[a-zA-Z0-9_.]+\>))*$", RegexOptions.Compiled);

		/// <summary>
		/// Processes static and instance property paths in order to determine the information to serialize.
		/// </summary>
		/// <param name="path"></param>
		internal static void ProcessPath(string path, Query.Step step, ServiceResponse response)
		{
			// Instance Path
			if (path.StartsWith("this"))
			{
				// Parse the instance path
				var match = pathParser.Match(path);
				if (match == null)
					throw new ArgumentException("The specified path, '" + path + "', is not valid.");

				// Process each path token
				Stack<Query.Step> stack = new Stack<Query.Step>();
				foreach (var token in match.Groups[1].Captures.Cast<Capture>().Select(c => c.Value))
				{
					switch (token[0])
					{
						case '{' :
							stack.Push(step);
							break;
						case '}' :
							step = stack.Pop();
							break;
						case ',':
							step = stack.Peek();
							break;
						case '.':
							break;
						case '<':
							step.Filter = token;
							break;
						default:
							string property = token.Trim();
							if (property == "")
								continue;
							if (step.Children == null)
								step.Children = new List<Query.Step>();
							var nextStep = step.Children.Where(s => s.Property == token).FirstOrDefault();
							if (nextStep == null)
							{
								nextStep = new Query.Step { Property = token };
								step.Children.Add(nextStep);
							}
							step = nextStep;
							break;
					}
				}

				// Throw an exception if there are unmatched property group delimiters
				if (stack.Count > 0)
					throw new ArgumentException("Unclosed '{' in path: " + path, "path");
			}

			// Static Path
			else
			{
				if (path.IndexOf('.') < 0)
					throw new ArgumentException("'" + path + "' is not a valid static property path.");

				// Split the static property reference
				int propertyIndex = path.LastIndexOf('.');
				string type = path.Substring(0, propertyIndex);
				string property = path.Substring(propertyIndex + 1);

				// Get the graph type
				GraphType graphType = GraphContext.Current.GetGraphType(type);
				if (graphType == null)
					throw new ArgumentException("'" + type + "' is not a valid graph type for the static property path of '" + path + "'.");

				// Get the graph property
				GraphProperty graphProperty = graphType.Properties[property];
				if (graphProperty == null || !graphProperty.IsStatic)
					throw new ArgumentException("'" + property + "' is not a valid property for the static property path of '" + path + "'.");

				// Add the property to the set of static properties to serialize
				response.GetGraphTypeInfo(graphType).StaticProperties.Add(graphProperty);

				// Register instances for static reference properties to be serialized
				GraphReferenceProperty reference = graphProperty as GraphReferenceProperty;
				if (reference != null)
				{
					// Get the cached set of instances to be serialized for the property type
					GraphTypeInfo typeInfo = response.GetGraphTypeInfo(reference.PropertyType);

					// Static lists
					if (reference.IsList)
					{
						foreach (GraphInstance instance in graphType.GetList(reference))
						{
							if (!typeInfo.Instances.ContainsKey(instance.Id))
								typeInfo.Instances.Add(instance.Id, new GraphInstanceInfo(instance));
						}
					}

					// Static references
					else
					{
						GraphInstance instance = graphType.GetReference(reference);
						if (instance != null && !typeInfo.Instances.ContainsKey(instance.Id))
							typeInfo.Instances.Add(instance.Id, new GraphInstanceInfo(instance));
					}
				}
			}
		}

		/// <summary>
		/// Recursively builds up a list of instances to serialize.
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="instances"></param>
		/// <param name="paths"></param>
		/// <param name="path"></param>
		static void ProcessInstance(GraphInstance instance, List<Query.Step> steps, bool includeInResponse, ServiceResponse response)
		{
			GraphInstanceInfo instanceInfo = null;

			// Track the instance if the query represents a load request
			if (includeInResponse)
			{
				// Fetch or initialize the dictionary of instances for the type of the current instance
				GraphTypeInfo typeInfo = response.GetGraphTypeInfo(instance.Type);

				// Add the current instance to the dictionary if it is not already there
				if (!typeInfo.Instances.TryGetValue(instance.Id, out instanceInfo))
					typeInfo.Instances[instance.Id] = instanceInfo = new GraphInstanceInfo(instance);
			}

			// Exit immediately if there are no child steps to process
			if (steps == null)
				return;

			// Process query steps for the current instance
			foreach (var step in steps)
			{
				// Get the property for the current step
				var property = instance.Type.Properties[step.Property];

				// Ignore the step if the property was not found
				if (property == null)
					continue;

				// Throw an exception if a static property is referenced
				if (property.IsStatic)
					throw new ArgumentException("Static properties cannot be referenced by instance property paths.  Specify 'TypeName.PropertyName' as the path to load static properties for a type.");
				
				// Process all items in a child list and register the list to be serialized
				if (property.IsList)
				{
					// Recursively process instances for reference lists
					if (property is GraphReferenceProperty)
					{
						// Process each child instance
						foreach (GraphInstance childInstance in instance.GetList((GraphReferenceProperty)property))
							ProcessInstance(childInstance, step.Children, includeInResponse, response);
					}

					// Mark the list to be included during serialization
					if (includeInResponse)
						instanceInfo.IncludeList(property);
				}

				// Process child references
				else if (property is GraphReferenceProperty)
				{
					GraphInstance childInstance = instance.GetReference((GraphReferenceProperty)property);
					if (childInstance != null)
						ProcessInstance(childInstance, step.Children, includeInResponse, response);
				}
			}
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
			public GraphTransaction Changes { get; private set; }

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
				Changes = json.Get<List<GraphEvent>>("changes");

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
		/// Represents a domain event to be raised on a specific <see cref="GraphInstance"/>.
		/// </summary>
		public class DomainEvent : IJsonSerializable
		{
			public GraphInstance Instance { get; internal set; }

			public string[] Include { get; internal set; }			

			internal virtual object Raise(GraphTransaction transaction)
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
				var instance = json.Get<GraphInstance>("instance");

				// Get the property paths to include
				Include = json.Get<string[]>("include");

				// Get the type of event
				string eventName = json.Get<string>("type");
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

				// Graph method
				GraphMethod method = instance.Type.Methods[eventName];
				if (method != null)
					return new GraphMethodEvent(instance, method, json.Get<Json>("event"), Include);

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
			/// Raises the domain event on the target <see cref="GraphInstance"/>.
			/// </summary>
			internal override object Raise(GraphTransaction transaction)
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

		#region GraphMethodEvent

		/// <summary>
		/// A domain event that supports calling graph methods on the specified instance.
		/// </summary>
		class GraphMethodEvent : DomainEvent
		{
			GraphMethod method;
			Json json;

			internal GraphMethodEvent(GraphInstance instance, GraphMethod method, Json json, string[] include)
			{
				this.Instance = instance;
				this.method = method;
				this.json = json;
				this.Include = include;
			}

			internal override object Raise(GraphTransaction transaction)
			{
				object[] args = method.Parameters.Select(p =>
				{
					if (p.ReferenceType == null)
						return json.Get(p.ValueType, p.Name);
					else if (p.IsList)
						return json.Get<GraphInstance[]>(p.Name).Select(gi => gi.Instance).ToArray();
					else
					{
						GraphInstance gi = json.Get<GraphInstance>(p.Name);
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

			internal Query(GraphType type, string[] ids, bool inScope, bool isList, string[] paths)
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
			internal Query(GraphInstance[] roots, bool inScope, bool isList, string[] paths)
			{
				if (roots == null || roots.Length == 0)
					throw new ArgumentException("At least one root instance must be specified for an instance-based query.");

				this.Include = paths ?? new string[] { };
				this.Roots = roots;
				this.ForLoad = true;
				this.InScope = inScope;
				this.IsList = isList;

				this.From = Roots[0].Type;
				foreach (var type in Roots.Select(r => r.Type))
				{
					if (type.IsSubType(this.From))
						this.From = type;
				}
			}

			public GraphType From { get; set; }

			public string[] Ids { get; internal set; }

			public string[] Include { get; internal set; }

			public bool ForLoad { get; internal set; }

			public bool InScope { get; internal set; }

			public bool IsList { get; internal set; }

			/// <summary>
			/// Gets the set of root graph instances for the current query.
			/// </summary>
			internal GraphInstance[] Roots { get; set; }	

			internal Step RootStep { get; set; }

			internal void LoadRoots(GraphTransaction transaction)
			{
				// Exit immediately if roots have already been loaded
				if (Roots != null)
					return;

				// Create an array of roots to be loaded
				Roots = new GraphInstance[Ids == null ? 0 : Ids.Length];

				// Get the root instances 
				for (int i = 0; i < Roots.Length; i++)
				{
					// Create the root instance
					Roots[i] = transaction == null ? From.Create(Ids[i]) : transaction.GetInstance(From, Ids[i]);

					// Access a property to force the instance to initialize
					object o = Roots[i][Roots[i].Type.Properties.First()];
				}
			}

			/// <summary>
			/// Removes out of scope paths before sending queries to the client.
			/// </summary>
			internal void ReducePaths()
			{
				Include = Include.Where(p => p.StartsWith("this")).ToArray();
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
					From = GraphContext.Current.GetGraphType(typeName);

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

			#region Step

			internal class Step
			{
				public string Property { get; set; }

				public string Filter { get; set; }

				public List<Step> Children { get; set; }

				/// <summary>
				/// Gets the string representation of the current step and all child steps
				/// </summary>
				/// <returns></returns>
				public override string ToString()
				{
					if (Children == null || Children.Count == 0)
						return Property + Filter;
					else if (Children.Count == 1)
						return Property + Filter + "." + Children[0];
					else
						return Property + Filter + "{" + Children.Aggregate("", (p, s) => p.Length > 0 ? p + "," + s : s.ToString()) + "}";
				}
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
			var types = json.Get<string[]>("types");
			if (types != null)
				Types = types.Select(type => GraphContext.Current.GetGraphType(type)).ToArray();

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
