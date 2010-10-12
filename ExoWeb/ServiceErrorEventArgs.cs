using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb
{
	public class ServiceErrorEventArgs : EventArgs
	{
		internal ServiceErrorEventArgs(ServiceError error)
		{
			this.Error = error;
		}

		public ServiceError Error { get; private set; }
	}
}
