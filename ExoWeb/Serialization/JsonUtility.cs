using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using System.Reflection;
using ExoModel;
using ExoRule;
using System.IO;
using ExoRule.Validation;

namespace ExoWeb.Serialization
{
	public class JsonUtility
	{
		static JsonSerializer serializer;
		static HashSet<Type> serializableTypes;
		static MethodInfo deserialize;

		/// <summary>
		/// Manually registers a type to be included in list of allowable serializable type.  Use this method to use default serialization
		/// </summary>
		/// <param name="type"></param>
		public static void RegisterSerializableValueType(Type type)
		{
			serializableTypes.Add(type);
		}

		public static void RegisterConverter(JsonConverter converter)
		{
			converter.Converters = serializer.Converters;
			serializer.Converters.Add(converter);
			serializableTypes.Add(converter.Type);
		}

		/// <summary>
		/// Indicates whether the specified type can be serialized.
		/// </summary>
		/// <param name="type"></param>
		/// <returns></returns>
		internal static bool IsSerializable(Type type)
		{
			return serializableTypes.Contains(type);
		}

		public class UtcDateTimeConverter : Newtonsoft.Json.JsonConverter
		{
			public override bool CanConvert(Type objectType)
			{
				return objectType == typeof(DateTime);
			}

			public override object ReadJson(Newtonsoft.Json.JsonReader reader, Type objectType, object value, JsonSerializer serializer)
			{
				switch (reader.TokenType)
				{
					case JsonToken.Null:
						return value;
					case JsonToken.String:
						var dateString = ((string)reader.Value);
						return string.IsNullOrEmpty(dateString) ? value : DateTime.Parse(dateString);
					default:
						throw new ArgumentException("Invalid token type");
				}
			}

			public override void WriteJson(Newtonsoft.Json.JsonWriter writer, object value, JsonSerializer serializer)
			{
				if (DateTime.MinValue.Equals(value))
					writer.WriteNull();
				else
				{
					DateTime date = (DateTime)value;
					writer.WriteValue(date.ToUniversalTime().ToString(@"yyyy-MM-dd\THH:mm:ss.fff\Z"));
				}
			}
		}

