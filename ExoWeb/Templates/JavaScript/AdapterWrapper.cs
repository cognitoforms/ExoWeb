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
	class AdapterWrapper : Wrapper<Adapter>
	{
		internal AdapterWrapper(ScriptEngine engine, Adapter templateAdapter)
			: base(templateAdapter, engine, engine.Object.InstancePrototype)
		{ }

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			if (jsPropertyName.StartsWith("get_"))
			{
				var prop = jsPropertyName.Substring(4);
				if (RealObject.HasProperty(prop))
				{
					return LazyDefineMethod<string>(jsPropertyName, adapter =>
					{
						return adapter.GetPropertyValue(prop);
					});
				}
			}

			return base.GetMissingPropertyValue(jsPropertyName);
		}
	}
}

