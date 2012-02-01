using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates.JavaScript
{
	class ScriptFunctionEvaluationException : Exception
	{
		public ScriptFunctionEvaluationException(string expression, Exception inner)
			:base("Error evaluating expression: " + expression + " ==> " + inner.Message, inner)
		{
		}
	}
}
