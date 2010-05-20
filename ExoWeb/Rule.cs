using System;
using System.Linq;
using System.Text;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Runtime.Serialization;
using ExoGraph;
using System.ComponentModel.DataAnnotations;
using System.Collections;
using ExoRule;

namespace ExoWeb
{
	public enum ClientRuleType
	{
		unsupported,
		required,
		range,
		stringLength,
		allowedValues
	}

	#region Rule

	[DataContract]
	public abstract class Rule : ExoRule.Rule
	{
		protected Rule(GraphType type, string name)
			: base(name)
		{
			this.GraphTypeName = type.Name;
		}

		[DataMember(Name = "rootType")]
		public string GraphTypeName { get; private set; }

		public GraphType Type
		{
			get
			{
				return GraphContext.Current.GetGraphType(GraphTypeName);
			}
		}
	}

	#endregion

	/// <summary>
	/// Abstract baseclass for <see cref="ExoRule.Rule"/> that is
	/// understood by client ExoWeb libraries.  Since behavior is well known,
	/// <see cref="Rule"/> and it's subclasses need not specify an <see cref="Action&lt;T&gt;"/>,
	/// merely any information required to perform the action.
	/// </summary>
	[DataContract]
	public abstract class PropertyRule : Rule
	{
		string property;

		public PropertyRule(GraphProperty graphProperty, ConditionType conditionType, ClientRuleType clientRuleType)
			: base(graphProperty.DeclaringType, string.Format("{0}.{1}.{2}", graphProperty.DeclaringType.Name, graphProperty.Name, clientRuleType.ToString()))
		{
			this.ClientRuleType = clientRuleType;
			this.property = graphProperty.Name;
			
			this.ConditionType = conditionType;
			ConditionType.ConditionRule = this;
		}

		[DataMember(Name = "properties")]
		private string[] Properties 
		{
			get
			{
				return new string[] { GraphProperty.IsStatic ? GraphProperty.Name : "this." + GraphProperty.Name };
			}
			set { }
		}

		[DataMember(Name = "clientRuleType")]
		private string _ClientRuleType
		{
			get
			{
				return this.ClientRuleType.ToString();
			}
			set { }
		}

		public ClientRuleType ClientRuleType { get; protected set; }

		/// <summary>
		/// A <see cref="ConditionType"/> that will associated with a graph when
		/// CheckCondition returns true;
		/// </summary>
		public ConditionType ConditionType { get; set; }

		/// <summary>
		/// The <see cref="GraphProperty"/> representing the property that this rule
		/// will depend on and that any <see cref="ConditionTarget"/>s will target.
		/// </summary>
		public GraphProperty GraphProperty
		{
			get
			{
				return Type.Properties[property];
			}
		}

		public override void Register()
		{
			if (GraphProperty is GraphReferenceProperty)
			{
				Type.ReferenceChange += (sender, e) =>
				{
					if (e.Property == this.GraphProperty)
						Invoke(e.Instance, e);
				};
			}
			else if (GraphProperty is GraphValueProperty)
			{
				Type.ValueChange += (sender, e) =>
				{
					if (e.Property == this.GraphProperty)
						Invoke(e.Instance, e);
				};
			}
		}

		protected override void Invoke(GraphInstance root, GraphEvent graphEvent)
		{
			ConditionType.When(root.Instance, () => ConditionApplies(root), GraphProperty.Name);
		}

		/// <summary>
		/// Overridden in subclasses to determine if the <see cref="ConditionType"/>
		/// applies.
		/// </summary>
		/// <returns>true if <paramref name="root"/> should be associated with the <see cref="ConditionType"/></returns>
		protected abstract bool ConditionApplies(GraphInstance root);
	}

	/// <summary>
	/// Applies conditions when the value of a <see cref="GraphProperty"/> is
	/// null or an empty list.
	/// </summary>
	[DataContract(Name = "required")]
	public class RequiredRule : PropertyRule
	{
		public RequiredRule(GraphProperty graphProperty, ConditionType conditionType)
			: base(graphProperty, conditionType, ClientRuleType.required)
		{ }

