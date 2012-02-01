using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using ExoGraph;
using Jurassic;

namespace ExoWeb.Templates.JavaScript
{
	class Transform
	{
		static Regex transformParser = new Regex(@"^(?<name>[a-zA-Z_][a-zA-Z0-9_]*)(?<value>\(.*)$", RegexOptions.Compiled);

		static Regex orderByParser = new Regex(@"\s*(?<path>[A-Za-z0-9_.]+)(?<prenull>\s+null)?(?<direction>\s+(?:asc|desc))?(?<postnull>\s+null)?\s*(?:,|$)", RegexOptions.Compiled);

		private List<Func<Transform, int, Page, IEnumerable, IEnumerable>> Operations { get; set; }

		public int GroupIndex { get; private set; }

		public string Expression { get; private set; }

		public bool IsCompiled { get; private set; }

		Transform(string expression)
		{
			Expression = expression;
			GroupIndex = -1;
			Operations = new List<Func<Transform, int, Page, IEnumerable, IEnumerable>>();
		}

		internal static Transform Compile(string expression)
		{
			Transform transform = new Transform(expression);
			transform.EnsureCompiled();
			return transform;
		}

		internal void EnsureCompiled()
		{
			if (!IsCompiled)
			{
				var expression = Expression;

				while (expression.Length > 0)
				{
					Match match = transformParser.Match(expression);
					string name = match.Groups["name"].Value;
					string value = GetBalancedText(match.Groups["value"].Value, '(', ')', out expression);

					value = value.Substring(1, value.Length - 2);

					if (name == "orderBy")
						Operations.Add(OrderBy(value));
					else if (name == "where")
						Operations.Add(Where(value));
					else if (name == "groupBy")
					{
						// Make a note that grouping begins here
						if (GroupIndex < 0)
							GroupIndex = Operations.Count;
						Operations.Add(GroupBy(value));
					}
					else if (name != "live")
						throw new NotSupportedException("Only orderBy, where, groupBy, and live are supported.");

					if (expression.Length > 0)
					{
						if (expression[0] != '.')
							throw new ApplicationException("Unexpected delimiter character '" + expression[0] + "'.");
						expression = expression.Substring(1);
					}
				}

				IsCompiled = true;
			}
		}

		internal IEnumerable Execute(Page page, IEnumerable input)
		{
			EnsureCompiled();
			var opIndex = 0;
			foreach (var op in Operations)
				input = op(this, opIndex++, page, input);
			return input;
		}

		internal bool TryExecute(Page page, IEnumerable input, out IEnumerable output)
		{
			output = null;

			try
			{
				output = Execute(page, input).Cast<object>().ToArray();
				return true;
			}
			catch (ArgumentException e)
			{
				// Handle an argument exception coming from GraphSource
				if (e.ParamName == "path")
					return false;
				else
					throw;
			}
			catch (ScriptFunctionEvaluationException)
			{
				return false;
			}
			catch (InvalidPropertyException)
			{
				return false;
			}
			catch (InvalidGroupByException)
			{
				return false;
			}
		}

		static ScriptFunction GenerateFunction(string expression)
		{
			return GenerateFunction(expression, null, null);
		}

		static ScriptFunction GenerateFunction(string expression, string prefix, string suffix)
		{
			// NOTE: the context argument is used to simulate the global 'window.context' object.
			// The expression is wrapped in a function which takes several additional arguments to reflect the
			// fact that the client-side implementation is simply a "new Function", which is able to access and
			// use these arguments in order to dynamically provide arguments to functions (i.e. "where").
			return new ScriptFunction(Page.ScriptEngineFactory, new string[] { "context", "list", "$index", "$dataItem" }, (prefix ?? "") + expression + (suffix ?? ""));
		}

		static object ExecuteFunction(ScriptFunction function, ContextWrapper globalContext, object list, object index, object dataItem, params object[] args)
		{
			return function.Evaluate((new object[] { globalContext, list, index, dataItem }).Concat(args.Select(arg => Page.ScriptMarshaller.Wrap(arg))), Page.ScriptMarshaller);
		}

