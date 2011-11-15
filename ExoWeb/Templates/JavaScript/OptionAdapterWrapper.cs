using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;
using Jurassic.Library;
using ExoGraph;
using ExoRule;

namespace ExoWeb.Templates.JavaScript
{
	class OptionAdapterWrapper : Wrapper<OptionAdapter>
	{
		internal OptionAdapterWrapper(ScriptEngine engine, OptionAdapter templateAdapter)
			: base(templateAdapter, engine, engine.Object.InstancePrototype)
		{ }
	}
}

