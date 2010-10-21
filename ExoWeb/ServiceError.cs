﻿using System;
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
	public class ServiceError : IJsonSerializable
	{
		#region Properties

		public string Type { get; set; }

		public string Message { get; set; }

		public string StackTrace { get; set; }

		public string Url { get; set; }

		public string RefererUrl { get; set; }

		#endregion

		#region IJsonSerializable

		void IJsonSerializable.Serialize(Json json)
		{
			json.Set("type", Type);
			json.Set("message", Message);
			json.Set("stackTrace", StackTrace);
			json.Set("url", Url);
			json.Set("refererUrl", RefererUrl);
		}

		object IJsonSerializable.Deserialize(Json json)
		{
			Type = json.Get<string>("type");
			Message = json.Get<string>("message");
			StackTrace = json.Get<string>("stackTrace");
			Url = json.Get<string>("url");
			RefererUrl = json.Get<string>("refererUrl");

			return this;
		}

		#endregion
	}
}