using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using System.Web;
using System.Runtime.Serialization;

namespace ExoWeb
{
	/// <summary>
	/// Outputs the JSON for the specified property to the response stream.
	/// </summary>
	[DataContract]
	internal class RaiseEventMethod : ServiceMethod
	{
		[DataMember]
		string Type { get; set; }

		[DataMember]
		string Id { get; set; }

		[DataMember]
		string Event { get; set; }

		[DataMember]
		string Argument { get; set; }

		[DataMember]
		GraphTransaction Changes { get; set; }

		/// <summary>
		/// Outputs the JSON for the specified property to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			Type eventType = ServiceHandler.GetEvent(Event);
			FromJson(eventType, Argument);
		}
	}
}
