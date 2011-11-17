using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule;
using ExoRule.Validation;
using System.Collections;

namespace ExoWeb.Templates
{
	public class Adapter : IBindable
	{
		string label;
		IEnumerable<OptionAdapter> options;

		internal Adapter(GraphInstance source, GraphProperty property, object value, string format, string label)
		{
			this.Source = source;
			this.Property = property;
			this.RawValue = value;
			this.Format = format;
			this.Label = label ?? property.Label;
		}

		public GraphInstance Source { get; private set; }

		public GraphProperty Property { get; private set; }

		public object RawValue { get; private set; }

		public string Format { get; private set; }

		public string Label { get; private set; }

		public object DisplayValue
		{
			get
			{
				if (RawValue == null)
					return null;
				if (RawValue is IEnumerable && !(RawValue is String))
					return ((IEnumerable)RawValue).Cast<object>().Select(i => GetDisplayFormat(i, Format));
				return GetDisplayFormat(RawValue, Format);
			}
		}

		internal static string GetDisplayFormat(object value, string format)
		{
			if (value is GraphInstance)
			{
				var type = ((GraphInstance)value).Type;
				var property = (type.Properties["Label"] ?? type.Properties["Name"] ?? type.Properties["Text"] ?? type.Properties["Description"]) as GraphValueProperty;
				if (property != null && property.PropertyType == typeof(string))
					return (string)((GraphInstance)value).GetValue(property);
			}
			return value != null ? value.ToString() : "";
		}

		public object SystemValue
		{
			get
			{
				if (RawValue == null)
					return null;
				if (RawValue is GraphInstance)
					return GetSystemFormat((GraphInstance)RawValue);
				if (RawValue is IEnumerable<GraphInstance>)
					return ((IEnumerable<GraphInstance>)RawValue).Select(i => GetSystemFormat(i));
				return RawValue.ToString();
			}
		}

		internal string GetSystemFormat(GraphInstance instance)
		{
			return instance.Id;
		}

		public IEnumerable<OptionAdapter> Options
		{
			get
			{
				if (options != null)
					return options;

				var allowedValues = AllowedValuesRule.GetAllowedValues(Source, Property);
				return allowedValues == null ? null : allowedValues.Select(i => new OptionAdapter(this, i));
			}
			set
			{
				this.options = value;
			}
		}

		internal bool IsList
		{
			get
			{
				return Property is GraphReferenceProperty && ((GraphReferenceProperty)Property).IsList;
			}
		}

		object IBindable.Evaluate(string expression)
		{
			switch (expression)
			{
				case "isList":
					return IsList;
				case "label":
					return Label;
				case "options":
					return Options;
				case "rawValue":
					return RawValue;
				case "displayValue":
					return DisplayValue;
				case "systemValue":
					return SystemValue;
			}
			return null;
		}
	}
}
