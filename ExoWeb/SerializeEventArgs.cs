using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;

namespace ExoWeb
{
	public class SerializeEventArgs : EventArgs
	{
		internal SerializeEventArgs(ModelInstance instance)
		{
			this.Instance = instance;
		}

		public ModelInstance Instance { get; private set; }
	}
}
