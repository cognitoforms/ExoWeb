using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	class ContextWrapper : Wrapper<Page>
	{
		internal ContextWrapper(ScriptEngine engine, Page page)
			: base(page, engine, engine.Object.Prototype)
		{
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			if (jsPropertyName == "model")
				return Page.ScriptMarshaller.Wrap(RealObject.Model);

			return base.GetMissingPropertyValue(jsPropertyName);
		}
	}
}
