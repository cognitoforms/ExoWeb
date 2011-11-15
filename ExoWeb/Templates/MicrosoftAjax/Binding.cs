using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using ExoGraph;
using Jurassic;

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
		static Regex expressionParser = new Regex(@"^\{\s*(?<name>\S*?)\s+((?<default>[^,=]+)|(?<param>[^,=]+)\s*\=\s*(?<value>[^,=]+)\s*)(,(?<attr>[^,=]+)\s*\=\s*(?<value>[^,=]+)\s*)*?\}$", RegexOptions.Compiled);

		internal Binding(string expression)
		{
			this.Expression = expression;
			this.Parameters = new Dictionary<string, string>();
		}

		public Dictionary<string, string> Parameters { get; private set; }

		public string Expression { get; private set; }

		public string Extension	{ get; private set; }

		public string Path { get; private set; }

		internal object Evaluate(AjaxPage page)
		{
			GraphInstance source;
			GraphProperty property;
			return Evaluate(page, out source, out property);
		}

		internal abstract object Evaluate(AjaxPage page, out GraphInstance source, out GraphProperty property);

		internal static Binding Parse(string expression)
		{
			if (oneWayExp.IsMatch(expression))
				return new OneWayExtension(expression);
			else if (adapterExp.IsMatch(expression))
				return new AdapterExtension(expression);
			else if (twoWayExp.IsMatch(expression))
				return new TwoWayExtension(expression);
			else
				throw new ArgumentException("'" + expression + "' is not a valid binding expression.");
		}

		internal void ParseExpression()
		{
			// Replace substitition characters for escaped commas
			var expression = Expression.Replace("\\,", ((char)0).ToString());

			// Parse the expression
			var match = expressionParser.Match(expression);

			// Throw an exception if the expression cannot be parsed
			if (match == null)
				throw new ArgumentException("Invalid template expression '" + expression + "'.");

			// Store information about the parsed expression
			Extension = match.Groups["name"].Value;
			Path = match.Groups["default"].Value.Trim().Replace(((char)0).ToString(), ",");
			var parameters = match.Groups["param"].Captures;
			var values = match.Groups["value"].Captures;
			for (int p = 0; p < parameters.Count; p++)
				Parameters[parameters[p].Value.Trim()] = values[p].Value.Trim().Replace(((char)0).ToString(), ",");
		}

		public override string ToString()
		{
			return Expression;
		}

		#region OneWayExtension

		/// <summary>
		/// Implements evaluation of one-way binding expressions, denoted by {{ }}.
		/// </summary>
		internal class OneWayExtension : Binding
		{
			internal OneWayExtension(string expression)
				: base(expression)
			{
				Extension = "{";
				Path = expression.Substring(2, expression.Length - 4).Trim();
			}

			internal override object Evaluate(AjaxPage page, out GraphInstance source, out GraphProperty property)
			{
				source = null;
				property = null;
				try
				{
					var engine = new ScriptEngine();

					object dataItem;

					if (page.Context is GraphInstance)
					{
						JavaScript.EntityWrapperFactory factory = new JavaScript.EntityWrapperFactory(engine);
						dataItem = factory.GetEntity((GraphInstance)page.Context);
					}
					else if (page.Context is Templates.Adapter)
						dataItem = new JavaScript.AdapterWrapper(engine, (Adapter)page.Context);
					else if (page.Context is Templates.OptionAdapter)
						dataItem = new JavaScript.OptionAdapterWrapper(engine, (OptionAdapter)page.Context);
					else
						dataItem = page.Context;

					// Establish the $dataItem global variable
					engine.SetGlobalValue("$dataItem", dataItem);

					// Create globals for an control-specific variables
					if (page.Variables != null)
					{
						foreach (var variable in page.Variables)
							engine.SetGlobalValue(variable.Key, variable.Value);
					}
					
					return engine.Evaluate(Expression);
				}
				catch
				{
					return null;
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
			internal TwoWayExtension(string expression)
				: base(expression)
			{
				ParseExpression();
			}

			internal override object Evaluate(AjaxPage page, out GraphInstance source, out GraphProperty property)
			{
				return page.EvaluatePath(Path, out source, out property);
			}
		}

		#endregion

		#region AdapterExtension

		/// <summary>
		/// Implements adapter-based binding, denoted by {@ } or {# }.
		/// </summary>
		internal class AdapterExtension : Binding
		{
			internal AdapterExtension(string expression)
				: base(expression)
			{
				ParseExpression();
			}

			internal override object Evaluate(AjaxPage page, out GraphInstance source, out GraphProperty property)
			{
				var data = page.EvaluatePath(Path, out source, out property);
				return new Adapter(source, property, data);
			}
		}

		#endregion
	}
}
