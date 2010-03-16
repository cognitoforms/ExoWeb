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
	/// Logs an error that has occurred on the client or server.
	/// </summary>
	[DataContract]
	internal class LogErrorMethod : ServiceMethod, IServiceError
	{
		[DataMember(Name = "type")]
		public string Type { get; set; }

		[DataMember(Name = "message")]
		public string Message { get; set; }

		[DataMember(Name = "stackTrace")]
		public string StackTrace { get; set; }

		[DataMember(Name = "url")]
		public string Url { get; set; }
		
		[DataMember(Name = "refererUrl")]
		public string RefererUrl { get; set; }

		/// <summary>
		/// Saves the curent graph transaction.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			ServiceHandler.Adapter.OnError(this);
		}
	}

	public interface IServiceError
	{
		string Type { get; }

		string Message { get; }

		string StackTrace { get; }

		string Url { get; }

		string RefererUrl { get; }
	}
}
