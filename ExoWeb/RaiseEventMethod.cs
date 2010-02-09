using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Runtime.Serialization;
using System.Web;
using ExoGraph;

namespace ExoWeb
{
	#region RaiseEventMethod<TEvent>

	/// <summary>
	/// Outputs the JSON for the specified property to the response stream.
	/// </summary>
	[DataContract]
	internal class RaiseEventMethod<TEvent> : InstanceMethodBase
	{
		#region Properties

		[DataMember(Name = "instance")]
		GraphInstance Instance { get; set; }

		[DataMember(Name = "event")]
		TEvent Event { get; set; }

		[DataMember(Name = "paths")]
		string[] Paths { get; set; }

		[DataMember(Name = "changes")]
		GraphTransaction Changes { get; set; }

		[DataMember(Name = "includeAllowedValues")]
		bool IncludeAllowedValues { get; set; }

		#endregion

		#region Methods

		/// <summary>
		/// Outputs the JSON for the specified property to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			// Perform the commit and get the resulting changes
			GraphTransaction newChanges = Changes.Perform(() =>
			{
				// Resolve the root instance being committed from the graph transaction
				Instance = Changes.GetInstance(Instance.Type, Instance.Id);

				// Raise the custom event on the instance
				Instance.RaiseEvent<TEvent>(Event);
			});

			// Begin Serialization
			response.Write("{\r\n");

			// Serialize the event
			response.Write("   \"result\": " + ToJson(typeof(TEvent), Event));

			// Output instance data and the transaction log if changes occurred
			if (newChanges != null && newChanges.FirstOrDefault() != null)
			{
				// Initialize lists used to track serialization information
				this.paths = new StringDictionary();
				this.instances = new Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>>();
				this.staticProperties = new Dictionary<GraphType, Dictionary<GraphProperty, GraphProperty>>();
				this.allowedValues = new Dictionary<GraphType, Dictionary<GraphProperty, AllowedValuesRule>>();
		
				// Build a set of unique property paths to match during recursion
				if (Paths != null)
					foreach (string path in Paths)
						ProcessPath(path);
		
				// Recursively build up the list of instances to serialize
				ProcessInstance(Instance, "this", IncludeAllowedValues);

				// Serialize the list of instances
				response.Write(",\r\n   \"instances\": {\r\n");
				OutputInstances(response);
				response.Write("\r\n   }");

				// Serialize the list of changes
				string changesJson = ToJson(typeof(GraphTransaction), newChanges);
				response.Write(",\r\n   " + changesJson.Substring(1, changesJson.Length - 2));
			}

			// End Serialization
			response.Write("\r\n}");
		}

		#endregion
	}

	#endregion
}
