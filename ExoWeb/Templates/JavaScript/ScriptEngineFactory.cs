using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;
using ExoModel;

namespace ExoWeb.Templates.JavaScript
{
	/// <summary>
	/// Ties the lifetime of a ScriptEngine to that of each ModelContext.
	/// </summary>
	class ScriptEngineFactory : IScriptEngineFactory
	{
		public ScriptEngine GetScriptEngine()
		{
			return ModelContext.Current.GetExtension<Extension>().Engine;
		}

		class Extension
		{
			public ScriptEngine Engine = new ScriptEngine();
		}
	}
}