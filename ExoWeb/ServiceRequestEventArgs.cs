using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;

namespace ExoWeb
{
	public class ServiceRequestEventArgs : EventArgs
	{
		internal ServiceRequestEventArgs(ServiceRequest request, ServiceResponse response)
		{
			this.Request = request;
			this.Response = response;
		}

		public ServiceRequest Request { get; private set; }
		internal ServiceResponse Response { get; private set; }
	}
}
