using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;
using Jurassic.Library;
using ExoGraph;
using ExoRule;
using TemplateAdapter = ExoWeb.Templates.Adapter;

namespace ExoWeb.Templates.JavaScript
{
	class Adapter : ObjectInstance
	{
		TemplateAdapter templateAdapter;

		internal Adapter(ScriptEngine engine, TemplateAdapter templateAdapter)
			: base(engine, engine.Object.InstancePrototype)
		{
			this.templateAdapter = templateAdapter;
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			return "woohoo!";
		}
	}
}

