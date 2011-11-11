using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb.Templates
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

		public object Evaluate(string expression)
		{
			switch (expression)
			{
				case "isList":
					return Property is GraphReferenceProperty && ((GraphReferenceProperty)Property).IsList;
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
