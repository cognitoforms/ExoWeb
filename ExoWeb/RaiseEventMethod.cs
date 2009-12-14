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
		[DataMember(Name = "instance")]
		GraphInstance Instance { get; set; }

		[DataMember(Name = "event")]
		string Event { get; set; }

		[DataMember(Name = "argument")]
		string Argument { get; set; }

		[DataMember(Name = "changes")]
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