		protected override bool ConditionApplies(GraphInstance root)
		{
			if (GraphProperty is GraphReferenceProperty && ((GraphReferenceProperty)GraphProperty).IsList)
			{
				foreach (object item in ((IEnumerable)root.Instance.GetType().GetProperty(GraphProperty.Name).GetValue(root.Instance, null)))
				{
					return false;
				}
				return true;
			}
			else
				return root.Instance.GetType().GetProperty(GraphProperty.Name).GetValue(root.Instance, null) != null;
		}
	}

	/// <summary>
	/// Applies conditions when the value of a <see cref="GraphProperty"/> is
	/// not within a specified range.
	/// </summary>
	[DataContract(Name = "range")]
	public class RangeRule : PropertyRule
	{
		public RangeRule(GraphProperty graphProperty, ConditionType conditionType, IComparable minimum, IComparable maximum)
			: base(graphProperty, conditionType, ClientRuleType.range)
		{
			this.Minimum = minimum;
			this.Maximum = maximum;
		}

		[DataMember(Name = "min")]
		public IComparable Minimum { get; private set; }

		[DataMember(Name = "max")]
		public IComparable Maximum { get; private set; }

		protected override bool ConditionApplies(GraphInstance root)
		{
			object value = root.Instance.GetType().GetProperty(GraphProperty.Name).GetValue(root.Instance, null);

			if (value == null)
				return true;

			// min <= value <= max
			// CompareTo = 0: equal, >0: instance > value
			if (Minimum != null && Maximum != null)
				return Minimum.CompareTo(value) > 0 && Maximum.CompareTo(value) < 0;
			else if (Minimum != null)
				return Minimum.CompareTo(value) > 0;
			else if (Maximum != null)
				return Maximum.CompareTo(value) < 0;
			else
				return false;
		}
	}

	/// <summary>
	/// Applies conditions when the value of a <see cref="GraphProperty"/> is
	/// too short or long.
	/// </summary>
	[DataContract(Name = "stringLength")]
	public class StringLengthRule : PropertyRule
	{
		public StringLengthRule(GraphProperty graphProperty, ConditionType conditionType, int minimum, int maximum)
			: base(graphProperty, conditionType, ClientRuleType.stringLength)
		{
			this.Minimum = minimum;
			this.Maximum = maximum;
		}

		[DataMember(Name = "min", EmitDefaultValue = false)]
		public int Minimum { get; private set; }

		[DataMember(Name = "max", EmitDefaultValue = false)]
		public int Maximum { get; private set; }

		protected override bool ConditionApplies(GraphInstance root)
		{
			object value = root.Instance.GetType().GetProperty(GraphProperty.Name).GetValue(root.Instance, null);

			if (value == null)
				return true;

			int len = value.ToString().Length;
			return len > Maximum || len < Minimum;
		}
	}

	/// <summary>
	/// Applies conditions when the value of a <see cref="GraphProperty"/> is
	/// not an allowed value.
	/// </summary>
	[DataContract(Name = "allowedValues")]
	public class AllowedValuesRule : PropertyRule
	{
		public AllowedValuesRule(GraphProperty graphProperty, ConditionType conditionType, string source, bool autoInclude)
			: base(graphProperty, conditionType, ClientRuleType.allowedValues)
		{
			this.Source = source;
			this.AutoInclude = autoInclude;
		}

		[DataMember(Name = "source")]
		public string Source { get; private set; }

		public bool AutoInclude { get; private set; }

		#region Source Evaluation Logic
		GraphInstanceList EvaluateInstancePath(GraphInstance root, string path)
		{
			if (string.IsNullOrEmpty(path))
				return null;

			string[] steps = path.Split('.');

			// property was found, procede to last step
			GraphInstance instance = root;

			for (int i = 0; i < steps.Length - 1; i++)
			{
				instance = instance.GetReference(steps[i]);

				if (instance == null)
					return null;
			}
			return instance.GetList(steps.Last());

		}

