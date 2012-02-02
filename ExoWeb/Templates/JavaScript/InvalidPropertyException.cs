using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;

namespace ExoWeb.Templates.JavaScript
{	
	/// <summary>
	/// Thrown when a Javascript interpreter encounters an unknown model property
	/// </summary>
	class InvalidPropertyException : Exception
	{
		public InvalidPropertyException(ModelType type, string name)
			: base("Invalid property: " + type.Name + "." + name)
		{
		}
	}
}
