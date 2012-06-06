using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoRule;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	class ConditionWrapper : Wrapper<Condition>
	{
		internal ConditionWrapper(ScriptEngine engine, Condition condition)
			: base(condition, engine, engine.Object.InstancePrototype)
		{ }

		protected override object GetMissingPropertyValue(string jsPropertyName)
		{
			var result = Evaluate(RealObject, jsPropertyName);
			if (result.IsValid)
				return result.Value;

			return base.GetMissingPropertyValue(jsPropertyName);
		}

		internal static BindingResult Evaluate(Condition condition, string expression)
		{
			bool isValid = false;
			object value = null;

			switch (expression)
			{
				case "message":
					isValid = true;
					value = condition.Message;
					break;
			}

			return new BindingResult() { IsValid = isValid, Value = value };
		}
	}
}
