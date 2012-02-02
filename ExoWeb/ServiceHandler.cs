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

			string json = null;

			try
			{
				// Read the request JSON
				using (StreamReader reader = new StreamReader(context.Request.InputStream))
					json = reader.ReadToEnd();

				// Perform the requested operation
				switch (context.Request.PathInfo)
				{
					case "/Request":

						// Deserialize the request
						ServiceRequest request = ExoWeb.FromJson<ServiceRequest>(json);

						// Invoke the request and output the response
						context.Response.ContentType = "application/json";
						context.Response.Write(ExoWeb.ToJson(typeof(ServiceResponse), request.Invoke()));

						break;

					case "/GetType":

						// Enable response caching
						context.Response.Cache.SetCacheability(HttpCacheability.Public);
						context.Response.Cache.SetExpires(DateTime.Now.AddDays(7));
						context.Response.Cache.SetMaxAge(TimeSpan.FromDays(7));

						// Output the type metadata
						context.Response.ContentType = "application/json";
						context.Response.Write(ExoWeb.ToJson(typeof(ServiceResponse), ExoWeb.FromJson<ServiceRequest>("{types:[" + context.Request.QueryString["type"] + "]}").Invoke()));

						break;

					case "/LogError":

						// Raise the error event
						context.Response.ContentType = "application/json";
						ExoWeb.OnError(ExoWeb.FromJson<ServiceError>(json));

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
				error.RequestJson = json;

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

				context.Response.Write(ExoWeb.ToJson(typeof(ServiceError), error));
			}
		}

		#endregion

		#region Methods
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
