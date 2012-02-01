using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using ExoGraph;
using Jurassic;
using Jurassic.Library;
using ExoWeb.Templates.JavaScript;
using System.Collections;

namespace ExoWeb.Templates.MicrosoftAjax
{	
	/// <summary>
	/// Represents a one or two-way binding expression.
	/// {{ js }} - 1 time
	/// {binding [default][, attr=value] } - 2 way, unless Mode = 1 way
	/// {~ [default][, attr=value]  } - 1 way
	/// {@ [default][, attr=value]  } - 1 way
	/// {# [default][, attr=value]  } - 2 way
	/// </summary>
	internal abstract class Binding
	{
		static Regex oneWayExp = new Regex(@"^\{\{.+\}\}$");
		static Regex twoWayExp = new Regex(@"^\{\s*(binding|\~).*\}$");
		static Regex adapterExp = new Regex(@"^\{\s*(\@|\#).+\}$");
		static Regex expressionParser = new Regex(@"^\{\s*(?<extension>\S*?)\s+(?:(?<default>[^,=]*(?=,|(?:\s*}))),)?\s*(?<properties>.*)\s*\}$", RegexOptions.Compiled);

		Binding(string attribute, string expression)
		{
			this.Expression = expression;
			this.Parameters = new Dictionary<string, string>();
			this.Attribute = new Attribute() { Binding = this, Name = attribute, Value = expression };
		}

		public Dictionary<string, string> Parameters { get; private set; }

		public string Expression { get; private set; }

		public string Extension { get; private set; }

		public string Path { get; private set; }

		public bool IsTwoWay { get; protected set; }

		public Attribute Attribute { get; protected set; }

		internal abstract AttributeBinding Evaluate(AjaxPage page);

		internal static Binding Parse(string attribute, string expression)
		{
			if (oneWayExp.IsMatch(expression))
				return new OneWayExtension(attribute, expression);
			else if (adapterExp.IsMatch(expression))
				return new AdapterExtension(attribute, expression);
			else if (twoWayExp.IsMatch(expression))
				return new TwoWayExtension(attribute, expression);
			else
				return new Constant(attribute, expression);
		}

		string CleanExpression(string value)
		{
			return value.Trim().Replace("&lt;", "<").Replace("&gt;", ">");
		}

		internal void ParseExpression()
		{
			// Replace substitition characters for escaped commas
			var expression = Expression.Replace("\\,", ((char)0).ToString());

			// Parse the expression
			var match = expressionParser.Match(expression);

			// Throw an exception if the expression cannot be parsed
			if (match == null || !match.Success)
				throw new ArgumentException("Invalid template expression '" + expression + "'.");

			Extension = match.Groups["extension"].Value;

			Path = CleanExpression(match.Groups["default"].Value).Replace(((char)0).ToString(), ",");

			var properties = match.Groups["properties"].Value.Split(",".ToCharArray(), StringSplitOptions.RemoveEmptyEntries);
			foreach (string prop in properties)
			{
				var property = prop.Trim().Replace(((char)0).ToString(), ",");
				var equalsIdx = property.IndexOf('=');
				if (equalsIdx >= 0)
					Parameters[property.Substring(0, equalsIdx).Trim()] = property.Substring(equalsIdx + 1).Trim().Replace(((char)0).ToString(), ",");
				else
				{
					if (!string.IsNullOrEmpty(Path))
						throw new ApplicationException("Invalid expression \"" + Expression + "\".");
					Path = property;
				}
			}
		}

		public override string ToString()
		{
			return Expression;
		}

		#region Constant

		/// <summary>
		/// Represents a constant binding value
		/// </summary>
		internal class Constant : Binding
		{
			AttributeBinding binding;

			internal Constant(string attribute, string expression)
				: base(attribute, expression)
			{
				Extension = null;
				Path = null;
				binding = new AttributeBinding(new Attribute() { Name = attribute, Value = expression }, null);
			}

			internal override AttributeBinding Evaluate(AjaxPage page)
			{
				return binding;
			}
		}

		#endregion

		#region OneWayExtension

