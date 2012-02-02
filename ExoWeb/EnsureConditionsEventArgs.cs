using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;

namespace ExoWeb
{
	public class EnsureConditionsEventArgs : EventArgs
	{
		internal EnsureConditionsEventArgs(IEnumerable<ModelInstance> instances)
		{
			this.Instances = instances;
		}

		public IEnumerable<ModelInstance> Instances { get; private set; }
	}
}