		internal static string GetBalancedText(string input, char open, char closed, out string remainder)
		{
			if (open == closed)
				throw new ArgumentException("Open and closed characters cannot be the same.");
			if (input[0] != open)
				throw new ArgumentException("Input text must begin with the open character.");

			remainder = input.Substring(1);
			var text = input.Substring(0, 1);
			var depth = 1;
			while (depth > 0 && remainder.Length > 0)
			{
				int openIdx = remainder.IndexOf(open);
				int closedIdx = remainder.IndexOf(closed);
				if (closedIdx >= 0 && (openIdx < 0 || closedIdx < openIdx))
				{
					depth -= 1;
					text += remainder.Substring(0, closedIdx + 1);
					remainder = remainder.Substring(closedIdx + 1);
				}
				else if (openIdx >= 0 && (closedIdx < 0 || openIdx < closedIdx))
				{
					depth += 1;
					text += remainder.Substring(0, openIdx + 1);
					remainder = remainder.Substring(openIdx + 1);
				}
				else
					throw new ArgumentException("The input text is not valid.");
			}

			if (depth != 0)
				throw new ArgumentException("The input text is not balanced.");

			return text;
		}

		/// <summary>
		/// Determines whether the enumerable passed into the operation at
		/// the given index is an enumerable of groupings.
		/// </summary>
		/// <param name="index"></param>
		/// <returns></returns>
		bool IsGrouping(int index)
		{
			return GroupIndex >= 0 && index > GroupIndex;
		}

		#region Operations

		static Func<Transform, int, Page, IEnumerable, IEnumerable> OrderBy(string expression)
		{
			// TODO: optimize for constants
			var function = GenerateFunction(expression);
			return (transform, opIndex, page, enumerable) =>
			{
				var globalContext = page.GlobalContext;
				var list = Page.ScriptMarshaller.Wrap(enumerable);
				var index = Page.ScriptMarshaller.Wrap(page.Context.Index);
				var dataItem = Page.ScriptMarshaller.Wrap(page.Context.DataItem);

				var result = (string)ExecuteFunction(function, globalContext, list, index, dataItem);

				if (result.Length == 0)
					throw new ApplicationException("The orderBy text cannot be zero-length.");
				if (!orderByParser.IsMatch(result) || orderByParser.Replace(result, "").Length > 0)
					throw new ApplicationException("The orderBy text \"" + result + "\" is invalid.");

				// Determine whether the given enumerable is a grouping.
				var isGrouping = transform.IsGrouping(opIndex);

				var comparer = new GraphPathComparer();
				foreach (Match match in orderByParser.Matches(result))
				{
					string path = match.Groups["path"].Value;
					bool descending = match.Groups["direction"].Value.Trim() == "desc";
					bool nullsLast = match.Groups["nullsLast"].Value.Trim() == "null";

					// Custom handling of valid grouping options.
					if (isGrouping)
					{
						if (path == "group")
							comparer.AddCustomStep(o => ((Grouping)o).Group, descending, nullsLast);
						else if (path.StartsWith("group."))
							comparer.AddCustomPathStep(o => (GraphInstance)((Grouping)o).Group, path.Substring(6), descending, nullsLast);
						else if (path == "items.length")
							comparer.AddCustomStep(o => ((Grouping)o).Items.Count(), descending, nullsLast);
						else
							throw new InvalidOperationException("Unexpected path \"" + path + "\" for orderBy on grouping.");
					}
					else
						comparer.AddPathStep(path, descending, nullsLast);
				}

				return enumerable.Cast<object>().OrderBy(i => i, comparer);
			};
		}

