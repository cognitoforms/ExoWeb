using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb
{
	public class ServiceRequestEventArgs : EventArgs
	{
		internal ServiceRequestEventArgs(ServiceRequest request)
		{
			this.Request = request;
		}

		public ServiceRequest Request { get; private set; }
	}
}
