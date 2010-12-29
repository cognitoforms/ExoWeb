using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb
{
	public class EnsureConditionsEventArgs : EventArgs
	{
		internal EnsureConditionsEventArgs(IEnumerable<GraphInstance> instances)
		{
			this.Instances = instances;
		}

		public IEnumerable<GraphInstance> Instances { get; private set; }
	}
}
