using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb
{
	public class SerializeEventArgs : EventArgs
	{
		internal SerializeEventArgs(GraphInstance instance)
		{
			this.Instance = instance;
		}

		public GraphInstance Instance { get; private set; }
	}
}
