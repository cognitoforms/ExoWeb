using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	class PageContextWrapper : Wrapper<Page>
	{
		internal PageContextWrapper(ScriptEngine engine, Page page)
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