		static JsonUtility()
		{
			serializer = new JsonSerializer();
			serializableTypes = new HashSet<Type>();

			serializer.DateParseHandling = DateParseHandling.None;
			serializer.Converters.Add(new UtcDateTimeConverter());

			// Register converters for types implementing IJsonSerializable or that have DataContract attributes
			// Include all types in ExoWeb and ExoRule automatically
			foreach (var converter in JsonConverter.Infer(
				typeof(ServiceHandler).Assembly.GetTypes().Union(
				typeof(Rule).Assembly.GetTypes().Where(type => typeof(Rule).IsAssignableFrom(type)))))
				RegisterConverter(converter);

			// Deserialize Value Change Event
			Func<JsonReader, ModelValueChangeEvent> deserializeValueChangeEvent = (reader) =>
			{
				string p;
				ModelInstance instance = null;
				ModelValueProperty property = null;
				object oldValue = null;
				object newValue = null;
				while (reader.ReadProperty(out p))
				{
					switch (p)
					{
						case "instance":
							instance = reader.ReadValue<ModelInstance>();
							break;
						case "property":
							property = (ModelValueProperty)instance.Type.Properties[reader.ReadValue<string>()];
							break;
						case "oldValue":
							oldValue = reader.ReadValue(property.PropertyType);
							break;
						case "newValue":
							newValue = reader.ReadValue(property.PropertyType);
							break;
						default:
							throw new ArgumentException("The specified property could not be deserialized.", p);
					}
				}
				return new ModelValueChangeEvent(instance, property, oldValue, newValue);
			};

			// Deserialize Reference Change Event
			Func<JsonReader, ModelReferenceChangeEvent> deserializeReferenceChangeEvent = (reader) =>
			{
				string p;
				ModelInstance instance = null;
				ModelReferenceProperty property = null;
				ModelInstance oldValue = null;
				ModelInstance newValue = null;
				while (reader.ReadProperty(out p))
				{
					switch (p)
					{
						case "instance":
							instance = reader.ReadValue<ModelInstance>();
							break;
						case "property":
							property = (ModelReferenceProperty)instance.Type.Properties[reader.ReadValue<string>()];
							break;
						case "oldValue":
							oldValue = reader.ReadValue<ModelInstance>();
							break;
						case "newValue":
							newValue = reader.ReadValue<ModelInstance>();
							break;
						default:
							throw new ArgumentException("The specified property could not be deserialized.", p);
					}
				}
				return new ModelReferenceChangeEvent(instance, property, oldValue, newValue);
			};

			// Deserialize List Change Event
			Func<JsonReader, ModelListChangeEvent> deserializeListChangeEvent = (reader) =>
			{
				string p;
				ModelInstance instance = null;
				ModelReferenceProperty property = null;
				ModelInstance[] added = null;
				ModelInstance[] removed = null;
				while (reader.ReadProperty(out p))
				{
					switch (p)
					{
						case "instance":
							instance = reader.ReadValue<ModelInstance>();
							break;
						case "property":
							property = (ModelReferenceProperty)instance.Type.Properties[reader.ReadValue<string>()];
							break;
						case "added":
							added = reader.ReadValue<ModelInstance[]>();
							break;
						case "removed":
							removed = reader.ReadValue<ModelInstance[]>();
							break;
						default:
							throw new ArgumentException("The specified property could not be deserialized.", p);
					}
				}
				return new ModelListChangeEvent(instance, property, added, removed);
			};

			// Deserialize Init New Event
			Func<JsonReader, ModelInitEvent.InitNew> deserializeInitNewEvent = (reader) => 
			{
				string p;
				ModelInstance instance = null;
				while (reader.ReadProperty(out p))
				{
					switch (p)
					{
						case "instance":
							instance = reader.ReadValue<ModelInstance>();
							break;
						default:
							throw new ArgumentException("The specified property could not be deserialized.", p);
					}
				}
				return new ModelInitEvent.InitNew(instance);
			};

			// Deserialize Init Existing Event
			Func<JsonReader, ModelInitEvent.InitExisting> deserializeInitExistingEvent = (reader) => 
			{
				string p;
				ModelInstance instance = null;
				while (reader.ReadProperty(out p))
				{
					switch (p)
					{
						case "instance":
							instance = reader.ReadValue<ModelInstance>();
							break;
						default:
							throw new ArgumentException("The specified property could not be deserialized.", p);
					}
				}
				return new ModelInitEvent.InitExisting(instance);
			};

			// Deserialize Delete Event
			Func<JsonReader, ModelDeleteEvent> deserializeDeleteEvent = (reader) => 
			{
				string p;
				ModelInstance instance = null;
				bool isPendingDelete = false;
				while (reader.ReadProperty(out p))
				{
					switch (p)
					{
						case "instance":
							instance = reader.ReadValue<ModelInstance>();
							break;
						case "isPendingDelete":
							isPendingDelete = reader.ReadValue<bool>();
							break;
						default:
							throw new ArgumentException("The specified property could not be deserialized.", p);
					}
				}
				return new ModelDeleteEvent(instance, isPendingDelete);
			};

			// Construct Model Instance
			var createModelInstance = typeof(ModelInstance).GetConstructor(
				BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance,
				null,
				new Type[] { typeof(ModelType), typeof(string) },
				null);

			// Register custom converters for ModelType, ModelProperty, ModelMethod, ModelInstance, ModelEvent
			foreach (var converter in 
				new JsonConverter[] 
			{
				// Model Type
				new JsonConverter<ModelType>(
					(modelType, json) =>
					{
						// Base Type
						if (modelType.BaseType != null)
							json.Set("baseType", JsonConverter.GetJsonReferenceType(modelType.BaseType));

						// Base Type
						if (!String.IsNullOrEmpty(modelType.Format))
							json.Set("format", modelType.Format);

						// Properties
						json.Set("properties", modelType.Properties
							.Where(property => property.DeclaringType == modelType && ExoWeb.IncludeInClientModel(property))
							.ToDictionary(property => property.Name));

						// Methods
						json.Set("methods", modelType.Methods.ToDictionary(method => method.Name));

						// Rules
						var rules = Rule.GetRegisteredRules(modelType).ToList();
						var typeRules = rules.Where(rule => (rule.ExecutionLocation & RuleExecutionLocation.Client) > 0 && !(rule is IPropertyRule)).ToArray();
						if (typeRules.Any())
							json.Set("rules", typeRules);

						// Condition Types
						var serverConditionTypes = rules
							.Where(rule => (rule.ExecutionLocation & RuleExecutionLocation.Client) == 0) 
							.SelectMany(rule => rule.ConditionTypes)
							.ToArray();
						if (serverConditionTypes.Any())
							json.Set("conditionTypes", serverConditionTypes);	

						// Exports
						json.Set("exports", json.Global<Dictionary<string, string>>("exports"));
					}, 
					json => { throw new NotSupportedException("ModelType cannot be deserialized."); }),

				// Model Property
				new JsonConverter<ModelProperty>(
					(property, json) =>
					{
						// Type
						string type = (property is ModelValueProperty ?
							JsonConverter.GetJsonValueType(((ModelValueProperty)property).PropertyType) ?? "Object" :
							JsonConverter.GetJsonReferenceType(((ModelReferenceProperty)property).PropertyType)) +
							(property.IsList ? "[]" : "");
						json.Set("type", type);

						// IsStatic
						if (property.IsStatic)
							json.Set("isStatic", true);

						// IsPersisted
						if (!property.IsPersisted && !property.IsStatic)
							json.Set("isPersisted", false);

						// IsCalculated
						if (ExoWeb.IsCalculated(property))
							json.Set("isCalculated", true);

						// Index
						int index = 0;
						foreach (ModelProperty p in property.DeclaringType.Properties)
						{
							if (p == property)
								break;
							if (ExoWeb.IncludeInClientModel(p) && !p.IsStatic)
								index++;
						}
						if (!property.IsStatic)
							json.Set("index", index);

						// Format
						string format = property.Format;
						if (!string.IsNullOrEmpty(format))
							json.Set("format", format);

						// Label
						string label = property.Label;
						if (!string.IsNullOrEmpty(label))
							json.Set("label", label);

						// Rules
						var rules = Rule
							.GetRegisteredRules(property.DeclaringType)
							.Where(rule => (rule.ExecutionLocation & RuleExecutionLocation.Client) > 0 && rule is IPropertyRule && rule.RootType.Properties[((IPropertyRule)rule).Property] == property)
							.ToDictionary(rule => 
								rule is ICalculationRule ? "calculated" :
								String.Format("{0}.{1}.{2}", rule.RootType.Name, ((IPropertyRule)rule).Property, ((IPropertyRule)rule).Name) == rule.Name ? 
								((IPropertyRule)rule).Name.Substring(0, 1).ToLower() + ((IPropertyRule)rule).Name.Substring(1) : 
								rule.Name);
						if (rules.Any())
							json.Set("rules", rules);
					}, 
					json => { throw new NotSupportedException("ModelProperty cannot be deserialized."); }),

					// Model Method
					new JsonConverter<ModelMethod>(
						(method, json) =>
						{
							// Parameters
							json.Set("parameters", method.Parameters.Select(p => p.Name));

							// IsStatic
							json.Set("isStatic", method.IsStatic);
						},
						json => { throw new NotSupportedException("ModelMethod cannot be deserialized."); }),

					// Model Instance
					new JsonConverter<ModelInstance>(
						(instance, json) =>
						{
							json.Set("id", instance.Id);
							json.Set("type", instance.Type.Name);
						},
						reader => 
						{
							string p;
							ModelType type = null;
							string id = null;
							while (reader.ReadProperty(out p))
							{
								switch (p)
								{
									case "type":
										type = ModelContext.Current.GetModelType(reader.ReadValue<string>());
										break;
									case "id":
										id = reader.ReadValue<string>();
										break;
									// Ignore
									case "isNew":
										reader.ReadValue<bool>();
										break;
									default:
										throw new ArgumentException("The specified property could not be deserialized.", p);
								}
							}
							return (ModelInstance)createModelInstance.Invoke(new object[] { type, id });
						}),

					// Model Event
					new JsonConverter<ModelEvent>(
						(modelEvent, json) => { throw new NotSupportedException("ModelEvent cannot be deserialized."); },
						(reader) =>
						{
							string p;
							if (reader.ReadProperty(out p) && p == "type")
							{
								string eventName = reader.ReadValue<string>();
								switch (eventName)
								{
									case "ValueChange" : return deserializeValueChangeEvent(reader);
									case "ReferenceChange" : return deserializeReferenceChangeEvent(reader);
									case "ListChange" : return deserializeListChangeEvent(reader);
									case "InitNew" : return deserializeInitNewEvent(reader);
									case "InitExisting" : return deserializeInitExistingEvent(reader);
									case "Delete" : return deserializeDeleteEvent(reader);
								}
								throw new NotSupportedException(eventName + " event cannot be deserialized.");
							}
							else
								throw new FormatException("The type parameter 'type' must be the first serialized value in model event json.");
						}),

					// Model Value Change Event
					new JsonConverter<ModelValueChangeEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "ValueChange");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("property", modelEvent.Property.Name);
							json.Set("oldValue", modelEvent.OldValue);
							json.Set("newValue", modelEvent.NewValue);
						},
						deserializeValueChangeEvent),
							
