using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using System.Web;
using System.Runtime.Serialization;
using ExoWeb.Serialization;

namespace ExoWeb
{
	/// <summary>
	/// Logs an error that has occurred on the client or server.
	/// </summary>
	public class ServiceError : IJsonSerializable
	{
		#region Properties

		public string Type { get; set; }

		public string Message { get; set; }

		public string StackTrace { get; set; }

		public string Url { get; set; }

		public string RefererUrl { get; set; }

		public Dictionary<string, object> AdditionalInfo {get; set;}
		#endregion

		#region IJsonSerializable

		void IJsonSerializable.Serialize(JsonWriter writer)
		{
			writer.Set("type", Type);
			writer.Set("message", Message);
			writer.Set("stackTrace", StackTrace);
			writer.Set("url", Url);
			writer.Set("refererUrl", RefererUrl);
			writer.Set("additionalInfo", AdditionalInfo);
		}

		object IJsonSerializable.Deserialize(JsonReader reader)
		{
			string property;
			while (reader.ReadProperty(out property))
			{
				switch (property)
				{
					case "type":
						Type = reader.ReadValue<string>();
						break;
					case "message":
						Message = reader.ReadValue<string>();
						break;
					case "stackTrace":
						StackTrace = reader.ReadValue<string>();
						break;
					case "url":
						Url = reader.ReadValue<string>();
						break;
					case "refererUrl":
						RefererUrl = reader.ReadValue<string>();
						break;
					case "additionalInfo":
						AdditionalInfo = reader.ReadValue<Dictionary<string, object>>();
						break;
					default:
						throw new ArgumentException("The specified property could not be deserialized.", property);
				}
			}

			return this;
		}

		#endregion
	}
}
