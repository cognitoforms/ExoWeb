using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule;
using System.Reflection;
using System.Collections;

namespace ExoWeb
{
	public class ServiceRequest : IJsonSerializable
	{
		private GraphContext context = GraphContext.Current;

		#region Constructors

		ServiceRequest()
		{ }

		internal ServiceRequest(GraphType type, string[] ids, params string[] paths)
		{
			Queries = new ServiceRequest.Query[] { new ServiceRequest.Query(type, ids, paths) };
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
		/// The changes to apply before raising events or loading data.
		/// </summary>
		public GraphTransaction Changes { get; private set; }

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

			// Apply changes before getting the root instances
			if (Changes != null)
				response.Changes = Changes.Perform(() => LoadAndRaise(response));

			// Otherwise, just get the root instances
			else
			{
				using (response.Changes = context.BeginTransaction())
				{
					LoadAndRaise(response);
					response.Changes.Commit();
				}
			}

			// Load data based on the specified queries
			if (Queries != null)
			{
				// Build a set of unique instance paths to match during recursion
				foreach (Query query in Queries)
				{
					if (query.Paths != null)
					{
						query.InstancePaths = new HashSet<string>();
						foreach (string path in query.Paths)
							ExoWeb.ProcessPath(path, query.InstancePaths, response);
					}
				}

				// Track changes while loading the instances to serialize
				GraphTransaction processChanges = null;
				using (processChanges = GraphContext.Current.BeginTransaction())
				{
					// Recursively build up the list of instances to serialize
					foreach (Query query in Queries)
					{
						foreach (GraphInstance root in query.Roots)
							ExoWeb.ProcessInstance(root, "this", query.InstancePaths, response);
					}

					processChanges.Commit();
				}
				response.Changes += processChanges;
			}

			// Send conditions for instances loaded in the request
			if (response.Instances != null || response.Changes != null)
			{
				response.BuildConditions();
			}

			// Raise the end request event
			ExoWeb.OnEndRequest(this);

			// Return the response
			return response;
		}

		/// <summary>
		/// Loads root instances for queries and raises domain events.
		/// </summary>
		void LoadAndRaise(ServiceResponse response)
		{
			// Process each query in the request
			if (Queries != null)
			{
				foreach (Query query in Queries)
				{
					// Create an array of roots to be loaded
					query.Roots = new GraphInstance[query.Ids == null ? 0 : query.Ids.Length];

					// Get the root instances in the scope of the current transaction
					for (int i = 0; i < query.Roots.Length; i++)
						query.Roots[i] = query.Type.Create(query.Ids[i]);
				}
			}

			// Process each event in the request
			if (Events != null)
			{
				response.Events = Events
					.Select((domainEvent) =>
					{
						domainEvent.Instance = Changes.GetInstance(domainEvent.Instance.Type, domainEvent.Instance.Id);
						var result = domainEvent.Raise(Changes);

						if (result == null)
							return null;

						IList<Query> queries = new List<Query>();
						GraphInstance[] roots = null;
							
						var type = context.GetGraphType(result);
						if (type != null)
						{
							roots = new GraphInstance[] { type.GetGraphInstance(result) };
						}
						else if (result is IEnumerable)
						{
							roots =
							(
								from element in ((IEnumerable) result).Cast<object>()
								let elementType = context.GetGraphType(element)
								where elementType != null
								select elementType.GetGraphInstance(element)
							).ToArray();
						}

						if (roots != null && roots.Length > 0)
						{
							Query[] newQueries = new Query[] { new Query(roots, domainEvent.Paths) };
							Queries = Queries == null ? newQueries : Queries.Union(newQueries).ToArray();

							return type == null ? (object) roots : (object) roots[0];
						}
						else
							return result;
					})
					.ToArray();
			}
		}





		#endregion

		#region DomainEvent

		/// <summary>
		/// Represents a domain event to be raised on a specific <see cref="GraphInstance"/>.
		/// </summary>
		public class DomainEvent : IJsonSerializable
		{
			public GraphInstance Instance { get; internal set; }

			public string[] Paths { get; private set; }			

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

				// Get the property paths
				Paths = json.Get<string[]>("paths");

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

					// Set the event target
					domainEvent.Instance = instance;

					// Return the new event
					return domainEvent;
				}

				// Graph method
				GraphMethod method = instance.Type.Methods[eventName];
				if (method != null)
					return new GraphMethodEvent(instance, method, json.Get<Json>("event"));

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

		class GraphMethodEvent : DomainEvent
		{
			GraphMethod method;
			Json json;

			internal GraphMethodEvent(GraphInstance instance, GraphMethod method, Json json)
			{
				this.Instance = instance;
				this.method = method;
				this.json = json;
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

			internal Query(GraphType type, string[] ids, string[] paths)
			{
				this.Type = type;
				this.Ids = ids;
				this.Paths = paths;
			}

			// Being used specifically for streaming event results
			internal Query(GraphInstance[] roots, string[] paths)
			{
				this.Paths = paths ?? new string[] { };
				this.Roots = roots;
			}

			public GraphType Type { get; private set; }

			public string[] Ids { get; private set; }

			public string[] Paths { get; private set; }

			internal GraphInstance[] Roots { get; set; }

			internal HashSet<string> InstancePaths { get; set; }

			#region IJsonSerializable

			void IJsonSerializable.Serialize(Json json)
			{
				throw new NotSupportedException();
			}

			object IJsonSerializable.Deserialize(Json json)
			{
				string typeName = json.Get<string>("type");
				if (typeName != null)
					Type = GraphContext.Current.GetGraphType(typeName);

				Ids = json.Get<string[]>("ids");
				Paths = json.Get<string[]>("paths");

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
			var types = json.Get<string[]>("types");
			if (types != null)
				Types = types.Select(type => GraphContext.Current.GetGraphType(type)).ToArray();

			// Queries
			Queries = json.Get<Query[]>("queries");

			// Events
			Events = json.Get<DomainEvent[]>("events");

			// Changes
			Changes = json.Get<List<GraphEvent>>("changes");

			// Config
			Config = json.Get<Dictionary<string, object>>("config");
			if (Config == null)
				Config = new Dictionary<string, object>(0);

			return this;
		}

		#endregion
	}
}
