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

	#region ClientRuleType

	/// <summary>
	/// Correspond to rules that are implemented by ExoWeb client scripts.
	/// </summary>
	public enum ClientRuleType
	{
		unsupported,
		required,
		requiredIf,
		range,
		stringLength,
		allowedValues,
		compare
	}

	#endregion

	#region PropertyRule

	/// <summary>
	/// Abstract baseclass for <see cref="ExoRule.Rule"/> that is
	/// understood by client ExoWeb libraries.  Since behavior is well known,
	/// <see cref="Rule"/> and it's subclasses need not specify an <see cref="Action&lt;T&gt;"/>,
	/// merely any information required to perform the action.
	/// </summary>
	[DataContract]
	public abstract class PropertyRule : Rule
	{
		#region Fields

		private string propertyName;

		// By default rules should register to run on property change.
		private PropertyRuleRegistrationMode registrationMode = PropertyRuleRegistrationMode.PropertyChange;

		private string[] propertyPaths;

		#endregion

		#region Constructors

		public PropertyRule(GraphProperty graphProperty, ConditionType conditionType, ClientRuleType clientRuleType)
			: base(graphProperty.DeclaringType, string.Format("{0}.{1}.{2}", graphProperty.DeclaringType.Name, graphProperty.Name, clientRuleType.ToString()))
		{
			this.ClientRuleType = clientRuleType;

			this.propertyName = graphProperty.Name;

			this.ConditionType = conditionType;
			ConditionType.ConditionRule = this;
		}

		#endregion

		#region Properties

		/// <summary>
		/// Client-format property path(s) that the rule applies to.
		/// </summary>
		[DataMember(Name = "properties")]
		private string[] PropertyPaths
		{
			get
			{
				if (propertyPaths == null)
				{
					propertyPaths = new string[] { (GraphProperty.IsStatic ? GraphProperty.DeclaringType.Name : "this") + "." + GraphProperty.Name };
				}

				return propertyPaths;
			}
			set
			{
				propertyPaths = value;
			}
		}

		/// <summary>
		/// The type of rule implementation in client script.
		/// </summary>
		public ClientRuleType ClientRuleType { get; protected set; }

		/// <summary>
		/// String name of a rule that is recognized by client scripts.
		/// </summary>
		[DataMember(Name = "clientRuleType")]
		private string ClientRuleTypeName
		{
			get
			{
				return ClientRuleType.ToString();
			}
			set
			{
				ClientRuleType = (ClientRuleType)Enum.Parse(typeof(ClientRuleType), value);
			}
		}

		/// <summary>
		/// Indicates which event(s) a property rule should subscribe to.
		/// </summary>
		public PropertyRuleRegistrationMode RegistrationMode
		{
			get { return registrationMode; }
			set { registrationMode = value; }
		}

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
				// Store the property name rather than property so that the property 
				// can be retrieved off of the <see cref="GraphType"/> in the current <see cref="GraphContext"/>.
				return Type.Properties[propertyName];
			}
		}

		#endregion

		#region Methods

		/// <summary>
		/// Registers the rule to run on type init, property change, or both.
		/// </summary>
		public override void Register()
		{
			if ((RegistrationMode & PropertyRuleRegistrationMode.TypeInit) != 0)
			{
				Type.Init += (sender, e) =>
				{
					Invoke(e.Instance, e);
				};
			}

			if ((RegistrationMode & PropertyRuleRegistrationMode.PropertyChange) != 0)
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
		}

		protected override void Invoke(GraphInstance root, GraphEvent graphEvent)
		{
			ConditionType.When(root.Instance, () => ConditionApplies(root), GraphProperty.Name);
		}

		/// <summary>
		/// Overridden in subclasses to determine if the <see cref="ConditionType"/> applies.
		/// </summary>
		/// <returns>true if <paramref name="root"/> should be associated with the <see cref="ConditionType"/></returns>
		protected abstract bool ConditionApplies(GraphInstance root);

		/// <summary>
		/// 
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstanceList GetInstanceReferenceList(GraphInstance instance, GraphReferenceProperty property)
		{
			return instance.GetList(property);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstanceList GetInstanceReferenceList(GraphInstance instance, string property)
		{
			return GetInstanceReferenceList(instance, instance.Type.Properties[property] as GraphReferenceProperty);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstance GetInstanceReference(GraphInstance instance, GraphReferenceProperty property)
		{
			return instance.GetReference(property);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstance GetInstanceReference(GraphInstance instance, string property)
		{
			return GetInstanceReference(instance, instance.Type.Properties[property] as GraphReferenceProperty);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static object GetInstanceValue(GraphInstance instance, GraphValueProperty property)
		{
			return instance.GetValue(property);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static object GetInstanceValue(GraphInstance instance, string property)
		{
			return GetInstanceValue(instance, instance.Type.Properties[property] as GraphValueProperty);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="type"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstanceList GetStaticReferenceList(GraphType type, GraphReferenceProperty property)
		{
			return type.GetList(property);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="type"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstanceList GetStaticReferenceList(GraphType type, string property)
		{
			return GetStaticReferenceList(type, type.Properties[property] as GraphReferenceProperty);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="type"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstance GetStaticReference(GraphType type, GraphReferenceProperty property)
		{
			return type.GetReference(property);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="type"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static GraphInstance GetStaticReference(GraphType type, string property)
		{
			return GetStaticReference(type, type.Properties[property] as GraphReferenceProperty);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="type"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static object GetStaticValue(GraphType type, GraphValueProperty property)
		{
			return type.GetValue(property);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="type"></param>
		/// <param name="property"></param>
		/// <returns></returns>
		private static object GetStaticValue(GraphType type, string property)
		{
			return GetStaticValue(type, type.Properties[property] as GraphValueProperty);
		}

		/// <summary>
		/// Gets the value for the given <see cref="GraphInstance"/> for the given <see cref="GraphProperty"/>.
		/// Performs arbitrary logic (depending on the type of property) and returns a value of type <typeparam name="T" />.
		/// </summary>
		/// <param name="root">The root object from which to evaluate the given property.</param>
		/// <param name="property">The property to evaluate.</param>
		/// <param name="ifInstance">Code to execute if the property is an instance reference.</param>
		/// <param name="ifInstanceList">Code to execute if the property is an instance list.</param>
		/// <param name="ifValue">Code to execute if the property is a value.</param>
		/// <returns>The value resulting from calling the function for the given property type.</returns>
		protected internal static T ForInstanceProperty<T>(GraphInstance instance, GraphProperty property,
			Func<GraphInstance, T> ifInstance, Func<GraphInstanceList, T> ifInstanceList, Func<object, T> ifValue)
		{
			GraphReferenceProperty referenceProperty = property as GraphReferenceProperty;
			if (referenceProperty != null)
			{
				if (referenceProperty.IsList)
				{
					return ifInstanceList(GetInstanceReferenceList(instance, referenceProperty));
				}
				else
				{
					return ifInstance(GetInstanceReference(instance, referenceProperty));
				}
			}
			else
			{
				GraphValueProperty valueProperty = (GraphValueProperty)property;
				return ifValue(GetInstanceValue(instance, valueProperty));
			}
		}
		
		/// <summary>
		/// Gets the value for the given <see cref="GraphType"/> for the given <see cref="GraphProperty"/>.
		/// Performs arbitrary logic (depending on the type of property) and returns a value of type <typeparam name="T" />.
		/// </summary>
		/// <param name="type">The graph type from which to evaluate the given property.</param>
		/// <param name="property">The property to evaluate.</param>
		/// <param name="ifInstance">Code to execute if the property is an instance reference.</param>
		/// <param name="ifInstanceList">Code to execute if the property is an instance list.</param>
		/// <param name="ifValue">Code to execute if the property is a value.</param>
		/// <returns>The value resulting from calling the function for the given property type.</returns>
		protected internal static T ForStaticProperty<T>(GraphType type, GraphProperty property,
			Func<GraphInstance, T> ifInstance, Func<GraphInstanceList, T> ifInstanceList, Func<object, T> ifValue)
		{
			GraphReferenceProperty referenceProperty = property as GraphReferenceProperty;
			if (referenceProperty != null)
			{
				if (referenceProperty.IsList)
				{
					return ifInstanceList(GetStaticReferenceList(type, referenceProperty));
				}
				else
				{
					return ifInstance(GetStaticReference(type, referenceProperty));
				}
			}
			else
			{
				GraphValueProperty valueProperty = (GraphValueProperty)property;
				return ifValue(GetStaticValue(type, valueProperty));
			}
		}

		/// <summary>
		/// Get the value from the given <see cref="GraphInstance"/> for the given <see cref="GraphProperty"/>.
		/// </summary>
		/// <param name="root">The root object from which to evaluate the given property.</param>
		/// <param name="property">The property to evaluate.</param>
		/// <returns>The value of the given instance for the given property.</returns>
		protected internal static object GetValue(GraphInstance instance, GraphProperty property)
		{
			return ForInstanceProperty<object>(instance, property, reference => reference, list => list, val => val);
		}

		private static object GetInstancePropertyValue(GraphInstance root, string property)
		{
			return ForInstanceProperty<object>(root, root.Type.Properties[property], instance => instance, list => list, value => value);
		}

		private static object GetStaticPropertyValue(GraphType type, string property)
		{
			return ForStaticProperty<object>(type, type.Properties[property], instance => instance, list => list, value => value);
		}

		/// <summary>
		/// Get the value from the given <see cref="GraphInstance"/> for the given <see cref="GraphProperty"/>.
		/// Returns a boolean value that is the result of executing the given code based on the property type.
		/// </summary>
		/// <param name="root">The root object from which to evaluate the given property.</param>
		/// <param name="property">The property to evaluate.</param>
		/// <param name="ifInstance">Code to execute if the property is an instance reference.</param>
		/// <param name="ifInstanceList">Code to execute if the property is an instance list.</param>
		/// <param name="ifValue">Code to execute if the property is a value.</param>
		/// <returns>The value of the given instance for the given property.</returns>
		protected internal static bool IfValue(GraphInstance instance, GraphProperty property,
			Func<GraphInstance, bool> ifInstance, Func<GraphInstanceList, bool> ifInstanceList, Func<object, bool> ifValue)
		{
			return ForInstanceProperty<bool>(instance, property, ifInstance, ifInstanceList, ifValue);
		}

		private static T EvaluateInstancePath<T>(GraphInstance root, string path, Func<GraphInstance, string, T> resultFn)
			where T : class
		{
			if (string.IsNullOrEmpty(path))
				return null;

			string[] steps = path.Split('.');

			// Property was found, procede to last step.
			GraphInstance instance = root;

			for (int i = 0; i < steps.Length - 1; i++)
			{
				instance = GetInstanceReference(instance, steps[i]);

				if (instance == null)
					return null;
			}

			return resultFn(instance, steps.Last());
		}

		private static T EvaluateStaticPath<T>(string path, Func<GraphType, string, T> staticResultFn, Func<GraphInstance, string, T> instanceResultFn)
		{
			if (string.IsNullOrEmpty(path))
				return default(T);

			string[] steps = path.Split('.');

			if (steps.Length < 2)
				return default(T);

			GraphType type = GraphContext.Current.GetGraphType(steps[0]);
			GraphReferenceProperty firstProp = type.Properties[steps[1]] as GraphReferenceProperty;

			if (firstProp == null)
			{
				return default(T);
			}
			else if (steps.Length == 2)
			{
				return staticResultFn(type, steps[1]);
			}
			else
			{
				GraphInstance firstInstance = type.GetReference(firstProp);
				return firstInstance != null ? instanceResultFn(firstInstance, string.Join(".", steps, 2, steps.Length - 2)) : default(T);
			}
		}

		protected internal static GraphInstanceList EvaluateInstanceList(GraphInstance root, string path)
		{
			if (path.StartsWith("this."))
				return EvaluateInstancePath<GraphInstanceList>(root, path.Substring(5), GetInstanceReferenceList);
			else
				return EvaluateStaticPath<GraphInstanceList>(path, GetStaticReferenceList, GetInstanceReferenceList);
		}

		protected internal static GraphInstance EvaluateInstance(GraphInstance root, string path)
		{
			if (path.StartsWith("this."))
				return EvaluateInstancePath<GraphInstance>(root, path.Substring(5), GetInstanceReference);
			else
				return EvaluateStaticPath<GraphInstance>(path, GetStaticReference, GetInstanceReference);
		}

		protected internal static object EvaluateValue(GraphInstance root, string path)
		{
			if (path.StartsWith("this."))
				return EvaluateInstancePath<object>(root, path.Substring(5), GetInstanceValue);
			else
				return EvaluateStaticPath<object>(path, GetStaticValue, GetInstanceValue);
		}

		protected internal static object Evaluate(GraphInstance root, string path)
		{
			if (path.StartsWith("this."))
				return EvaluateInstancePath<object>(root, path.Substring(5), GetInstancePropertyValue);
			else
				return EvaluateStaticPath<object>(path, GetStaticPropertyValue, GetInstancePropertyValue);
		}

		#endregion
	}

	#endregion

	#region PropertyRuleRegistrationMode

	/// <summary>
	/// Events that a property rule can subscribe to.
	/// </summary>
	[Flags]
	public enum PropertyRuleRegistrationMode
	{
		PropertyChange = 1,
		TypeInit = 2,
		Both = 3
	}

	#endregion

	#region RequiredRule

	/// <summary>
	/// Applies conditions when the value of a <see cref="GraphProperty"/> is
	/// null or an empty list.
	/// </summary>
	[DataContract(Name = "required")]
	public class RequiredRule : PropertyRule
	{
		#region Constructors

		public RequiredRule(GraphProperty graphProperty, ConditionType conditionType)
			: base(graphProperty, conditionType, ClientRuleType.required)
		{ }

		protected RequiredRule(GraphProperty graphProperty, ConditionType conditionType, ClientRuleType clientRuleType)
			: base(graphProperty, conditionType, clientRuleType)
		{ }

		#endregion

		#region Methods

		/// <summary>
		/// Determines whether the given object has a value.
		/// The default implemenation checks to see if the object is null.
		/// </summary>
		/// <param name="value">The value to check.</param>
		/// <returns>A boolean value indicating whether the object has a value.</returns>
		protected virtual bool HasValue(object value)
		{
			return value != null;
		}

		/// <summary>
		/// Determines whether the rule should attach a condition for a property that is a reference list.
		/// The default implemenation checks to see if the list is empty.
		/// </summary>
		/// <param name="instances">The value of the property that this rule is bound to.</param>
		/// <returns>A boolean value indicating whether a condition should be attached.</returns>
		protected bool ConditionAppliesToReferenceList(GraphInstanceList instances)
		{
			return instances.Count == 0;
		}

		/// <summary>
		/// Determines whether the rule should attach a condition for a property that is a reference.
		/// The default implemenation checks to see if the reference is null.
		/// </summary>
		/// <param name="instance">The value of the property that this rule is bound to.</param>
		/// <returns>A boolean value indicating whether a condition should be attached.</returns>
		protected bool ConditionAppliesToReference(GraphInstance instance)
		{
			return instance == null;
		}

		/// <summary>
		/// Determines whether the rule should attach a condition for a property that is a value type.
		/// The default implemenation checks to see if the value is null.
		/// </summary>
		/// <param name="value">The value of the property that this rule is bound to.</param>
		/// <returns>A boolean value indicating whether a condition should be attached.</returns>
		protected bool ConditionAppliesToValue(object value)
		{
			return !HasValue(value);
		}

		/// <summary>
		/// Determines whether the rule should attach its condition to the given <see cref="GraphInstance"/>.
		/// </summary>
		/// <param name="root">The graph instance to evaluate the rule for.</param>
		/// <returns>A boolean value indicating whether the state of the given <see cref="GraphInstance"/> violates the rule.</returns>
		protected override bool ConditionApplies(GraphInstance root)
		{
			return IfValue(root, GraphProperty, ConditionAppliesToReference, ConditionAppliesToReferenceList, ConditionAppliesToValue);
		}

		#endregion
	}

	#endregion

	#region RequiredIfRule<TInput, TOutput>

	[DataContract(Name = "requiredIf")]
	public abstract class RequiredIfRule<TInput, TOutput> : RequiredRule
	{
		#region Fields

		string comparePropertyText;
		string compareOperatorText;

		#endregion

		#region Constructors

		public RequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath)
			: base(graphProperty, conditionType, ClientRuleType.requiredIf)
		{
			Init(comparePath, Operator.NotEqual, default(TInput));
		}

		public RequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath, TInput compareValue)
			: base(graphProperty, conditionType, ClientRuleType.requiredIf)
		{
			Init(comparePath, Operator.Equal, compareValue);
		}

		public RequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath, Operator compareOperator, TInput compareValue)
			: base(graphProperty, conditionType, ClientRuleType.requiredIf)
		{
			Init(comparePath, compareOperator, compareValue);
		}

		#endregion

		#region Properties

		/// <summary>
		/// The path to compare the compare value to.
		/// </summary>
		[DataMember(Name = "comparePath")]
		public string ComparePath
		{
			get;
			private set;
		}

		/// <summary>
		/// The value to compare to.
		/// </summary>
		public TInput CompareValue
		{
			get;
			protected set;
		}

		[DataMember(Name = "compareValue")]
		public abstract TOutput CompareValueOutput { get; protected set; }

		/// <summary>
		/// The type of comparison to perform.
		/// </summary>
		public Operator CompareOperator
		{
			get;
			protected set;
		}

		[DataMember(Name = "compareOp")]
		public string CompareOperatorText
		{
			get
			{
				if (compareOperatorText == null)
				{
					compareOperatorText = CompareOperator.ToString();
				}

				return compareOperatorText;
			}
			set
			{
				compareOperatorText = value;
			}
		}

		#endregion

		#region Methods

		protected virtual void Init(string comparePath, Operator compareOperator, TInput compareValue)
		{
			if (string.IsNullOrEmpty(comparePath))
				throw new ComparePathRequiredException();

			this.ComparePath = comparePath;
			this.CompareOperator = compareOperator;
			this.CompareValue = compareValue;
		}

		protected virtual TInput GetNull(Type type)
		{
			return default(TInput);
		}

		protected bool ShouldEnforce(GraphInstance root)
		{
			object compareValue = Evaluate(root, ComparePath);

			// Trim the value is it is a string
			if (compareValue is string)
				compareValue = ((string)compareValue).Trim();

			// If the value to compare is null, then return true if the other value is not null
			if (!HasValue(CompareValue))
				return HasValue(compareValue);

			return CompareRule.Compare(root, compareValue, CompareOperator, CompareValue, HasValue);
		}

		protected override bool ConditionApplies(GraphInstance root)
		{
			if (ShouldEnforce(root))
			{
				return base.ConditionApplies(root);
			}
			else
			{
				return false;
			}
		}

		#endregion
	}

	#endregion

	#region StructRequiredIfRule<T>

	[DataContract(Name = "requiredIf")]
	public class StructRequiredIfRule<T> : RequiredIfRule<T, T>
		where T : struct
	{
		#region Constructors

		public StructRequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath)
			: base(graphProperty, conditionType, comparePath)
		{
		}

		public StructRequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath, T compareValue)
			: base(graphProperty, conditionType, comparePath, compareValue)
		{
		}

		public StructRequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath, Operator compareOperator, T compareValue)
			: base(graphProperty, conditionType, comparePath, compareOperator, compareValue)
		{
		}

		#endregion

		#region Properties

		[DataMember(Name = "compareValue")]
		public override T CompareValueOutput
		{
			get
			{
				return CompareValue;
			}
			protected set
			{
				CompareValue = value;
			}
		}

		#endregion
	}

	#endregion

	#region ClassRequiredIfRule

	[DataContract(Name = "requiredIf")]
	public class ClassRequiredIfRule : RequiredIfRule<object, string>
	{
		#region Fields

		private string compareValueOutput;

		#endregion

		#region Constructors

		public ClassRequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath)
			: base(graphProperty, conditionType, comparePath)
		{
		}

		public ClassRequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath, object compareValue)
			: base(graphProperty, conditionType, comparePath, compareValue)
		{
		}

		public ClassRequiredIfRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath, Operator compareOperator, object compareValue)
			: base(graphProperty, conditionType, comparePath, compareOperator, compareValue)
		{
		}

		#endregion

		#region Properties

		[DataMember(Name = "compareValue")]
		public override string CompareValueOutput
		{
			get
			{
				if (compareValueOutput == null)
				{
					compareValueOutput = (this.CompareValue == null ? null : this.CompareValue.ToString());
				}

				return compareValueOutput;
			}
			protected set
			{
				compareValueOutput = value;
			}
		}

		#endregion
	}

	#endregion

	#region ComparePropertyRequiredException

	/// <summary>
	/// An exception that is thrown when the CompareProperty is not 
	/// specified for a CompareRule or RequiredIfRule.
	/// </summary>
	public sealed class ComparePathRequiredException : Exception
	{
		internal ComparePathRequiredException()
			: base("The CompareProperty for this rule is required.")
		{
		}
	}

	#endregion

	#region RangeRule

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

	#endregion

	#region StringLengthRule

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

	#endregion

	#region AllowedValuesRule

	/// <summary>
	/// Applies conditions when the value of a <see cref="GraphProperty"/> is
	/// not an allowed value.
	/// </summary>
	[DataContract(Name = "allowedValues")]
	public class AllowedValuesRule : PropertyRule
	{
		#region Constructors

		public AllowedValuesRule(GraphProperty graphProperty, ConditionType conditionType, string source, bool autoInclude)
			: base(graphProperty, conditionType, ClientRuleType.allowedValues)
		{
			this.Source = source;
			this.AutoInclude = autoInclude;
		}

		#endregion

		#region Properties

		[DataMember(Name = "source")]
		public string Source { get; private set; }

		public bool AutoInclude { get; private set; }

		#endregion

		#region Methods

		protected override bool ConditionApplies(GraphInstance root)
		{
			object value = root.Instance.GetType().GetProperty(GraphProperty.Name).GetValue(root.Instance, null);

			GraphInstanceList allowedValues = null;

			try
			{
				allowedValues = EvaluateInstanceList(root, Source);

				return !(allowedValues == null || allowedValues.Select(graphInstance => graphInstance.Instance).Contains(value));
			}
			catch
			{
				return false;
			}
		}

		#endregion
	}

	#endregion

	#region CompareRule

	[DataContract(Name = "compare")]
	public class CompareRule : PropertyRule
	{
		#region Fields

		string compareOperatorText;

		#endregion

		#region Constructors

		public CompareRule(GraphProperty graphProperty, ConditionType conditionType, string comparePath, Operator compareOperator)
			: base(graphProperty, conditionType, ClientRuleType.compare)
		{
			if (string.IsNullOrEmpty(comparePath))
				throw new ComparePathRequiredException();

			this.ComparePath = comparePath;
			this.CompareOperator = compareOperator;
		}

		#endregion

		#region Properties

		[DataMember(Name = "comparePath")]
		public string ComparePath
		{
			get;
			private set;
		}

		/// <summary>
		/// The type of comparison to perform.
		/// </summary>
		public Operator CompareOperator
		{
			get;
			private set;
		}

		[DataMember(Name = "compareOp")]
		public string CompareOperatorText
		{
			get
			{
				if (compareOperatorText == null)
				{
					compareOperatorText = CompareOperator.ToString();
				}

				return compareOperatorText;
			}
			set
			{
				compareOperatorText = value;
			}
		}

		#endregion

		#region Static Methods

		/// <summary>
		/// Gets a text description of the given comparison operator.
		/// </summary>
		/// <param name="op">The operator.</param>
		/// <returns>A description of the given comparison operator.</returns>
		public static string GetOperatorText(Operator op)
		{
			switch (op)
			{
				case Operator.Equal: return "equal to";
				case Operator.NotEqual: return "not equal to";
				case Operator.GreaterThan: return "greater than";
				case Operator.GreaterThanEqual: return "greater than or equal to";
				case Operator.LessThan: return "less than";
				case Operator.LessThanEqual: return "less than or equal to";
			}

			return "";
		}

		/// <summary>
		/// Returns a string message explaining why one or both of the given values cannot be compared.
		/// </summary>
		protected internal static string GetReasonNotComparable(object sourceValue, object compareValue)
		{
			Type sourceType = sourceValue.GetType();
			Type compareType = compareValue.GetType();

			if (!(sourceValue is IComparable) && !(compareValue is IComparable))
				return string.Format("source value of type {0} and compare value of type {1} do not implement IComparable", sourceType.Name, compareType.Name);
			else if (!(sourceValue is IComparable))
				return string.Format("source value of type {0} does not implement IComparable", sourceType.Name);
			else if (!(compareValue is IComparable))
				return string.Format("compare value of type {0} does not implement IComparable", compareType.Name);
			else
				return "unknown reason";
		}

		/// <summary>
		/// Compare the given source and compare values.
		/// </summary>
		/// <param name="sourceValue">The source value.</param>
		/// <param name="compareValue">The compare value.</param>
		/// <returns>A value indicating relative value.</returns>
		protected internal static bool CompareValues(object sourceValue, object compareValue, out int comparison, out string reasonNotCompared)
		{
			if (sourceValue is IComparable && compareValue is IComparable)
			{
				comparison = ((IComparable)sourceValue).CompareTo((IComparable)compareValue);
				reasonNotCompared = "";
				return true;
			}

			comparison = 0;
			reasonNotCompared = GetReasonNotComparable(sourceValue, compareValue);
			return false;
		}

		/// <summary>
		/// Determines whether the comparison conditions are met by the given source value and compare value.
		/// </summary>
		/// <param name="root">The root graph instance.</param>
		/// <param name="sourceValue">The source value.</param>
		/// <param name="compareOperator">The comparison operator.</param>
		/// <param name="compareValue">The compare value.</param>
		/// <param name="hasValue">A function that determines whether an object has a value.</param>
		/// <returns>True if the comparison passes, false if the comparison fails.</returns>
		protected internal static bool Compare(GraphInstance root, object sourceValue, Operator compareOperator, object compareValue, Func<object, bool> hasValue)
		{
			try
			{
				int compareResult;
				string reasonNotCompared;

				if (compareValue == null || !hasValue(compareValue) || sourceValue == null || !hasValue(sourceValue))
				{
					return false;
				}
				else if (CompareValues(sourceValue, compareValue, out compareResult, out reasonNotCompared))
				{
					switch (compareOperator)
					{
						case Operator.Equal: return compareResult == 0;
						case Operator.NotEqual: return compareResult != 0;
						case Operator.GreaterThan: return compareResult < 0;
						case Operator.GreaterThanEqual: return compareResult <= 0;
						case Operator.LessThan: return compareResult > 0;
						case Operator.LessThanEqual: return compareResult >= 0;
					}
				}
				else
				{
					throw new ApplicationException(string.Format("Values could not be compared because:  {0}.", reasonNotCompared));
				}

				return false;
			}
			catch
			{
				return false;
			}
		}

		#endregion

		#region Methods

		/// <summary>
		/// Determines whether the given value has a value.  This is used by the default 
		/// comparison to decide that the condition does not apply if there is no compare value.
		/// A null check is already performed, but a derived class may override this method in order
		/// to include other conditions such as checks for value types.
		/// </summary>
		/// <param name="value">The value to check.</param>
		/// <returns>Whether the given value is null.</returns>
		protected virtual bool HasValue(object value)
		{
			return true;
		}

		protected override bool ConditionApplies(GraphInstance root)
		{
			return Compare(root, GetValue(root, GraphProperty), CompareOperator, Evaluate(root, ComparePath), HasValue);
		}

		#endregion
	}

	#endregion

	#region Operator

	public enum Operator
	{
		LessThanEqual = 0,
		LessThan = 1,
		Equal = 2,
		NotEqual = 3,
		GreaterThanEqual = 4,
		GreaterThan = 5
	}

	#endregion
}
