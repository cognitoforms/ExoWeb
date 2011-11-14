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
	public abstract class Binding
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

		internal abstract object Evaluate(Page page, out GraphProperty source);

		internal static Binding Parse(string expression)
		{
			if (oneWayExp.IsMatch(expression))
				return new OneWay(expression);
			else if (adapterExp.IsMatch(expression))
				return new Adapter(expression);
			else if (twoWayExp.IsMatch(expression))
				return new TwoWay(expression);
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

		/// <summary>
		/// Gets the data represented by the binding expression for the <see cref="DataView"/>, if available.
		/// </summary>
		/// <param name="page"></param>
		/// <returns></returns>
		internal object EvaluatePath(Page page, out GraphProperty source)
		{
			// Initialize the source property to null
			source = null;

			// Return the current context if a path was not specified
			if (String.IsNullOrEmpty(Path))
				return page.Context;

			// Assume the binding path represents a property path separated by periods
			var steps = Path.Split('.').ToList();

			// Remove unnecessary window steps
			if (steps[0] == "window")
				steps.RemoveAt(0);

			// Default the context to the current page context
			var context = page.Context;

			// First see if the binding expression represents a model level source
			if (steps.Count > 2 && steps[0] == "context" && steps[1] == "model")
			{
				IEnumerable<GraphInstance> data;
				if (page.Model.TryGetValue(steps[2], out data))
				{
					// Immediately return if this is the end of the path
					if (steps.Count == 3)
						return data;

					// Return null if the model instance does not exist or incorrectly represents multiple instances
					if (data.Count() == 0 || data.Count() > 1)
						return null;

					// Set the context to the model instance
					context = data.First();
					steps.RemoveRange(0, 3);
				}
				else
					return null;
			}

			// Process the contextual path
			if (context is GraphInstance)
			{
				var instance = context as GraphInstance;
				for (int s = 0; s < steps.Count - 1; s++)
				{
					if (instance == null)
						return null;
					var step = steps[s];
					var property = ((GraphInstance)context).Type.Properties[step] as GraphReferenceProperty;
					if (property == null || property.IsList)
						return null;
					instance = instance.GetReference(property);
				}
				if (instance == null)
					return null;

				// Evaluate the last step along the path
				source = instance.Type.Properties[steps.Last()];
				if (source is GraphValueProperty)
					return instance.GetValue((GraphValueProperty)source);
				else if (((GraphReferenceProperty)source).IsList)
					return instance.GetList((GraphReferenceProperty)source);
				else
					return instance.GetReference((GraphReferenceProperty)source);
			}

			if (context is MicrosoftAjax.Adapter && steps.Count() == 1)
				return ((MicrosoftAjax.Adapter)context).Evaluate(steps[0]);

			return null;
		}

		public override string ToString()
		{
			return Expression;
		}

		#region OneWay

		/// <summary>
		/// Implements evaluation of one-way binding expressions, denoted by {{ }}.
		/// </summary>
		internal class OneWay : Binding
		{
			internal OneWay(string expression)
				: base(expression)
			{
				Extension = "{";
				Path = expression.Substring(2, expression.Length - 4).Trim();
			}

			internal override object Evaluate(Page page, out GraphProperty source)
			{
				source = null;
				try
				{
					var engine = new ScriptEngine();

					object dataItem;

					if (page.Context is GraphInstance)
						dataItem = new JavaScript.Entity(engine, (GraphInstance)page.Context);
					else if (page.Context is Adapter)
						dataItem = new JavaScript.Entity(engine, (GraphInstance)page.Context);
					else
						dataItem = page.Context;

					engine.SetGlobalValue("$dataItem", dataItem);
					
					return engine.Evaluate(Expression);
				}
				catch
				{
					return EvaluatePath(page, out source);
				}
			}
		}

		#endregion

		#region TwoWay

		/// <summary>
		/// Implements evaluation of two-way binding expressions, denoted by {binding } or {~ }.
		/// </summary>
		internal class TwoWay : Binding
		{
			internal TwoWay(string expression)
				: base(expression)
			{
				ParseExpression();
			}

			internal override object Evaluate(Page page, out GraphProperty source)
			{
				return EvaluatePath(page, out source);
			}
		}

		#endregion

		#region Adapter

		/// <summary>
		/// Implements adapter-based binding, denoted by {@ } or {# }.
		/// </summary>
		internal class Adapter : Binding
		{
			internal Adapter(string expression)
				: base(expression)
			{
				ParseExpression();
			}

			internal override object Evaluate(Page page, out GraphProperty source)
			{
				var data = EvaluatePath(page, out source);
				return new MicrosoftAjax.Adapter(source, data);
			}
		}

		#endregion
	}
}
