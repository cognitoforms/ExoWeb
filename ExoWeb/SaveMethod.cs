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
	/// Saves the current graph transaction.
	/// </summary>
	[DataContract]
	internal class SaveMethod : ServiceMethod
	{
		[DataMember(Name = "root")]
		GraphInstance Root { get; set; }

		[DataMember(Name = "changes")]
		GraphTransaction Changes { get; set; }

		/// <summary>
		/// Saves the curent graph transaction.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			// Perform the commit and get the resulting changes
			GraphTransaction result = Changes.Perform(() => 
			{
				// Resolve the root instance being committed from the graph transaction
				Root = Changes.GetInstance(Root.Type, Root.Id);

				// Save the root instance
				Root.Save();
			});

			// Serialize the transaction
			response.Write(ToJson(typeof(GraphTransaction), result));
		}
	}
}
