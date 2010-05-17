using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Runtime.Serialization;
using System.Web;
using ExoGraph;
using System.Collections;
using ExoRule;

namespace ExoWeb
{
	#region LoadMethod

	/// <summary>
	/// Outputs the JSON for the specified instance to the response stream.
	/// </summary>
	[DataContract]
	internal class LoadMethod : InstanceMethodBase
	{
		[DataMember(Name = "type")]
		string Type { get; set; }

		[DataMember(Name = "ids")]
		string[] Ids { get; set; }

		[DataMember(Name = "paths")]
		string[] Paths { get; set; }

		[DataMember(Name = "includeAllowedValues")]
		bool IncludeAllowedValues { get; set; }

		[DataMember(Name = "includeTypes")]
		bool IncludeTypes { get; set; }
		
		[DataMember(Name = "conditionsMode")]
		bool UseConditionsMode { get; set; }

		[DataMember(Name = "includeConditionTypes")]
		bool IncludeConditionTypes { get; set; }

		[DataMember(Name = "changes")]
		GraphTransaction Changes { get; set; }

		/// <summary>
		/// Outputs the JSON for the specified instance to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			// Get the root type of instance being loaded
			GraphType rootType = (Type != null) ? GraphContext.Current.GetGraphType(Type) : null;

			// Create an array of roots to be loaded
			GraphInstance[] roots = new GraphInstance[Ids == null ? 0 : Ids.Length];

			// Declare a variable to track changes that may occur during the load process
			GraphTransaction newChanges = null;

			// Apply changes before getting the root instances
			if (Changes != null)
				newChanges = Changes.Perform(() =>
				{
					for (int i = 0; i < roots.Length; i++)
						roots[i] = Changes.GetInstance(rootType, Ids[i]);
				});

			// Otherwise, just get the root instances
			else
			{
				using (newChanges = GraphContext.Current.BeginTransaction())
				{
					for (int i = 0; i < roots.Length; i++)
						roots[i] = rootType.Create(Ids[i]);

					newChanges.Commit();
				}
			}

			// Initialize lists used to track serialization information
			this.paths = new StringDictionary();
			this.instances = new Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>>();
			this.staticProperties = new Dictionary<GraphType, Dictionary<GraphProperty, GraphProperty>>();
			this.allowedValues = new Dictionary<GraphType, Dictionary<GraphProperty, AllowedValuesRule>>();

			// Build a set of unique property paths to match during recursion
			if (Paths != null)
				foreach (string path in Paths)
					ProcessPath(path);

			GraphTransaction processChanges = null;

			using (processChanges = GraphContext.Current.BeginTransaction())
			{
				// Recursively build up the list of instances to serialize
				foreach (GraphInstance root in roots)
					ProcessInstance(root, "this", IncludeAllowedValues);

				processChanges.Commit();
			}

			newChanges += processChanges;

			// Allow service adapter to change state of instances prior to serialization
			foreach (GraphInstance instance in instances.Values.SelectMany(v => v.Keys))
				ServiceHandler.Adapter.BeforeSerializeInstance(instance);

			// Start the root element
			response.Write("{\r\n");

			// Optionally serialize types
			if (IncludeTypes)
			{
				response.Write("   \"types\": {\r\n");
				OutputTypes(response, UseConditionsMode);
				response.Write("\r\n   },\r\n");
			}

			// Serialize the list of instances			
			response.Write("   \"instances\": {\r\n");
			OutputInstances(response);
			response.Write("\r\n   }");

			if (UseConditionsMode)
			{
				response.Write(",\r\n");

				// Serialize condition types
				if (IncludeConditionTypes)
				{
					response.Write("   \"conditionTypes\": {\r\n");
					OutputConditionTypes(response);
					response.Write("\r\n   },\r\n");
				}

				// Serialize condition targets
				response.Write("   \"conditionTargets\": {\r\n");
				OutputConditionTargets(response);
				response.Write("\r\n   }");
			}


			// Output the transaction log if changes occurred
			if (newChanges != null && newChanges.FirstOrDefault() != null)
			{
				string changesJson = ToJson(typeof(GraphTransaction), newChanges);
				response.Write(",\r\n   " + changesJson.Substring(1, changesJson.Length - 2));
			}

