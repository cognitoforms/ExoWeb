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

		[DataMember(Name = "changes")]
		GraphTransaction Changes { get; set; }

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
			response.Write("   \"event\": " + ToJson(typeof(TEvent), Event));

			// Output the transaction log if changes occurred
			if (newChanges != null && newChanges.FirstOrDefault() != null)
			{
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
