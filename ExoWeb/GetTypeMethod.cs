using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using ExoGraph;
using System.Web;

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
		
		/// <summary>
		/// Outputs schema information for the specified type to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			// Enable caching
			response.Cache.SetCacheability(HttpCacheability.Public);
			response.Cache.SetExpires(DateTime.Now.AddDays(7));

			// Output the requested graph type
			response.Write("{\r\n   \"types\":\r\n   {\r\n");
			OutputType(response, GraphContext.Current.GetGraphType(Type));
			response.Write("\r\n   }\r\n}");
		}

		internal static void OutputType(HttpResponse response, GraphType type)
		{
			// Get the rules defined for this type
			Dictionary<string, IGrouping<string, Rule>> rules = ServiceHandler.RuleProvider.GetRules(type)
				.GroupBy<Rule, string>((rule) => { return rule is PropertyRule ? ((PropertyRule)rule).Property.Name : ""; })
				.ToDictionary<IGrouping<string, Rule>, string>((group) => { return group.Key; });

			// Output the type meta data
			response.Write("      \"" + type.Name + "\": {");
			if (type.BaseType != null)
				response.Write("\r\n         \"baseType\": \"" + type.BaseType.Name + "\",");

			// Output type rules
			IGrouping<string, Rule> typeRules;
			if (rules.TryGetValue("", out typeRules))
				OutputRules(response, typeRules);

			response.Write("\r\n         \"properties\": {\r\n");
			bool isFirstProperty = true;
			foreach (GraphProperty property in type.Properties)
			{
				// Skip properties on base types or properties that cannot be serialized
				if (property.DeclaringType != type || (property is GraphValueProperty && GetJsonValueType(((GraphValueProperty)property).PropertyType) == null))
					continue;

				// Handle trailing commas after each property
				if (isFirstProperty)
					isFirstProperty = false;
				else
					response.Write(",\r\n");

				// Output the property schema
				if (property is GraphValueProperty)
					response.Write("            \"" + property.Name + "\": { \"type\": \"" + GetJsonValueType(((GraphValueProperty)property).PropertyType) + "\"");
				else
					response.Write("            \"" + property.Name + "\": { \"type\": \"" + ((GraphReferenceProperty)property).PropertyType.Name + "\"" + (((GraphReferenceProperty)property).IsList ? ", \"isList\": true" : ""));

				// Indicate if the property is shared
				if (property.IsStatic)
					response.Write(", \"isStatic\": true");

				// Output property rules
				IGrouping<string, Rule> propertyRules;
				if (rules.TryGetValue(property.Name, out propertyRules))
					OutputRules(response, propertyRules);

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
