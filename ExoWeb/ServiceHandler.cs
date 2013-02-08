using System;
using System.Linq;
using System.Collections.Generic;
using System.Web;
using System.Text;
using ExoModel;
using System.IO;
using System.Web.Script.Serialization;
using System.Reflection;
using ExoRule;
using System.Diagnostics;
using ExoRule.Validation;
using ExoWeb.Serialization;

namespace ExoWeb
{
	/// <summary>
	/// Summary description for $codebehindclassname$
	/// </summary>
	public class ServiceHandler : IHttpHandler
	{
		static object executingKey = new object();

		#region IHttpHandler

		/// <summary>
		/// Indicates that this is a stateless service and may be cached.
		/// </summary>
		bool IHttpHandler.IsReusable
		{
			get
			{
				return true;
			}
		}

		/// <summary>
		/// Processes incoming requests and routes them to the appropriate JSON handler method.
		/// </summary>
		/// <param name="context"></param>
		void IHttpHandler.ProcessRequest(HttpContext context)
		{
			IsExecuting = true;

			try
			{
				// Perform the requested operation
				switch (context.Request.PathInfo)
				{
					case "/GetType":

						// Enable response caching
						context.Response.Cache.SetCacheability(HttpCacheability.Public);
						context.Response.Cache.SetExpires(DateTime.Now.AddDays(7));
						context.Response.Cache.SetMaxAge(TimeSpan.FromDays(7));

						// Output the type metadata
						context.Response.ContentType = "application/json";
						JsonUtility.Serialize(context.Response.OutputStream, new ServiceRequest(context.Request.QueryString["type"].Replace("\"", "")).Invoke(null));

						break;

					case "/LogError":

						// Raise the error event
						context.Response.ContentType = "application/json";
						ExoWeb.OnError(JsonUtility.Deserialize<ServiceError>(context.Request.InputStream));

						break;

					default:

						// Deserialize the request
						context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
						context.Response.Cache.SetNoStore();
						ServiceRequest request = JsonUtility.Deserialize<ServiceRequest>(context.Request.InputStream);

						// Invoke the request and output the response
						context.Response.ContentType = "application/json";
						using (var test = new StringWriter())
						{
							JsonUtility.Serialize(test, request.Invoke(null));
							context.Response.Write(test.ToString());
						}

						break;
				}
			}
			catch (Exception e)
			{
				// Create an error to log
				var error = new ServiceError();

				error.Type = e.GetBaseException().GetType().FullName;
				error.StackTrace = GetFullStackTrace(e);
				error.Message = e.GetBaseException().Message;
				error.Url = context.Request.RawUrl;

				if (error.AdditionalInfo == null)
					error.AdditionalInfo = new Dictionary<string, object>();
				//error.AdditionalInfo.Add("Client.RequestJson", json);

				// Raise the error event
				ExoWeb.OnError(error);

				// Also send the error information to the client
				context.Response.Clear();
				context.Response.ContentType = "application/json";
				context.Response.StatusCode = 500; // internal server error

				// Enable error information on client
				if (ExoWeb.EnableExceptionInformation)
				{
					context.Response.AddHeader("jsonerror", "true");

					// Ensure IIS 7 doesn't intercept the error
					context.Response.TrySkipIisCustomErrors = true; 
				}

				context.Response.Write(ExoWeb.ToJson(error));
			}
		}

		#endregion

		#region Properties

		/// <summary>
		/// True if the service handler is currently executing a request
		/// </summary>
		public static bool IsExecuting
		{
			get
			{
				HttpContext ctx = HttpContext.Current;
				return ctx != null && ctx.Items[executingKey] != null;
			}
			private set
			{
				if(value)
					HttpContext.Current.Items[executingKey] = true;
				else
					HttpContext.Current.Items[executingKey] = null;
			}
		}

		#endregion

		#region Methods

		/// <summary>
		/// Utility method for getting the full stack trace for a list
		/// of chained exceptions.
		/// </summary>
		/// <param name="error">Last exception in chain</param>
		/// <returns>Stack trace</returns>
		static string GetFullStackTrace(Exception error)
		{
			// Include exception info in the message
			var errors = new Stack<Exception>();
			for (Exception e = error; null != e; e = e.InnerException)
				errors.Push(e);

			StringBuilder stackTrace = new StringBuilder();
			while (errors.Count > 0)
			{
				Exception e = (Exception)errors.Pop();
				stackTrace.AppendFormat("{0}\n {1}\n{2}\n\n", e.Message, e.GetType().FullName, e.StackTrace);
			}

			return stackTrace.ToString();
		}

		#endregion
	}
}
