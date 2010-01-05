using System.Linq;
using System.Runtime.Serialization;
using System.Web;
using ExoGraph;

namespace ExoWeb
{
	/// <summary>
	/// Outputs the JSON for the specified property to the response stream.
	/// </summary>
	[DataContract]
	internal class RaiseEventMethod<TEvent> : ServiceMethod
	{
		[DataMember(Name = "instance")]
		GraphInstance Instance { get; set; }

		[DataMember(Name = "event")]
		TEvent Event { get; set; }

		[DataMember(Name = "changes")]
		GraphTransaction Changes { get; set; }

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

			// Serialize the event
			response.Write("{\r\n   \"result\": {\r\n");
			response.Write(ToJson(typeof(TEvent), Event));
			response.Write("   \r\n}");

			// Output the transaction log if changes occurred
			if (newChanges != null && newChanges.FirstOrDefault() != null)
			{
				string changesJson = ToJson(typeof(GraphTransaction), newChanges);
				response.Write(",\r\n   " + changesJson.Substring(1, changesJson.Length - 2));
			}

			response.Write("\r\n}");
		}
	}
}