					// Model Reference Change Event
					new JsonConverter<ModelReferenceChangeEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "ReferenceChange");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("property", modelEvent.Property.Name);
							json.Set("oldValue", GetEventInstance(modelEvent.OldValue, modelEvent.OldValueId));
							json.Set("newValue", GetEventInstance(modelEvent.NewValue, modelEvent.NewValueId));
						},
						deserializeReferenceChangeEvent),
							
					// Model List Change Event
					new JsonConverter<ModelListChangeEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "ListChange");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("property", modelEvent.Property.Name);
							json.Set("added", modelEvent.Added.Select((instance, index) => GetEventInstance(instance, modelEvent.AddedIds.ElementAt(index))));
							json.Set("removed", modelEvent.Removed.Select((instance, index) => GetEventInstance(instance, modelEvent.RemovedIds.ElementAt(index))));
						},
						deserializeListChangeEvent),
							
					// Model Init New Event
					new JsonConverter<ModelInitEvent.InitNew>(
						(modelEvent, json) =>
						{
							json.Set("type", "InitNew");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
						},
						deserializeInitNewEvent),
							
					// Model Init Existing Event
					new JsonConverter<ModelInitEvent.InitExisting>(
						(modelEvent, json) =>
						{
							json.Set("type", "InitExisting");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
						},
						deserializeInitExistingEvent),
							
					// Model Delete Event
					new JsonConverter<ModelDeleteEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "Delete");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("isPendingDelete", modelEvent.IsPendingDelete);
						},
						deserializeDeleteEvent),
														
					// Model Save Event
					new JsonConverter<ModelSaveEvent>(
						(modelEvent, json) =>
						{
							json.Set("type", "Save");
							json.Set("instance", GetEventInstance(modelEvent.Instance, modelEvent.InstanceId));
							json.Set("added", modelEvent.Added.Select(instance => new Dictionary<string, string>() 
								{ { "type", instance.Type.Name }, { "oldId", instance.OriginalId }, { "newId", instance.Id } }));
							json.Set("modified", modelEvent.Modified);
							json.Set("deleted", modelEvent.Deleted);
						},
						json => { throw new NotSupportedException("ModelSaveEvent cannot be deserialized."); }),

					// Condition Type
					new JsonConverter<ConditionType>(
						(conditionType, json) =>
						{
							json.Set("code", conditionType.Code);
							json.Set("category", conditionType.Category.ToString());

							if (conditionType.Sets != null && conditionType.Sets.Any())
								json.Set("sets", conditionType.Sets.Select(set => set.Name));

							json.Set("message", conditionType.Message);
						},
						json => { throw new NotSupportedException("ConditionType cannot be deserialized."); }),

					// Condition
					new JsonConverter<Condition>(
						(condition, json) =>
						{
							if (condition.Message != condition.Type.Message)
								json.Set("message", condition.Message);
							json.Set("targets", condition.Targets.Where(ct => ct.Target != null));
						},
						json => { throw new NotSupportedException("Condition cannot be deserialized."); }),

					// Condition Target
					new JsonConverter<ConditionTarget>(
						(conditionTarget, json) =>
						{
							json.Set("instance", conditionTarget.Target);
							json.Set("properties", conditionTarget.Properties);
						},
						json => { throw new NotSupportedException("ConditionTarget cannot be deserialized."); }),

					// Rule
					new JsonConverter<Rule>(
					    (rule, json) =>
					    {
							if (rule is ICalculationRule)
							{
								var calculation = (ICalculationRule)rule;
								json.Set("onChangeOf", calculation.Predicates);

								// Translate the calculate expression to javascript
								var exp = ExoWeb.ExpressionTranslator.Translate(calculation.Calculation);
								if (exp.Exceptions.Any())
									throw exp.Exceptions.Last();
								json.Set("calculate", exp.Body);

								// Record dependency exports globally
								foreach (var export in exp.Exports)
								{
									json.Global<Dictionary<string, string>>("exports")[export.Key] = export.Value;
								}
							}

							else if (rule is IConditionRule)
							{
								var condition = (IConditionRule)rule;
								json.Set("type", "condition");
								json.Set("properties", condition.Properties);
								json.Set("onChangeOf", condition.Predicates);
								json.Set("conditionType", condition.ConditionType);

								// Translate the assert expression to javascript
								var exp = ExoWeb.ExpressionTranslator.Translate(condition.Condition);
								if (exp.Exceptions.Any())
									throw exp.Exceptions.Last();
								json.Set("assert", exp.Body);

								// Record dependency exports globally
								foreach (var export in exp.Exports)
								{
									var exports = json.Global<Dictionary<string, string>>("exports");
									if (!exports.ContainsKey(export.Key))
										exports.Add(export.Key, export.Value);
								}
							}

							else
								throw new NotSupportedException("Rules of type " + rule.GetType().FullName + " cannot be serialized.  Call ExoWeb.RegisterConverters() to register a converter to support serializing rules of this type.");
					    },
					    json => { throw new NotSupportedException("Rule cannot be deserialized."); }),

					// AllowedValuesRule
					new JsonConverter<AllowedValuesRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("source", rule.Source);
						},
						json => { throw new NotSupportedException("AllowedValuesRule cannot be deserialized."); }),
						
					// CompareRule
					new JsonConverter<CompareRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("compareOperator", rule.CompareOperator.ToString());
							json.Set("compareSource", rule.CompareSource);
						},
						json => { throw new NotSupportedException("CompareRule cannot be deserialized."); }),

					// ListLengthRule
					new JsonConverter<ListLengthRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("compareOperator", rule.CompareOperator.ToString());
							if (!String.IsNullOrEmpty(rule.CompareSource))
								json.Set("compareSource", rule.CompareSource);
							else
								json.Set("compareValue", rule.CompareValue.ToString());
						},
						json => { throw new NotSupportedException("ListLengthRule cannot be deserialized."); }),

					// RangeRule
					new JsonConverter<RangeRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("min", rule.Minimum);
							json.Set("max", rule.Maximum);
						},
						json => { throw new NotSupportedException("RangeRule cannot be deserialized."); }),

					// RequiredRule
					new JsonConverter<RequiredRule>(
						(rule, json) =>	SerializePropertyRule(rule, json),
						json => { throw new NotSupportedException("RequiredRule cannot be deserialized."); }),

					// RequiredIfRule
					new JsonConverter<RequiredIfRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							json.Set("compareOperator", rule.CompareOperator.ToString());
							json.Set("compareSource", rule.CompareSource);
							json.Set("compareValue", rule.CompareValue);
						},
						json => { throw new NotSupportedException("RequiredIfRule cannot be deserialized."); }),

					// OwnerRule
					new JsonConverter<OwnerRule>(
						(rule, json) => SerializePropertyRule(rule, json),
						json => { throw new NotSupportedException("OwnerRule cannot be deserialized."); }),

					// StringLengthRule
					new JsonConverter<StringLengthRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							if (rule.Minimum > 0)
								json.Set("min", rule.Minimum);
							if (rule.Maximum > 0)
								json.Set("max", rule.Maximum);
						},
						json => { throw new NotSupportedException("StringLengthRule cannot be deserialized."); }),

					// StringFormatRule
					new JsonConverter<StringFormatRule>(
						(rule, json) =>
						{
							SerializePropertyRule(rule, json);
							if (!String.IsNullOrEmpty(rule.FormatDescription))
								json.Set("description", rule.FormatDescription);
							json.Set("expression", rule.FormatExpression.ToString());
							if (!String.IsNullOrEmpty(rule.ReformatExpression))
								json.Set("reformat", rule.ReformatExpression);
						},
						json => { throw new NotSupportedException("StringFormatRule cannot be deserialized."); }),

			}) JsonUtility.RegisterConverter(converter);

			// Cache the method info of the deserialize method
			// The non-generic version of this method was added in .NET 4.0
			deserialize = serializer.GetType().GetMethod("Deserialize", new Type[] { typeof(string) });
		}

		/// <summary>
		/// Performs default serialization for subclasses of <see cref="PropertyRule"/>.
		/// </summary>
		/// <param name="rule"></param>
		/// <param name="writer"></param>
		static void SerializePropertyRule(IPropertyRule rule, JsonWriter writer)
		{
			// Assume the type does not need to be included if the name can be inferred from context
			if (String.Format("{0}.{1}.{2}", ((Rule)rule).RootType.Name, rule.Property, rule.Name) != ((Rule)rule).Name)
				writer.Set("type", rule.Name.Substring(0, 1).ToLower() + rule.Name.Substring(1));

			// Embed the condition type, if present, along with the rule
			if (rule.ConditionType != null)
			{
				if (rule.ConditionType.Category != ConditionCategory.Error)
					writer.Set("category", rule.ConditionType.Category.ToString());

				writer.Set("message", rule.ConditionType.Message);

				if (rule.ConditionType.Sets != null && rule.ConditionType.Sets.Any())
					writer.Set("sets", rule.ConditionType.Sets.Select(set => set.Name));
			}
		}

		static Dictionary<string, string> GetEventInstance(ModelInstance instance, string id)
		{
			if (instance == null)
				return null;
			else
				return new Dictionary<string, string>() { { "type", instance.Type.Name }, { "id", id } };
		}

		public static string Serialize(object value)
		{
			using (var writer = new StringWriter())
			{
				using (var jsonWriter = new JsonWriter(writer, serializer))
					serializer.Serialize(jsonWriter, value);

				return writer.ToString();
			}
		}

		public static void Serialize(StringBuilder builder, object value)
		{
			using (var writer = new StringWriter(builder))
				Serialize(new StringWriter(builder), value);
		}

		public static void Serialize(Stream stream, object value)
		{
			using (var writer = new JsonWriter(new StreamWriter(stream), serializer))
			{
				serializer.Serialize(writer, value);
				writer.Flush();
			}
		}

		public static void Serialize(TextWriter writer, object value)
		{
			using (var jsonWriter = new JsonWriter(writer, serializer))
			{
				serializer.Serialize(jsonWriter, value);
				jsonWriter.Flush();
			}
		}

		public static T Deserialize<T>(Stream stream)
		{
			using (var reader = new JsonReader(new StreamReader(stream), serializer))
				return serializer.Deserialize<T>(reader);
		}

		public static T Deserialize<T>(TextReader reader)
		{
			using (var jsonReader = new JsonReader(reader, serializer))
				return serializer.Deserialize<T>(jsonReader);
		}

		public static T Deserialize<T>(string json)
		{
			using (var reader = new JsonReader(new StringReader(json), serializer))
				return serializer.Deserialize<T>(reader);
		}

		public static object Deserialize(Type type, string json)
		{
			using (var reader = new JsonReader(new StringReader(json), serializer))
				return serializer.Deserialize(reader, type);
		}
	}
}
