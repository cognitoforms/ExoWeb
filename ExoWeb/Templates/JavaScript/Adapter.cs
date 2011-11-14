using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;
using Jurassic.Library;
using ExoGraph;
using ExoRule;
using TemplateAdapter = ExoWeb.Templates.MicrosoftAjax.Adapter;

namespace ExoWeb.Templates.JavaScript
{
	class Adapter : Wrapper<TemplateAdapter>
	{
		internal Adapter(ScriptEngine engine, TemplateAdapter templateAdapter)
			: base(templateAdapter, engine, engine.Object.InstancePrototype)
		{
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			switch(jsPropertyName)
			{
				case "isList":
					return LazyDefineMethod(jsPropertyName, adapter => adapter.IsList );
			}

			return base.GetMissingPropertyValue(jsPropertyName);
		}
	}
}