		static Func<Transform, int, Page, IEnumerable, IEnumerable> Where(string expression)
		{
			// TODO: optimize for constants
			if (expression.StartsWith("function"))
			{
				// The where filter is an anonymous function, so generate a new function that declares common
				// variables in the parent scope, and also passes the hidden argument to the function itself.
				var function = GenerateFunction(expression, "(", ")(arguments[4])");
				return (transform, opIndex, page, enumerable) =>
				{
					var globalContext = page.GlobalContext;
					var list = Page.ScriptMarshaller.Wrap(enumerable);
					var index = Page.ScriptMarshaller.Wrap(page.Context.Index);
					var dataItem = Page.ScriptMarshaller.Wrap(page.Context.DataItem);
					return enumerable.Cast<object>().Where(obj =>
					{
						return JavaScriptHelpers.IsTruthy(Page.ScriptMarshaller.Unwrap(ExecuteFunction(function, globalContext, list, index, dataItem, obj)));
					});
				};
			}
			else
			{
				var function = GenerateFunction(expression);
				return (transform, opIndex, page, enumerable) =>
				{
					// Determine whether the given enumerable is a grouping.
					var isGrouping = transform.IsGrouping(opIndex);

					var globalContext = page.GlobalContext;
					var list = Page.ScriptMarshaller.Wrap(enumerable);
					var index = Page.ScriptMarshaller.Wrap(page.Context.Index);
					var dataItem = Page.ScriptMarshaller.Wrap(page.Context.DataItem);
					var whereText = (string)Page.ScriptMarshaller.Unwrap(ExecuteFunction(function, globalContext, list, index, dataItem));

					if (isGrouping)
					{
						var evaluator = Evaluator.CompileLogicalExpression<FilterItem<Grouping>, FilterItemPathToken<Grouping>>(whereText, path => new GroupingFilterItemPathToken(path));
						return enumerable.Cast<Grouping>().Where((obj, i) =>
						{
							return evaluator.Evaluate(new FilterItem<Grouping>(obj, i));
						});
					}
					else
					{
						var evaluator = Evaluator.CompileLogicalExpression<FilterItem<GraphInstance>, FilterItemPathToken<GraphInstance>>(whereText, path => new GraphInstanceFilterItemPathToken(path));
						return enumerable.Cast<GraphInstance>().Where((obj, i) =>
						{
							return evaluator.Evaluate(new FilterItem<GraphInstance>(obj, i));
						});
					}
				};
			}
		}

		static Func<Transform, int, Page, IEnumerable, IEnumerable> GroupBy(string expression)
		{
			// TODO: optimize for constants
			if (expression.StartsWith("function"))
			{
				// The where filter is an anonymous function, so generate a new function that declares common
				// variables in the parent scope, and also passes the hidden argument to the function itself.
				var function = GenerateFunction(expression, "(", ")(arguments[4])");
				return (transform, opIndex, page, enumerable) =>
				{
					var globalContext = page.GlobalContext;
					var list = Page.ScriptMarshaller.Wrap(enumerable);
					var index = Page.ScriptMarshaller.Wrap(page.Context.Index);
					var dataItem = Page.ScriptMarshaller.Wrap(page.Context.DataItem);
					return enumerable.Cast<object>().GroupBy(obj =>
					{
						return Page.ScriptMarshaller.Unwrap(ExecuteFunction(function, globalContext, list, index, dataItem, obj));
					}).Select(g => new Grouping(g.Key, g));
				};
			}
			else
			{
				var function = GenerateFunction(expression);
				return (transform, opIndex, page, enumerable) =>
				{
					// Determine whether the given enumerable is a grouping.
					var isGrouping = transform.IsGrouping(opIndex);

					var globalContext = page.GlobalContext;
					var list = Page.ScriptMarshaller.Wrap(enumerable);
					var index = Page.ScriptMarshaller.Wrap(page.Context.Index);
					var dataItem = Page.ScriptMarshaller.Wrap(page.Context.DataItem);
					var groupByText = (string)Page.ScriptMarshaller.Unwrap(ExecuteFunction(function, globalContext, list, index, dataItem));

					if (isGrouping)
					{
						return enumerable.Cast<Grouping>().GroupBy(obj =>
						{
							object result;
							var path = groupByText;
							if (!obj.TryGetValue(path, out path, out result))
								throw new InvalidGroupByException(groupByText);
							if (!string.IsNullOrEmpty(path))
								result = new GraphSource(((GraphInstance)result).Type, path).GetValue(((GraphInstance)result));
							return result;
						}).Select(g => new Grouping(g.Key, g));
					}
					else
					{
						return enumerable.Cast<GraphInstance>()
							.GroupBy(obj =>
							{
								var graphSource = new GraphSource(obj.Type, groupByText);
								var source = graphSource.GetSource(obj);
								var property = source.Properties[graphSource.SourceProperty];
								var isReference = property is GraphReferenceProperty;
								var value = graphSource.GetValue(obj);
								return isReference ? GraphContext.Current.GetGraphInstance(value) : value;
							})
							.Select(g => new Grouping(g.Key, g));
					}
				};
			}
		}

