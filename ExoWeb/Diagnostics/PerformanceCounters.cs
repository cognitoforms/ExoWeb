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
		static PerformanceCounter localRequests;
		static PerformanceCounter remoteRequests;
		static PerformanceCounter remoteRequestChangesIn;
		static PerformanceCounter remoteRequestBytesIn;

		static PerformanceCounter requestChangesOut;
		static PerformanceCounter localRequestChangesOut;
		static PerformanceCounter remoteRequestChangesOut;

		static PerformanceCounter requestInstancesOut;
		static PerformanceCounter localRequestInstancesOut;
		static PerformanceCounter remoteRequestInstancesOut;

		static PerformanceCounter requestConditionsOut;
		static PerformanceCounter localRequestConditionsOut;
		static PerformanceCounter remoteRequestConditionsOut;

		static PerformanceCounter remoteRequestTypesOut;

		/// <summary>
		/// Turn on ExoWeb-related performance counters
		/// </summary>
		public static void Enable()
		{
			lock(mutex)
			{
				if (isEnabled)
					return;

				Init();

				ExoWeb.BeginRequest += ExoWeb_BeginRequest;
				ExoWeb.EndRequest += ExoWeb_EndRequest;
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
				ExoWeb.EndRequest -= ExoWeb_EndRequest;
			}
		}

		static void Init()
		{
			string instance = FullyQualifiedApplicationPath.Replace("/", "-");

			requests = new PerformanceCounter(category, "Requests", instance, false);
			requests.RawValue = 0;

			localRequests = new PerformanceCounter(category, "Local Requests", instance, false);
			localRequests.RawValue = 0;

			remoteRequests = new PerformanceCounter(category, "Remote Requests", instance, false);
			remoteRequests.RawValue = 0;

			remoteRequestBytesIn = new PerformanceCounter(category, "Remote Request Bytes In", instance, false);
			remoteRequestBytesIn.RawValue = 0;

			remoteRequestChangesIn = new PerformanceCounter(category, "Remote Request Change Log Actions In", instance, false);
			remoteRequestChangesIn.RawValue = 0;


			requestChangesOut = new PerformanceCounter(category, "Request Change Log Actions Out", instance, false);
			requestChangesOut.RawValue = 0;

			localRequestChangesOut = new PerformanceCounter(category, "Local Request Change Log Actions Out", instance, false);
			localRequestChangesOut.RawValue = 0;

			remoteRequestChangesOut = new PerformanceCounter(category, "Remote Request Change Log Actions Out", instance, false);
			remoteRequestChangesOut.RawValue = 0;


			requestInstancesOut = new PerformanceCounter(category, "Request Instances Out", instance, false);
			requestInstancesOut.RawValue = 0;

			localRequestInstancesOut = new PerformanceCounter(category, "Local Request Instances Out", instance, false);
			localRequestInstancesOut.RawValue = 0;

			remoteRequestInstancesOut = new PerformanceCounter(category, "Remote Request Instances Out", instance, false);
			remoteRequestInstancesOut.RawValue = 0;


			requestConditionsOut = new PerformanceCounter(category, "Request Conditions Out", instance, false);
			requestConditionsOut.RawValue = 0;

			localRequestConditionsOut = new PerformanceCounter(category, "Local Request Conditions Out", instance, false);
			localRequestConditionsOut.RawValue = 0;

			remoteRequestConditionsOut = new PerformanceCounter(category, "Remote Request Conditions Out", instance, false);
			remoteRequestConditionsOut.RawValue = 0;


			remoteRequestTypesOut = new PerformanceCounter(category, "Remote Request Types Out", instance, false);
			remoteRequestTypesOut.RawValue = 0;
		}

		static void ExoWeb_BeginRequest(object sender, ServiceRequestEventArgs args)
		{
			requests.Increment();

			if (ServiceHandler.IsExecuting)
			{
				if (args.Request.Changes != null)
					remoteRequestChangesIn.IncrementBy(args.Request.Changes.Sum(changeset => changeset.Changes.Count()));

				remoteRequests.Increment();
				remoteRequestBytesIn.IncrementBy(HttpContext.Current.Request.ContentLength);
			}
			else
			{
				localRequests.Increment();
			}
		}

		static void ExoWeb_EndRequest(object sender, ServiceRequestEventArgs args)
		{
			// Changes
			Increment(
				args.Response.Changes == null ? 0 : args.Response.Changes.Count(),
				requestChangesOut,
				remoteRequestChangesOut,
				localRequestChangesOut
			);

			// Instances
			Increment(
				args.Response.Instances == null ? 0 : args.Response.Instances.Count,
				requestInstancesOut,
				remoteRequestInstancesOut,
				localRequestInstancesOut
			);

			// Conditions
			Increment(
				args.Response.Conditions == null ? 0 : args.Response.Conditions.Values.Sum(conditions => conditions.Count),
				requestInstancesOut,
				remoteRequestInstancesOut,
				localRequestInstancesOut
			);

			// Types
			if (ServiceHandler.IsExecuting && args.Response.Types != null)
				remoteRequestTypesOut.IncrementBy(args.Response.Types.Length);
		}

		static void Increment(long amount, PerformanceCounter total, PerformanceCounter remote, PerformanceCounter local)
		{
			total.IncrementBy(amount);

			if (ServiceHandler.IsExecuting)
				remote.IncrementBy(amount);
			else
				local.IncrementBy(amount);
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