		/// <summary>
		/// Implements evaluation of one-way binding expressions, denoted by {{ }}.
		/// </summary>
		internal class OneWayExtension : Binding
		{
			JavaScript.ScriptFunction script;

			internal OneWayExtension(string attribute, string expression)
				: base(attribute, expression)
			{
				Extension = "{";
				Path = CleanExpression(expression.Substring(2, expression.Length - 4));
			}

			internal override AttributeBinding Evaluate(AjaxPage page)
			{
				IEnumerable<KeyValuePair<string, object>> arguments = page.Context.Variables.Concat( new KeyValuePair<string, object>[] { 
					new KeyValuePair<string, object>("$dataItem", page.Context.DataItem),
					new KeyValuePair<string, object>("$index", page.Context.Index)
				});

				if (script == null)
				{
					lock (this)
					{
						if (script == null)
							script = new JavaScript.ScriptFunction(Page.ScriptEngineFactory, arguments.Select(a => a.Key), Path);
					}
				}

				try
				{
					return new AttributeBinding(Attribute, new BindingResult() { Value = script.Evaluate(arguments.Select(a => a.Value), Page.ScriptMarshaller), IsValid = true });
				}
				catch
				{
					return new AttributeBinding(Attribute, BindingResult.Invalid);
				}
			}
		}

		#endregion

		#region TwoWayExtension

		/// <summary>
		/// Implements evaluation of two-way binding expressions, denoted by {binding } or {~ }.
		/// </summary>
		internal class TwoWayExtension : Binding
		{
			string format;

			Transform transform;

			internal TwoWayExtension(string attribute, string expression)
				: base(attribute, expression)
			{
				IsTwoWay = true;
				ParseExpression();
				Parameters.TryGetValue("format", out format);
			}

			internal override AttributeBinding Evaluate(AjaxPage page)
			{
				var path = Path;

				string sourcePath;
				if (Parameters.TryGetValue("source", out sourcePath) && sourcePath.Length > 0)
					path = sourcePath + "." + path;

				var result = page.EvaluatePath(path);

				if (format != null && result.Value is IFormattable)
					result.Value = ((IFormattable)result.Value).ToString(format, null);

				string transformText;
				if (transform == null && Parameters.TryGetValue("transform", out transformText) && transformText.Length > 0)
					transform = Transform.Compile(transformText);

				if (result.IsValid && transform != null && result.Value != null)
				{
					//result.Value = transform.Execute(page, (IEnumerable)result.Value);
					IEnumerable transformed;
					result.IsValid = transform.TryExecute(page, (IEnumerable)result.Value, out transformed);
					result.Value = result.IsValid ? transformed : null;
				}

				return new AttributeBinding(Attribute, result);
			}
		}

		#endregion

		#region AdapterExtension

		/// <summary>
		/// Implements adapter-based binding, denoted by {@ } or {# }.
		/// </summary>
		internal class AdapterExtension : Binding
		{
			internal AdapterExtension(string attribute, string expression)
				: base(attribute, expression)
			{
				IsTwoWay = true;
				ParseExpression();
			}

			internal override AttributeBinding Evaluate(AjaxPage page)
			{
				// Evaluate the binding path
				var result = page.EvaluatePath(Path);

				// Invalid result
				if (result.Property == null)
					result.IsValid = false;

				// # syntax
				else if (Extension == "#")
				{
					string format = null;
					Parameters.TryGetValue("format", out format);

					string value;
					result.IsValid = Adapter.TryGetDisplayValue(result.Property, format, result.Value, out value);
					result.Value = value;
				}

				// @ syntax
				else if (Extension == "@")
				{
					if (string.IsNullOrEmpty(Path))
					{
						if (!(page.Context.DataItem is Adapter))
							throw new ApplicationException("No path was specified for the \"@\" markup extension, and the source is not an adapter.");
						result.Value = page.Context.DataItem;
					}
					else
						result = new BindingResult()
						{
							Value = new Adapter(result, Parameters),
							IsValid = result.IsValid,
							Property = result.Property,
							Source = result.Source
						};
				}

				return new AttributeBinding(Attribute, result);
			}
		}

		#endregion
	}
}
