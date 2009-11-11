using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Services;
using System.IO;
using System.Runtime.Serialization;
using System.ServiceModel.Dispatcher;

namespace ExoWeb
{
	/// <summary>
	/// Summary description for $codebehindclassname$
	/// </summary>
	[WebService(Namespace = "http://tempuri.org/")]
	[WebServiceBinding(ConformsTo = WsiProfiles.BasicProfile1_1)]
	public class ModelSync : IHttpHandler
	{
		JsonQueryStringConverter converter = new JsonQueryStringConverter();

		/// <summary>
		/// Processes incoming requests and routes them to the appropriate JSON handler method.
		/// </summary>
		/// <param name="context"></param>
		public void ProcessRequest(HttpContext context)
		{
			// Read the request JSON
			string request;
			using (StreamReader reader = new StreamReader(context.Request.InputStream))
				request = reader.ReadToEnd();

			// Indicate that the response will be JSON
			context.Response.ContentType = "application/json";

			// Determine the method to call
			switch (context.Request.PathInfo)
			{
				case "/GetInstance":
					GetInstanceArgs args = (GetInstanceArgs)converter.ConvertStringToValue(request, typeof(GetInstanceArgs));
					GetInstance(context.Response, args);
					break;
			}
		}

		/// <summary>
		/// Defines arguments for the <see cref="GetInstance"/> method.
		/// </summary>
		[DataContract]
		class GetInstanceArgs
		{
			[DataMember]
			public string Type { get; set; }

			[DataMember]
			public string Id { get; set; }

			[DataMember]
			public string[] Paths { get; set; }
		}

		/// <summary>
		/// Outputs the JSON for the specified instance to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="args"></param>
		void GetInstance(HttpResponse response, GetInstanceArgs args)
		{
						
		}

		/// <summary>
		/// Indicates that this is a stateless service and may be cached.
		/// </summary>
		public bool IsReusable
		{
			get
			{
				return true;
			}
		}
	}
}
