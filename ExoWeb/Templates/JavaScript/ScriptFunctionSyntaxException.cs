using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates.JavaScript
{
	class ScriptFunctionSyntaxException : Exception
	{
		public ScriptFunctionSyntaxException(string expression, Exception inner)
			: base("Syntax error: " + inner.Message + ", expression: " + expression, inner)
		{
		}
	}
}
