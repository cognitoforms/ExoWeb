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
	class Meta : ObjectInstance
	{
		GraphInstance instance;

		internal Meta(ScriptEngine engine, GraphInstance instance)
			: base(engine, engine.Object.InstancePrototype)
		{
			this.instance = instance;
		}

		[JSFunction(Name = "isAllowed")]
		public bool IsAllowed(string condition)
		{
			return !Condition.GetConditions(instance).Any(c => c.Type.Code == condition);
		}

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			if (jsPropertyName == "id")
				return instance.Id;

			return base.GetMissingPropertyValue(jsPropertyName);
		}
	}
}

