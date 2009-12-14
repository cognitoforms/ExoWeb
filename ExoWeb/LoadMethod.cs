using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Runtime.Serialization;
using ExoGraph;
using System.Collections.Specialized;
using System.Web;

namespace ExoWeb
{
	/// <summary>
	/// Outputs the JSON for the specified instance to the response stream.
	/// </summary>
	[DataContract]
	internal class LoadMethod : ServiceMethod
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

		[DataMember(Name = "changes")]
		GraphTransaction Changes { get; set; }

		StringDictionary paths;
		Dictionary<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> instances;
		Dictionary<GraphType, Dictionary<GraphProperty, GraphProperty>> staticProperties;
		Dictionary<GraphType, Dictionary<GraphProperty, AllowedValuesRule>> allowedValues;

		/// <summary>
		/// Outputs the JSON for the specified instance to the response stream.
		/// </summary>
		/// <param name="response"></param>
		internal override void Invoke(HttpResponse response)
		{
			// Get the root type of instance being loaded
			GraphType rootType = GraphContext.Current.GraphTypes[Type];

			// Create an array of roots to be loaded
			GraphInstance[] roots = new GraphInstance[Ids == null ? 0 : Ids.Length];

			// Declare a variable to track changes that may occur during the load process
			GraphTransaction newChanges = null;

			// Apply changes before getting the root instances
			if (Changes != null)
				Changes.Perform(() =>
				{
					for (int i = 0; i < roots.Length; i++)
						roots[i] = Changes.GetInstance(rootType, Ids[i]);
				});

			// Otherwise, just get the root instances
			else
			{
				for (int i = 0; i < roots.Length; i++)
					roots[i] = rootType.Create(Ids[i]);
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

			// Recursively build up the list of instances to serialize
			foreach (GraphInstance root in roots)
				ProcessInstance(root, "this");

			// Start the root element
			response.Write("{\r\n");
			bool isFirstType = true;

			// Optionally serialize types
			if (IncludeTypes)
			{
				response.Write("   \"types\": {\r\n");

				foreach (GraphType instanceType in instances.Keys)
				{
					// Handle trailing commas after each rule
					if (isFirstType)
						isFirstType = false;
					else
						response.Write(",\r\n");
					GetTypeMethod.OutputType(response, instanceType);
				}
				response.Write("\r\n   },\r\n");
			}

			// Serialize the list of instances
			response.Write("   \"instances\": {\r\n");
			isFirstType = true;
			foreach (KeyValuePair<GraphType, Dictionary<GraphInstance, GraphInstanceInfo>> type in instances)
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
						if (property is GraphValueProperty && GetJsonValueType(((GraphValueProperty)property).PropertyType) == null)
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
							OutputValue(response, (GraphValueProperty)property, instance.Instance.GetValue((GraphValueProperty)property));
					}
					response.Write("\r\n         }");
				}
				response.Write("\r\n      }");
			}
			response.Write("\r\n   }");

			// Output the transaction log if changes occurred
			if (newChanges != null && newChanges.FirstOrDefault() != null)
			{
				string changesJson = ToJson(typeof(GraphTransaction), newChanges);
				response.Write(",\r\n   " + changesJson.Substring(1, changesJson.Length - 1));
			}

			response.Write("\r\n}");
		}

		/// <summary>
		/// Outputs property values as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="property"></param>
		/// <param name="value"></param>
		void OutputValue(HttpResponse response, GraphValueProperty property, object value)
		{
			response.Write(ToJson(property.PropertyType, value));
		}

		/// <summary>
		/// Outputs property references as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="instance"></param>
		void OutputReference(HttpResponse response, GraphReferenceProperty property, GraphInstance instance)
		{
			if (instance != null)
				response.Write("{ \"id\": \"" + instance.Id + "\"" + (property.PropertyType != instance.Type ? ", \"type\": \"" + instance.Type.Name +"\"" : "") + " }");
			else
				response.Write("null");
		}

		/// <summary>
		/// Outputs property list references as JSON to the response stream.
		/// </summary>
		/// <param name="response"></param>
		/// <param name="list"></param>
		void OutputList(HttpResponse response, GraphReferenceProperty property, GraphInstanceList list)
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

		/// <summary>
		/// Processes static and instance property paths in order to determine the information to serialize.
		/// </summary>
		/// <param name="path"></param>
		void ProcessPath(string path)
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
				// Split the static property reference
				string[] steps = path.Split('.');
				if (steps.Length != 2)
					throw new ArgumentException("'" + path + "' is not a valid static property path.");

				// Get the graph type
				GraphType graphType = GraphContext.Current.GraphTypes[steps[0]];
				if (graphType == null)
					throw new ArgumentException("'" + steps[0] + "' is not a valid graph type for the static property path of '" + path + "'.");

				// Get the graph property
				GraphProperty graphProperty = graphType.Properties[steps[1]];
				if (graphProperty == null || !graphProperty.IsStatic)
					throw new ArgumentException("'" + steps[1] + "' is not a valid property for the static property path of '" + path + "'.");

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
					if (reference.IsList)
					{
						foreach (GraphInstance instance in graphType.GetList(reference))
						{
							if (!typeInstances.ContainsKey(instance))
								typeInstances.Add(instance, new GraphInstanceInfo(instance));
						}
					}
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
		void ProcessInstance(GraphInstance instance, string path)
		{
			// Determine the reference properties to be processed
			List<GraphReferenceProperty> properties = new List<GraphReferenceProperty>(instance.Type.Properties
				.Where((property) => { return property is GraphReferenceProperty && paths.ContainsKey(path + "." + property.Name); })
				.Cast<GraphReferenceProperty>());

			// Preprocess allow values, as this may add to the properties being processed
			Dictionary<GraphProperty, AllowedValuesRule> allowedValuesRules = null;
			if (IncludeAllowedValues)
			{
				// Get the allowed values rules for the current instance type
				if (!allowedValues.TryGetValue(instance.Type, out allowedValuesRules))
				{
					allowedValues[instance.Type] = allowedValuesRules = new Dictionary<GraphProperty, AllowedValuesRule>();
					foreach (AllowedValuesRule rule in ServiceHandler.RuleProvider.GetRules(instance.Type).Where((rule) => { return rule is AllowedValuesRule && ((AllowedValuesRule)rule).AutoInclude; }))
						allowedValuesRules[rule.Property] = rule;
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
						ProcessInstance(childInstance, childPath);

					// Mark the list to be included during serialization
					instanceInfo.IncludeList(reference);
				}

				// Process child references
				else
				{
					GraphInstance childInstance = instance.GetReference(reference);
					if (childInstance != null)
						ProcessInstance(childInstance, childPath);
				}
			}
		}

		/// <summary>
		/// Tracks an instance being serialized and each list property that must be serialized with it.
		/// </summary>
		class GraphInstanceInfo
		{
			Dictionary<GraphReferenceProperty, GraphReferenceProperty> lists;

			internal GraphInstance Instance { get; private set; }

			internal GraphInstanceInfo(GraphInstance instance)
			{
				this.Instance = instance;
			}

			internal void IncludeList(GraphReferenceProperty list)
			{
				if (lists == null)
					lists = new Dictionary<GraphReferenceProperty, GraphReferenceProperty>();
				lists[list] = list;
			}

			internal bool HasList(GraphReferenceProperty list)
			{
				return lists != null && lists.ContainsKey(list);
			}
		}
	}
}
