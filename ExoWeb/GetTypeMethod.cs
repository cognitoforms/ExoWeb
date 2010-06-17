using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using ExoGraph;
using System.Web;
using ExoRule;

namespace ExoWeb
{
	/// <summary>
	/// Outputs schema information for the specified type to the response stream.
	/// </summary>
	[DataContract]
	internal class GetTypeMethod : ServiceMethod
	{
		[DataMember(Name = "type")]
		string Type { get; set; }
		
		[DataMember(Name = "conditionsMode")]
		bool UseConditionsMode { get; set; }
		
		/// <summary>
		/// Outputs schema information for the specified type to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			// Enable caching
			response.Cache.SetCacheability(HttpCacheability.Public);
			response.Cache.SetExpires(DateTime.Now.AddDays(7));

			GraphType graphType = GraphContext.Current.GetGraphType(Type);

			// Output the requested graph type
			response.Write("{\r\n   \"types\":\r\n   {\r\n");
			OutputType(response, graphType, UseConditionsMode);

			if (UseConditionsMode)
			{
				// Serialize condition types
				response.Write("\r\n   },\r\n");
				response.Write("   \"conditionTypes\": {\r\n");
				OutputConditionTypes(response, graphType);
			}
			
			response.Write("\r\n   }\r\n}");
		}

		private void OutputConditionTypes(HttpResponse response, GraphType type)
		{
			bool isFirstType = true;
			foreach (ConditionType conditionType in ServiceHandler.Adapter.GetConditionTypes(type))
			{
				// Handle trailing commas after each instance
				if (isFirstType)
					isFirstType = false;
				else
					response.Write(",\r\n");

				GetTypeMethod.OutputConditionType(response, conditionType);
			}
		}

		internal static void OutputConditionType(HttpResponse response, ConditionType conditionType)
		{
			List<Type> knownTypes = new List<Type>();

			knownTypes.Add(conditionType.GetType());
			if (conditionType.ConditionRule != null)
				knownTypes.Add(conditionType.ConditionRule.GetType());

			response.Write("      \"" + conditionType.Code + "\": " +
					ToJson(typeof(ConditionType), conditionType, knownTypes)
			);
		}

		internal static void OutputType(HttpResponse response, GraphType type, bool useConditionsMode)
		{
			// Output the type meta data
			response.Write("      \"" + type.Name + "\": {");
			if (type.BaseType != null)
				response.Write("\r\n         \"baseType\": \"" + GetJsonReferenceType(type.BaseType) + "\",");


			Dictionary<string, IGrouping<string, Rule>> rules = null;
			if (!useConditionsMode)
			{
				// Get the rules defined for this type
				rules = ServiceHandler.Adapter == null ? null :
					ServiceHandler.Adapter.GetConditionTypes(type)
					.Where(x => x.ConditionRule != null && x.ConditionRule is Rule)
					.Select(x => x.ConditionRule).Cast<Rule>()
					.GroupBy<Rule, string>((rule) => { return rule is PropertyRule ? ((PropertyRule)rule).GraphProperty.Name : ""; })
					.ToDictionary<IGrouping<string, Rule>, string>((group) => { return group.Key; });

				// Output type rules
				IGrouping<string, Rule> typeRules;
				if (rules != null && rules.TryGetValue("", out typeRules))
					OutputRules(response, typeRules);
			}

			response.Write("\r\n         \"properties\": {\r\n");
			bool isFirstProperty = true;
			foreach (GraphProperty property in type.Properties)
			{
				// Skip properties on base types or properties that cannot be serialized
				if (property.DeclaringType != type || !ServiceHandler.Adapter.InClientModel(property))
					continue;

				// Handle trailing commas after each property
				if (isFirstProperty)
					isFirstProperty = false;
				else
					response.Write(",\r\n");

				// Output the property schema
				if (property is GraphValueProperty)
					response.Write("            \"" + property.Name + "\": { \"type\": \"" + GetJsonValueType(((GraphValueProperty) property).PropertyType) + "\"" + (property.IsList ? ", \"isList\": true" : ""));
				else
					response.Write("            \"" + property.Name + "\": { \"type\": \"" + GetJsonReferenceType(((GraphReferenceProperty)property).PropertyType) + "\"" + (property.IsList ? ", \"isList\": true" : ""));

				// Indicate if the property is shared
				if (property.IsStatic)
					response.Write(", \"isStatic\": true");

				// Output format name if applicable
				string formatName = ServiceHandler.Adapter.GetFormatName(property);
				if (!string.IsNullOrEmpty(formatName))
					response.Write(", \"format\": \"" + formatName + "\"");

				string label = ServiceHandler.Adapter.GetLabel(property);
				if (!string.IsNullOrEmpty(label))
					response.Write(", \"label\": \"" + label + "\"");

				if (!useConditionsMode)
				{
					// Output property rules
					IGrouping<string, Rule> propertyRules;
					if (rules != null && rules.TryGetValue(property.Name, out propertyRules))
						OutputRules(response, propertyRules);
				}

				// Close the property
				response.Write(" }");
			}
			response.Write("\r\n         }\r\n      }");
		}

		/// <summary>
		/// Outputs an array of <see cref="Rule"/> instances to the JSON response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="rules"></param>
		static void OutputRules(HttpResponse response, IEnumerable<Rule> rules)
		{
			bool isFirstRule = true;
			response.Write(", \"rules\": [");

			foreach (Rule rule in rules)
			{
				// Handle trailing commas after each rule
				if (isFirstRule)
					isFirstRule = false;
				else
					response.Write(", ");

				DataContractAttribute contractAttribute = rule.GetType().GetCustomAttributes(typeof(DataContractAttribute), false).Cast<DataContractAttribute>().FirstOrDefault<DataContractAttribute>();
				string ruleName = contractAttribute == null ? rule.GetType().Name : contractAttribute.Name;
				response.Write("{ \"" + ruleName + "\": " + ToJson(rule.GetType(), rule) + " }");
			}
			response.Write("]");
		}
	}
}
