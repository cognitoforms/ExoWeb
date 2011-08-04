using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Diagnostics;
using System.Web;

namespace ExoWeb.Diagnostics
{
	public static class PerformanceCounters
	{
		const string category = "ExoWeb";

		static object mutex = new object();
		static bool isEnabled = false;

		static PerformanceCounter requests;
		static PerformanceCounter requestChangesIn;
		static PerformanceCounter requestBytesIn;
		private static PerformanceCounter requestsLocal;
		private static PerformanceCounter requestsRemote;

		/// <summary>
		/// Turn on ExoWeb-related performance counters
		/// </summary>
		public static void Enable()
		{
			lock(mutex)
			{
				if (isEnabled)
					return;

				ExoWeb.BeginRequest += ExoWeb_BeginRequest;
				Init();
			}
		}

		/// <summary>
		/// Turn off ExoWeb-related performance counters
		/// </summary>
		public static void Disable()
		{
			lock (mutex)
			{
				if (!isEnabled)
					return;

				ExoWeb.BeginRequest -= ExoWeb_BeginRequest;
			}
		}

		static void Init()
		{
			string instance = FullyQualifiedApplicationPath.Replace("/", "-");

			requests = new PerformanceCounter(category, "Requests", instance, false);
			requests.RawValue = 0;

			requestsLocal = new PerformanceCounter(category, "Local Requests", instance, false);
			requestsLocal.RawValue = 0;

			requestsRemote = new PerformanceCounter(category, "Remote Requests", instance, false);
			requestsRemote.RawValue = 0;

			requestBytesIn = new PerformanceCounter(category, "Remote Request Bytes In", instance, false);
			requestBytesIn.RawValue = 0;

			requestChangesIn = new PerformanceCounter(category, "Remote Request Change Log Actions In", instance, false);
			requestChangesIn.RawValue = 0;
		}

		static void ExoWeb_BeginRequest(object sender, ServiceRequestEventArgs args)
		{
			requests.Increment();

			if(args.Request.Changes != null)
				requestChangesIn.IncrementBy(args.Request.Changes.Sum(changeset => changeset.Changes.Count()));

			if (ServiceHandler.IsExecuting)
			{
				requestsRemote.Increment();
				requestBytesIn.IncrementBy(HttpContext.Current.Request.ContentLength);
			}
			else
			{
				requestsLocal.Increment();
			}
		}

		static string FullyQualifiedApplicationPath
		{
			get
			{
				//Return variable declaration
				string appPath = null;

				//Getting the current context of HTTP request
				HttpContext context = HttpContext.Current;

				//Checking the current context content
				if (context != null)
				{
					//Formatting the fully qualified website url/name
					appPath = string.Format("{0}://{1}{2}{3}",
					  context.Request.Url.Scheme,
					  context.Request.Url.Host,
					  context.Request.Url.Port == 80
						? string.Empty : ":" + context.Request.Url.Port,
					  context.Request.ApplicationPath);
				}
				if (!appPath.EndsWith("/"))
					appPath += "/";
				return appPath;
			}
		}
	}
}
