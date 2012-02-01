using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;
using System.Threading;
using System.Text.RegularExpressions;

namespace ExoWeb.Templates.JavaScript
{
	/// <summary>
	/// Represents a script expression that can be evaluated like a function
	/// </summary>
	class ScriptFunction
	{
		static IDictionary<string, string> functionNames = new Dictionary<string, string>();

		IScriptEngineFactory engineFactory;
		string expression;
		string functionName;
		string functionBody;

		/// <summary>
		/// Creates a function based on an expression. Ex: "x + 1"
		/// </summary>
		public ScriptFunction(IScriptEngineFactory engineFactory, IEnumerable<string> argumentNames, string expression)
			: this(engineFactory, argumentNames, expression, true)
		{
		}

		/// <summary>
		/// Creates a function based on an expression. Ex: "x + 1"
		/// </summary>
		public ScriptFunction(IScriptEngineFactory engineFactory, IEnumerable<string> argumentNames, string expression, bool addReturnStatement)
		{
			this.engineFactory = engineFactory;
			this.expression = expression;
			
			// generate the javascript for the function
			StringBuilder argsDecl = new StringBuilder();

			foreach (string arg in argumentNames)
			{
				if (argsDecl.Length > 0)
					argsDecl.Append(",");
				argsDecl.Append(arg);
			}

			if(addReturnStatement)
				functionBody = "(" + argsDecl + "){return (" + expression + ");}";
			else
				functionBody = "(" + argsDecl + "){ " + expression + " }";

			// assign a unique name to this function
			lock (functionNames)
			{
				if (!functionNames.TryGetValue(functionBody, out functionName))
				{
					functionName = "_func_" + functionNames.Count;
					functionNames.Add(functionBody, functionName);
				}
			}

			// Verify the syntax of the function. This will also register the function with the current script engine.
			EnsureCompiled(engineFactory.GetScriptEngine());
		}

		void EnsureCompiled(ScriptEngine engine)
		{
			// Has the function already been declared in this script engine?
			if (!engine.HasGlobalValue(functionName))
			{
				try
				{
					// Declare the function in the script engine
					engine.Evaluate("function " + functionName + functionBody);
				}
				catch (Exception err)
				{
					throw new ScriptFunctionSyntaxException(expression, err);
				}
			}
		}

		public object Evaluate(IEnumerable<object> arguments, Marshaler marshaler)
		{
			ScriptEngine engine = engineFactory.GetScriptEngine();

			EnsureCompiled(engine);

			// call the function
			object[] wrappedArgs = arguments.Select(marshaler.Wrap).ToArray();
			object result;
			try
			{
				result = engine.CallGlobalFunction(functionName, wrappedArgs);
			}
			catch(Jurassic.JavaScriptException err)
			{
				throw new ScriptFunctionEvaluationException(expression, err);
			}
			return marshaler.Unwrap(result);
		}
	}
}
