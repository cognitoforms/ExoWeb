using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb.Templates.MicrosoftAjax
{
	internal class Adapter
	{
		internal Adapter(GraphProperty property, object value)
		{
			this.Property = property;
			this.Value = value;
		}

		public GraphProperty Property { get; private set; }

		public object Value { get; private set; }

		internal bool IsList
		{
			get { return Property is GraphReferenceProperty && ((GraphReferenceProperty)Property).IsList; }
		}

		public object Evaluate(string expression)
		{
			switch (expression)
			{
				case "isList":
					return IsList;
				case "target":
					break;
				case "propertyPath":
					break;
				case "propertyChain":
					break;
				case "label":
					return ExoWeb.Adapter.GetLabel(Property);
				case "helptext":
					break;
				case "options":
					break;
				case "selected":
					break;
				case "rawValue":
					break;
				case "displayValue":
					return Value.ToString();
				case "systemValue":
					return Value;
			}
			return null;
		}
	}
}