		#endregion

		#region FilterItem<TType>

		internal class FilterItem<TType>
		{
			internal FilterItem(TType item, int index)
			{
				Item = item;
				Index = index;
			}

			internal TType Item { get; private set; }

			internal int Index { get; private set; }
		}

		#endregion

		#region FilterItemPathToken<TType>

		/// <summary>
		/// An expression token that refers to a graph path, or a grouping path optionally followed by a graph path.
		/// </summary>
		internal abstract class FilterItemPathToken<TType> : Evaluator.Token<FilterItem<TType>>
		{
			internal FilterItemPathToken(string path)
			{
				Path = path;
			}

			/// <summary>
			/// The path to evaluate.
			/// </summary>
			internal string Path { get; private set; }

			protected static object GetValue(GraphInstance instance, int index, string path)
			{
				if (path == "$index")
					return index;
				else
					return new GraphSource(instance.Type, path).GetValue(instance);
			}
		}

		#endregion

		#region GraphInstanceFilterItemPathToken

		/// <summary>
		/// An expression token that refers to a graph path.
		/// </summary>
		internal class GraphInstanceFilterItemPathToken : FilterItemPathToken<GraphInstance>
		{
			internal GraphInstanceFilterItemPathToken(string path)
				: base(path)
			{
			}

			internal override object GetValue(FilterItem<GraphInstance> source)
			{
				if (Path == "$item")
					// Return the current item.
					return source.Item.Instance;
				else
					// Remove the $item prefix since it is not necessary and will not be recongnized by ExoGraph.
					return GetValue(source.Item, source.Index, Path.IndexOf("$item.") == 0 ? Path.Substring(6) : Path);
			}
		}

		#endregion

		#region GroupingFilterItemPathToken

		/// <summary>
		/// An expression token that refers to grouping path, and optional subsequent graph path.
		/// </summary>
		internal class GroupingFilterItemPathToken : FilterItemPathToken<Grouping>
		{
			internal GroupingFilterItemPathToken(string path)
				: base(path)
			{
			}

			internal override object GetValue(FilterItem<Grouping> source)
			{
				string path = Path;
				object result = null;

				// Remove the $item prefix since it is not necessary and will not be recongnized by ExoGraph.
				if (path.StartsWith("$item."))
					path = path.Substring(6);

				if (!source.Item.TryGetValue(path, out path, out result))
					throw new Exception("Expression \"" + Path + "\" is not valid for a grouping.");

				if (!string.IsNullOrEmpty(path))
					result = GetValue((GraphInstance)result, source.Index, path);

				return result;
			}
		}

		#endregion

		#region Grouping

		/// <summary>
		/// Represents the simple object structure used client-side when grouping using the transform.
		/// </summary>
		internal class Grouping
		{
			private List<object> items;

			internal Grouping(object key, IEnumerable values)
			{
				Group = key;
				items = new List<object>(values.Cast<object>());
			}

			internal object Group { get; private set; }

			internal IEnumerable<object> Items
			{
				get
				{
					foreach (object item in items)
						yield return item;
				}
			}

			internal bool TryGetValue(string path, out string remainder, out object value)
			{
				var result = false;
				remainder = null;
				value = null;

				if (path == "group")
				{
					value = Group;
					result = true;
				}
				else if (path == "items")
				{
					value = Items;
					result = true;
				}
				else if (path == "items.length")
				{
					value = Items.Count();
					result = true;
				}
				else if (path.StartsWith("group."))
				{
					value = (GraphInstance)Group;
					remainder = path.Substring(6);
					result = true;
				}

				return result;
			}
		}

		#endregion

		#region GroupingWrapper

		internal class GroupingWrapper : Wrapper<Grouping>
		{
			internal GroupingWrapper(ScriptEngine engine, Grouping grouping)
				: base(grouping, engine, engine.Object.InstancePrototype)
			{
			}

			protected override object GetMissingPropertyValue(string jsPropertyName)
			{
				object result;
				if (RealObject.TryGetValue(jsPropertyName, out jsPropertyName, out result))
					return Page.ScriptMarshaller.Wrap(result);

				return base.GetMissingPropertyValue(jsPropertyName);
			}
		}

