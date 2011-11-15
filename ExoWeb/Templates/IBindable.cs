using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates
{
	public interface IBindable
	{
		object Evaluate(string expression);
	}
}
