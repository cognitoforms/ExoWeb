using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Jurassic;
using Jurassic.Library;

namespace ExoWeb.Templates.JavaScript
{
	class TemplateContextWrapper : Wrapper<Context>
	{
		internal TemplateContextWrapper(ScriptEngine engine, Context context)
			: base(context, engine, engine.Object.Prototype)
		{
			this.PopulateFunctions();
		}

		[JSFunction(Name = "getInstanceId")]
		public string GetInstanceId(string id)
		{
			return RealObject.GetInstanceId(id);
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			if (jsPropertyName == "parentContext")
				return new TemplateContextWrapper(Engine, RealObject.ParentContext);

			return base.GetMissingPropertyValue(jsPropertyName);
		}
	}
}