			response.Write("\r\n}");
		}
	}

	#endregion

	#region InstanceMethodBase

	[DataContract]
	internal abstract class InstanceMethodBase : ServiceMethod
	{
		#region Fields

		protected StringDictionary paths;
		protected Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> instances;
		protected Dictionary<GraphType, Dictionary<GraphProperty, GraphProperty>> staticProperties;
		protected Dictionary<GraphType, Dictionary<GraphProperty, AllowedValuesRule>> allowedValues;

		#endregion

		#region Methods

		/// <summary>
		/// Processes static and instance property paths in order to determine the information to serialize.
		/// </summary>
		/// <param name="path"></param>
		protected void ProcessPath(string path)
		{
			// Instance Path
			if (path.StartsWith("this."))
			{
				string p = "this";
				foreach (string step in path.Substring(5).Split('.'))
				{
					p += "." + step;
					if (!paths.ContainsKey(p))
						paths.Add(p, p);
				}
			}

			// Static Path
			else
			{
				if (path.IndexOf('.') < 0)
					throw new ArgumentException("'" + path + "' is not a valid static property path.");

				// Split the static property reference
				int propertyIndex = path.LastIndexOf('.');
				string type = path.Substring(0, propertyIndex);
				string property = path.Substring(propertyIndex + 1);

				// Get the graph type
				GraphType graphType = GraphContext.Current.GetGraphType(type);
				if (graphType == null)
					throw new ArgumentException("'" + type + "' is not a valid graph type for the static property path of '" + path + "'.");

				// Get the graph property
				GraphProperty graphProperty = graphType.Properties[property];
				if (graphProperty == null || !graphProperty.IsStatic)
					throw new ArgumentException("'" + property + "' is not a valid property for the static property path of '" + path + "'.");

				// Add the property to the set of static properties to serialize
				Dictionary<GraphProperty, GraphProperty> properties;
				if (!staticProperties.TryGetValue(graphType, out properties))
					staticProperties[graphType] = properties = new Dictionary<GraphProperty, GraphProperty>();
				if (!properties.ContainsKey(graphProperty))
					properties.Add(graphProperty, graphProperty);

				// Make sure the type is registered for output
				Dictionary<GraphInstance, GraphInstanceInfo> typeInstances;
				if (!instances.TryGetValue(graphType, out typeInstances))
					instances[graphType] = typeInstances = new Dictionary<GraphInstance, GraphInstanceInfo>();

				// Register instances for static reference properties to be serialized
				GraphReferenceProperty reference = graphProperty as GraphReferenceProperty;
				if (reference != null)
				{
					// Get the cached set of instances to be serialized for the property type
					if (!instances.TryGetValue(reference.PropertyType, out typeInstances))
						instances[reference.PropertyType] = typeInstances = new Dictionary<GraphInstance, GraphInstanceInfo>();
		
					// Static lists
					if (reference.IsList)
					{
						foreach (GraphInstance instance in graphType.GetList(reference))
						{
							if (!typeInstances.ContainsKey(instance))
								typeInstances.Add(instance, new GraphInstanceInfo(instance));
						}
					}

					// Static references
					else
					{
						GraphInstance instance = graphType.GetReference(reference);
						if (instance != null && !typeInstances.ContainsKey(instance))
							typeInstances.Add(instance, new GraphInstanceInfo(instance));
					}
				}
			}
		}

		/// <summary>
		/// Recursively builds up a list of instances to serialize.
		/// </summary>
		/// <param name="instance"></param>
		/// <param name="instances"></param>
		/// <param name="paths"></param>
		/// <param name="path"></param>
		protected void ProcessInstance(GraphInstance instance, string path, bool includeAllowedValues)
		{
			// Determine the reference properties to be processed
			List<GraphReferenceProperty> properties = new List<GraphReferenceProperty>(instance.Type.Properties
				.Where((property) => { return property is GraphReferenceProperty && paths.ContainsKey(path + "." + property.Name); })
				.Cast<GraphReferenceProperty>());

			// Get value properties
			List<GraphValueProperty> valueProperties = new List<GraphValueProperty>(instance.Type.Properties
				.Where((property) => { return property is GraphValueProperty && paths.ContainsKey(path + "." + property.Name); })
				.Cast<GraphValueProperty>());

			// Preprocess allow values, as this may add to the properties being processed
			Dictionary<GraphProperty, AllowedValuesRule> allowedValuesRules = null;
			if (includeAllowedValues)
			{
				// Get the allowed values rules for the current instance type
				if (!allowedValues.TryGetValue(instance.Type, out allowedValuesRules))
				{
					allowedValues[instance.Type] = allowedValuesRules = new Dictionary<GraphProperty, AllowedValuesRule>();
					if (ServiceHandler.Adapter != null)
						foreach(var rule in ServiceHandler.Adapter.GetConditionTypes(instance.Type)
							.Where(conditionType => conditionType.ConditionRule != null && conditionType.ConditionRule is AllowedValuesRule)
							.Select(conditionType => conditionType.ConditionRule).Cast<AllowedValuesRule>()
							.Where(rule => rule.AutoInclude))
							allowedValuesRules[rule.GraphProperty] = rule;
				}

				// Process allowed values rules for each reference property
				for (int i = properties.Count - 1; i >= 0; i--)
				{
					GraphReferenceProperty reference = properties[i];
					AllowedValuesRule rule;
					if (allowedValuesRules.TryGetValue(reference, out rule))
					{
						// Instance path
						if (rule.Source.StartsWith("this."))
						{
							// Get the first property in the path
							GraphReferenceProperty allowedValuesProperty = instance.Type.Properties[rule.Source.Substring(5).Split('.')[0]] as GraphReferenceProperty;

							// Process the property path
							ProcessPath(path + "." + rule.Source.Substring(5));

							// Ensure the property is processed
							if (!properties.Contains(allowedValuesProperty))
								properties.Add(allowedValuesProperty);
						}

						// Static path
						else
							ProcessPath(rule.Source);
					}
				}
			}

			// Fetch or initialize the dictionary of instances for the type of the current instance
			Dictionary<GraphInstance, GraphInstanceInfo> typeInstances;
			if (!instances.TryGetValue(instance.Type, out typeInstances))
				instances[instance.Type] = typeInstances = new Dictionary<GraphInstance, GraphInstanceInfo>();

			// Add the current instance to the dictionary if it is not already there
			GraphInstanceInfo instanceInfo;
			if (!typeInstances.TryGetValue(instance, out instanceInfo))
				typeInstances[instance] = instanceInfo = new GraphInstanceInfo(instance);

			// Process all reference property paths on the current instance
			foreach (GraphReferenceProperty reference in properties)
			{
				// Get the full path to the property
				string childPath = path + "." + reference.Name;

				// Throw an exception if a static property is referenced
				if (reference.IsStatic)
					throw new ArgumentException("Static properties cannot be referenced by instance property paths.  Specify 'TypeName.PropertyName' as the path to load static properties for a type.");

				// Process all items in a child list and register the list to be serialized
				if (reference.IsList)
				{
					// Process each child instance
					foreach (GraphInstance childInstance in instance.GetList(reference))
						ProcessInstance(childInstance, childPath, includeAllowedValues);

					// Mark the list to be included during serialization
					instanceInfo.IncludeList(reference);
				}

				// Process child references
				else
				{
					GraphInstance childInstance = instance.GetReference(reference);
					if (childInstance != null)
						ProcessInstance(childInstance, childPath, includeAllowedValues);
				}
			}

			// Process Value property paths
			foreach (GraphValueProperty value in valueProperties)
			{
				bool isList = typeof(ICollection).IsAssignableFrom(value.PropertyType);

				// If this is a list, register for loading
				if (isList)
					instanceInfo.IncludeList(value);
			}
		}

		/// <summary>
		/// Output type information as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		protected void OutputTypes(HttpResponse response, bool useConditionsMode)
		{
			bool isFirstType = true;

			foreach (GraphType instanceType in instances.Keys)
			{
				// Handle trailing commas after each rule
				if (isFirstType)
					isFirstType = false;
				else
					response.Write(",\r\n");
				GetTypeMethod.OutputType(response, instanceType, useConditionsMode);
			}
		}

		/// <summary>
		/// Output instances as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		protected void OutputInstances(HttpResponse response)
		{
			bool isFirstType = true;

			// Create a new dictionary that collapses synonymous Graph Types
			Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> collapsedInstances = new Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>>();
			foreach (KeyValuePair<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> type in instances)
			{
				GraphType synonymousType = null;
				foreach (KeyValuePair<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> existingType in collapsedInstances)
					if (type.Key.QualifiedName == existingType.Key.QualifiedName)
						synonymousType = existingType.Key;

				Dictionary<GraphInstance, GraphInstanceInfo> srcInstances = (synonymousType != null) ?
					srcInstances = collapsedInstances[synonymousType] :
					srcInstances = collapsedInstances[type.Key] = new Dictionary<GraphInstance, GraphInstanceInfo>();

				foreach (KeyValuePair<GraphInstance, GraphInstanceInfo> inst in type.Value)
					if (!srcInstances.ContainsKey(inst.Key))
						srcInstances.Add(inst.Key, inst.Value);
			}

			foreach (KeyValuePair<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> type in collapsedInstances)
			{
				// Get the current graph type
				GraphType graphType = type.Key;

				// Handle trailing commas after each type
				if (isFirstType)
					isFirstType = false;
				else
					response.Write(",\r\n");

				response.Write("      \"" + graphType.Name + "\": {\r\n");
				bool isFirstInstance = true;

				// Output static properties
				Dictionary<GraphProperty, GraphProperty> properties;
				if (staticProperties.TryGetValue(graphType, out properties))
				{
					isFirstInstance = false;
					response.Write("         \"static\": {\r\n");
					bool isFirstProperty = true;
					foreach (GraphProperty property in properties.Values)
					{
						// Handle trailing commas after each property
						if (isFirstProperty)
							isFirstProperty = false;
						else
							response.Write(",\r\n");

						// Output the property
						response.Write("            \"" + property.Name + "\": ");
						GraphReferenceProperty reference = property as GraphReferenceProperty;

						// Serialize values
						if (reference == null)
							OutputValue(response, (GraphValueProperty)property, graphType.GetValue((GraphValueProperty)property));

						// Serialize lists
						else if (reference.IsList)
							OutputList(response, reference, graphType.GetList(reference));

						// Serialize references
						else
							OutputReference(response, reference, graphType.GetReference(reference));
					}
					response.Write("\r\n      }");
				}

				// Serialize instances
				foreach (GraphInstanceInfo instance in type.Value.Values)
				{
					// Handle trailing commas after each instance
					if (isFirstInstance)
						isFirstInstance = false;
					else
						response.Write(",\r\n");

					// Serialize the current instance
					response.Write("         \"" + instance.Instance.Id + "\" : {\r\n");
					bool isFirstProperty = true;
					foreach (GraphProperty property in graphType.Properties)
					{
						// Skip properties that cannot be serialized
						if (property is GraphValueProperty && GetJsonValueType(((GraphValueProperty) property).PropertyType) == null)
							continue;

						// Skip static properties, as these must be explicitly serialized
						if (property.IsStatic)
							continue;

						// Handle trailing commas after each property
						if (isFirstProperty)
							isFirstProperty = false;
						else
							response.Write(",\r\n");

						// Write out the property name and value
						response.Write("            \"" + property.Name + "\": ");
						GraphReferenceProperty reference = property as GraphReferenceProperty;
						if (reference != null)
						{
							// Serialize lists
							if (reference.IsList)
							{
								if (instance.HasList(reference))
									OutputList(response, reference, instance.Instance.GetList(reference));
								else
									response.Write("\"deferred\"");
							}

							// Serialize references
							else
								OutputReference(response, reference, instance.Instance.GetReference(reference));
						}

						// Serialize values
						else
						{
							var actualProperty = instance.Instance.GetValue((GraphValueProperty) property);
							bool isList = typeof(ICollection).IsAssignableFrom(((GraphValueProperty) property).PropertyType);

							if (isList)
							{
								if (instance.HasList(property))
									OutputValue(response, (GraphValueProperty) property, actualProperty);
								else
									response.Write("\"deferred\"");
							}
							else
								OutputValue(response, (GraphValueProperty) property, actualProperty);
						}
					}
					response.Write("\r\n         }");
				}
				response.Write("\r\n      }");
			}
		}

		/// <summary>
		/// Output condition information as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		protected void OutputConditionTypes(HttpResponse response)
		{
			bool isFirstType = true;
			foreach (ConditionType conditionType in instances.Keys
				.SelectMany(graphType => ServiceHandler.Adapter.GetConditionTypes(graphType))
				.Where(conditionType => conditionType.ConditionRule == null || conditionType.ConditionRule is PropertyRule)
				.Distinct())
			{
				// Handle trailing commas after each instance
				if (isFirstType)
					isFirstType = false;
				else
					response.Write(",\r\n");

				GetTypeMethod.OutputConditionType(response, conditionType);
			}
		}

		/// <summary>
		/// Output condition information as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		protected void OutputConditionTargets(HttpResponse response)
		{
			// populate condition targets by condition type
			Dictionary<ConditionType, List<ConditionTarget>> targetsByType = new Dictionary<ConditionType, List<ConditionTarget>>();			
			foreach (var target in instances.Values.SelectMany(d => d.Keys)
				.SelectMany(instance => Condition.GetConditions(instance))
				.SelectMany(condition => condition.Targets))
			{
				if (!targetsByType.ContainsKey(target.Condition.Type))
					targetsByType.Add(target.Condition.Type, new List<ConditionTarget>());

				if (!targetsByType[target.Condition.Type].Contains(target))
					targetsByType[target.Condition.Type].Add(target);
			}

			bool isFirstType = true;
			foreach (ConditionType conditionType in targetsByType.Keys)
			{
				List<ConditionTarget> targets = targetsByType[conditionType];

				if (targets.Count == 0)
					continue;

				// Handle trailing commas after each type
				if (isFirstType)
					isFirstType = false;
				else
					response.Write(",\r\n");

				response.Write("      \"" + conditionType.Code + "\": {");
				response.Write("\r\n         \"targets\": [");

				// Handle condition targets
				bool isFirstTarget = true;
				foreach (ConditionTarget conditionTarget in targets)
				{
					// Handle trailing commas after each target
					if (isFirstTarget)
						isFirstTarget = false;
					else
						response.Write(",\r\n");

					response.Write("{ \"instance\": {\"id\": \"" + conditionTarget.Target.Id + "\"" + ", \"type\": \"" + conditionTarget.Target.Type.Name + "\"}, \"properties\": [" + string.Join(",", conditionTarget.Properties.Select(p => "\"" + p + "\"").ToArray()) + "] }");
				}

				response.Write("]\r\n      }");
			}
		}

		/// <summary>
		/// Outputs property values as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="property"></param>
		/// <param name="value"></param>
		protected void OutputValue(HttpResponse response, GraphValueProperty property, object value)
		{
			response.Write(ToJson(property.PropertyType, value));
		}

		/// <summary>
		/// Outputs property references as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="instance"></param>
		protected void OutputReference(HttpResponse response, GraphReferenceProperty property, GraphInstance instance)
		{
			if (instance != null)
				response.Write("{ \"id\": \"" + instance.Id + "\"" + (property.PropertyType != instance.Type ? ", \"type\": \"" + GetJsonReferenceType(instance.Type) + "\"" : "") + " }");
			else
				response.Write("null");
		}

		/// <summary>
		/// Outputs property list references as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="list"></param>
		protected void OutputList(HttpResponse response, GraphReferenceProperty property, GraphInstanceList list)
		{
			response.Write("[ ");
			bool isFirstItem = true;
			foreach (GraphInstance child in list)
			{
				if (isFirstItem)
					isFirstItem = false;
				else
					response.Write(", ");

				OutputReference(response, property, child);
			}
			response.Write(" ]");
		}

		#endregion
	}

	#endregion

	#region GraphInstanceInfo

	/// <summary>
	/// Tracks an instance being serialized and each list property that must be serialized with it.
	/// </summary>
	internal class GraphInstanceInfo
	{
		Dictionary<GraphProperty, GraphProperty> lists;

		internal GraphInstance Instance { get; private set; }

		internal GraphInstanceInfo(GraphInstance instance)
		{
			this.Instance = instance;
		}

		internal void IncludeList(GraphProperty list)
		{
			if (lists == null)
				lists = new Dictionary<GraphProperty, GraphProperty>();
			lists[list] = list;
		}

		internal bool HasList(GraphProperty list)
		{
			return lists != null && lists.ContainsKey(list);
		}
	}

	#endregion
}