		#endregion

		#region GraphPathComparer

		public class GraphPathComparer : IComparer<GraphInstance>, IComparer<object>
		{
			List<ComparisonPath> paths = new List<ComparisonPath>();

			public void AddPathStep(string path, bool descending, bool nullsLast)
			{
				if (string.IsNullOrEmpty(path))
					throw new ArgumentException("The path step cannot be null or empty string.");

				paths.Add(new ComparisonPath() { Path = path, IsDescending = descending, NullsLast = nullsLast });
			}

			public void AddCustomPathStep(Func<object, GraphInstance> accessor, string path, bool descending, bool nullsLast)
			{
				if (accessor == null)
					throw new ArgumentNullException("accessor", "The custom accessor cannot be null.");
				else if (string.IsNullOrEmpty(path))
					throw new ArgumentException("The path step cannot be null or empty string.");

				paths.Add(new ComparisonPath() { Accessor = o => accessor(o), Path = path, IsDescending = descending, NullsLast = nullsLast });
			}

			public void AddCustomStep(Func<object, object> accessor, bool descending, bool nullsLast)
			{
				if (accessor == null)
					throw new ArgumentNullException("accessor", "The custom accessor cannot be null.");

				paths.Add(new ComparisonPath() { Accessor = accessor, IsDescending = descending, NullsLast = nullsLast });
			}

			/// <summary>
			/// Recursively search for a valid path, checking base types first.
			/// </summary>
			/// <param name="type"></param>
			/// <param name="path"></param>
			/// <returns></returns>
			private GraphType DetermineRootType(GraphType type, string path)
			{
				GraphType result = null;
				GraphPath graphPath;

				// Recursively check the base type first.
				if (type.BaseType != null)
					result = DetermineRootType(type.BaseType, path);

				// If the path is not valid for the base type, then check this type.
				if (result == null && type.TryGetPath(path, out graphPath))
					result = type;

				return result;
			}

			/// <summary>
			/// 
			/// </summary>
			/// <param name="instance"></param>
			/// <param name="path"></param>
			/// <returns></returns>
			private GraphSource GetPathSource(GraphInstance instance, string path)
			{
				var rootType = DetermineRootType(instance.Type, path);

				if (rootType == null)
					throw new InvalidPropertyException(instance.Type, path);

				return new GraphSource(rootType, path);
			}

			public int Compare(object x, object y)
			{
				var result = 0;

				foreach (ComparisonPath path in paths)
				{
					object xValue = x;
					object yValue = y;

					if (path.Accessor != null)
					{
						xValue = path.Accessor(xValue);
						yValue = path.Accessor(yValue);
					}

					if (path.Path != null)
					{
						xValue = GetPathSource((GraphInstance)xValue, path.Path).GetValue((GraphInstance)xValue);
						yValue = GetPathSource((GraphInstance)yValue, path.Path).GetValue((GraphInstance)yValue);
					}

					if (xValue == null && yValue == null)
						result = 0;
					else if (xValue == null)
						result = path.NullsLast ? 1 : -1;
					else if (yValue == null)
						result = path.NullsLast ? -1 : 1;
					else
						result = (path.IsDescending ? -1 : 1) * ((IComparable)xValue).CompareTo(yValue);

					// Stop iterating over comparison paths once a distinction has been made
					if (result != 0)
						break;
				}

				return result;
			}

			int IComparer<object>.Compare(object x, object y)
			{
				return Compare(x, y);
			}

			int IComparer<GraphInstance>.Compare(GraphInstance x, GraphInstance y)
			{
				return Compare(x, y);
			}

			class ComparisonPath
			{
				internal string Path { get; set; }

				internal Func<object, object> Accessor { get; set; }

				internal bool IsDescending { get; set; }

				internal bool NullsLast { get; set; }
			}
		}

		#endregion
	}

	public class InvalidGroupByException : ApplicationException
	{
		public string Expression { get; private set; }

		public InvalidGroupByException(string expression)
		{
			this.Expression = expression;
		}

		public override string Message
		{
			get
			{
				return string.Format("Expression \"{0}\" is not valid for a grouping.", Expression);
			}
		}
	}
}
