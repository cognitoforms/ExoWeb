﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Newtonsoft.Json;
using System.IO;
using System.Linq.Expressions;

namespace ExoWeb.Serialization
{
	public class JsonWriter : JsonTextWriter
	{
		JsonSerializer serializer;
		bool throwOnError;

		internal bool SerializePropertyConditionType { get; set; }		

		internal JsonWriter(TextWriter writer, JsonSerializer serializer, bool serializePropertyConditionType = true, bool throwOnError = true)
			: base(writer)
		{
			this.serializer = serializer;
			this.CloseOutput = false;
			this.SerializePropertyConditionType = serializePropertyConditionType;
			this.throwOnError = throwOnError;
		}

		public void Set(string name, object value)
		{
			WritePropertyName(name);
			serializer.Serialize(this, value);
		}

		// Serializes an expression, translated to JavaScript
		public void Set(string name, LambdaExpression expression)
		{
			// Translate the assert expression to javascript
			var exp = ExoWeb.ExpressionTranslator.Translate(expression);
			if (throwOnError && exp.Exceptions.Any())
				throw exp.Exceptions.Last();

			WritePropertyName(name);

			if (!exp.Exceptions.Any())
			{
				// Output expression body
				serializer.Serialize(this, exp.Body);

				// Record dependency exports globally
				foreach (var export in exp.Exports)
					Global<Dictionary<string, string>>("exports")[export.Key] = export.Value;
			}
			else
			{
				// If there were any exceptions in translation, output null
				serializer.Serialize(this, ExoWeb.ExpressionTranslator.Translate(Expression.Lambda(Expression.Constant(null))).Body);
			}
		}

		public void Serialize(object value)
		{
			serializer.Serialize(this, value);
		}

		Dictionary<string, object> globals = new Dictionary<string, object>();

		internal bool TryGetGlobal<T>(string name, out T value)
		{
			if (globals.ContainsKey(name))
			{
				value = (T)globals[name];
				return true;
			}
			value = default(T);
			return false;
		}

		internal void SetGlobal<T>(string name, T value)
		{
			globals[name] = value;
		}

		/// <summary>
		/// Gets or creates a global variable with the specified type and name.
		/// </summary>
		/// <typeparam name="T"></typeparam>
		/// <param name="name"></param>
		/// <returns></returns>
		public T Global<T>(string name)
			where T : class, new()
		{
			T global;
			if (!TryGetGlobal(name, out global))
				SetGlobal(name, global = new T());
			return global;
		}
	}
}
