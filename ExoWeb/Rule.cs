using System;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Runtime.Serialization;
using ExoGraph;
using System.ComponentModel.DataAnnotations;

namespace ExoWeb
{
	#region Rule

	[DataContract]
	public abstract class Rule
	{
		GraphType type;

		protected Rule(GraphType type)
		{
			this.type = type;
		}

		public GraphType Type
		{
			get
			{
				return type;
			}
		}
	}

	#endregion

	#region PropertyRule

	[DataContract]
	public abstract class PropertyRule : Rule
	{
		GraphProperty property;

		protected PropertyRule(GraphProperty property)
			: base(property.DeclaringType)
		{
			this.property = property;
		}

		public GraphProperty Property
		{
			get
			{
				return property;
			}
		}
	}

	#endregion

	#region RequiredRule

	[DataContract(Name = "required")]
	public class RequiredRule : PropertyRule
	{
		public RequiredRule(GraphProperty property)
			: base(property)
		{ }
	}

	#endregion

	#region AllowedValuesRule

	[DataContract(Name = "allowedValues")]
	public class AllowedValuesRule : PropertyRule
	{
		public AllowedValuesRule(GraphProperty property, string source, bool autoInclude)
			: base(property)
		{
			this.Source = source;
			this.AutoInclude = autoInclude;
		}

		[DataMember(Name = "source")]
		public string Source { get; private set; }

		public bool AutoInclude { get; private set; }
	}

	#endregion

	#region RangeRule

	[DataContract(Name = "range")]
	public class RangeRule : PropertyRule
	{
		public RangeRule(GraphProperty property, object minimum, object maximum)
			: base(property)
		{
			this.Minimum = minimum;
			this.Maximum = maximum;
		}

		[DataMember(Name = "min")]
		public object Minimum { get; private set; }

		[DataMember(Name = "max")]
		public object Maximum { get; private set; }
	}

	#endregion

	#region StringLengthRule

	[DataContract(Name = "stringLength")]
	public class StringLengthRule : PropertyRule
	{
		public StringLengthRule(GraphProperty property, int minimumLength, int maximumLength)
			: base(property)
		{
			this.MinimumLength = minimumLength;
			this.MaximumLength = maximumLength;
		}

		[DataMember(Name = "min", EmitDefaultValue = false)]
		public int MinimumLength { get; private set; }

		[DataMember(Name = "max", EmitDefaultValue = false)]
		public int MaximumLength { get; private set; }
	}
	
	#endregion

	#region IRuleProvider

	public interface IRuleProvider
	{
		IEnumerable<Rule> GetRules(GraphType type);
	}

	#endregion

	#region DataAnnotationsRuleProvider

	public class DataAnnotationsRuleProvider : IRuleProvider
	{
		#region IRuleProvider Members

		public IEnumerable<Rule> GetRules(GraphType type)
		{
			List<Rule> rules = new List<Rule>();

			foreach (GraphProperty property in type.Properties)
			{
				if (property.DeclaringType == type)
				{
					// Required
					if (property.HasAttribute<RequiredAttribute>())
						rules.Add(new RequiredRule(property));

					// String Length
					StringLengthAttribute stringLengthAttribute = property.GetAttributes<StringLengthAttribute>().FirstOrDefault();
					if (stringLengthAttribute != null)
						rules.Add(new StringLengthRule(property, 0, stringLengthAttribute.MaximumLength));

					// Range
					RangeAttribute rangeAttribute = property.GetAttributes<RangeAttribute>().FirstOrDefault();
					if (rangeAttribute != null)
						rules.Add(new RangeRule(property, rangeAttribute.Minimum, rangeAttribute.Maximum));
				}
			}

			return rules;
		}

		#endregion
	}

	#endregion
}
