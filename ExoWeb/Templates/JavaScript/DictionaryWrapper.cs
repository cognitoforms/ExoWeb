using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	class DictionaryWrapper : Wrapper<IDictionary<string, object>>
	{
		internal DictionaryWrapper(ScriptEngine engine, IDictionary<string, object> dictionary)
			: base(dictionary, engine, engine.Object.Prototype)
		{
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			if (RealObject.ContainsKey(jsPropertyName))
				return Page.ScriptMarshaller.Wrap(RealObject[jsPropertyName]);

			return base.GetMissingPropertyValue(jsPropertyName);
		}
	}
}