		GraphInstanceList EvaluateStaticPath(string path)
		{
			if (string.IsNullOrEmpty(path))
				return null;

			string[] steps = path.Split('.');

			if(steps.Length < 2)
				return null;

			GraphType type = GraphContext.Current.GetGraphType(steps[0]);
			GraphReferenceProperty firstProp = type.Properties[steps[1]] as GraphReferenceProperty;

			if (firstProp == null)
				return null;
			else if (steps.Length == 2)
			{
				return type.GetList(firstProp);
			}
			else
			{
				GraphInstance firstInstance = Type.GetReference(firstProp);
				return firstInstance != null ? EvaluateInstancePath(firstInstance, string.Join(".", steps, 2, steps.Length - 2)) : null;
			}
		}
		#endregion

		protected override bool ConditionApplies(GraphInstance root)
		{
			object value = root.Instance.GetType().GetProperty(GraphProperty.Name).GetValue(root.Instance, null);

			GraphInstanceList allowedValues = null;

			try
			{
				if (Source.StartsWith("this."))
					allowedValues = EvaluateInstancePath(root, Source.Substring(5));
				else
					allowedValues = EvaluateStaticPath(Source);

				return !(allowedValues == null || allowedValues.Select(graphInstance => graphInstance.Instance).Contains(value));
			}
			catch
			{
				return false;
			}
		}
	}

	/*
	 
	#region DataAnnotationsAdapter

	public class DataAnnotationsAdapter : IServiceAdapter
	{
		IEnumerable<Rule> IServiceAdapter.GetRules(GraphType type)
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

					// Allowed Values
					GraphProperty allowValuesSource = AllowedValuesAttribute.GetAllowedValues(property);
					if (allowValuesSource != null)
						rules.Add(new AllowedValuesRule(property, 
							allowValuesSource.IsStatic ? allowValuesSource.DeclaringType.Name + "." + allowValuesSource.Name : "this." + allowValuesSource.Name, 
							!allowValuesSource.IsStatic));
				}
			}

			return rules;
		}

		string IServiceAdapter.GetFormatName(GraphProperty property)
		{
			return null;
		}

		void IServiceAdapter.OnError(IServiceError error)
		{ }
	}

	#endregion

	#region AllowedValuesAttribute

	public class AllowedValuesAttribute : ValidationAttribute
	{
		public string From { get; set; }

		public string For { get; set; }

		public override bool IsValid(object value)
		{
			return true;
		}

		/// <summary>
		/// Gets the property that provides allowed values for the specified <see cref="GraphProperty"/>.
		/// </summary>
		/// <param name="property"></param>
		/// <returns></returns>
		public static GraphProperty GetAllowedValues(GraphProperty property)
		{
			// First see if there is an allowed values attribute on the specified property
			AllowedValuesAttribute allowedValues = property.GetAttributes<AllowedValuesAttribute>().FirstOrDefault();
			if (allowedValues != null)
				return property.DeclaringType.Properties[allowedValues.From];

			// Then see if there is an allowed values attribute on the type of the property
			if (property is GraphReferenceProperty)
			{
				allowedValues = ((GraphReferenceProperty)property).PropertyType.GetAttributes<AllowedValuesAttribute>().FirstOrDefault();
				if (allowedValues != null)
					return ((GraphReferenceProperty)property).PropertyType.Properties[allowedValues.From];
			}

			// Finally, see if another property on the declaring type provides allowed values for this property
			return (from p in property.DeclaringType.Properties
					  from attr in p.GetAttributes<AllowedValuesAttribute>()
					  where attr.For == property.Name
					  select p).FirstOrDefault();
		}
	}

	#endregion
	
	*/
}
