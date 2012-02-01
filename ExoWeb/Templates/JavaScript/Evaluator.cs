using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace ExoWeb.Templates.JavaScript
{
	internal class Evaluator
	{
		static Regex parser = new Regex(@"^(?:\s*(?<expr>(?:[^\(\)&\|]+)|(?:\(.*\)))(?<next>\s+(?:&&)\s+|\s+(?:\|\|)\s+|$))*$", RegexOptions.Compiled);

		static Regex exprParser = new Regex(@"^(?<left>(?:(?:'|"")[a-zA-Z_$][0-9A-Za-z_$\.\s]*(?:'|""))|(?:[0-9][0-9\.]*)|[a-zA-Z_$][0-9A-Za-z_$\.]*)(?<op>\s*(?:==|===|!=|!==|\>|\<|\>=|\<=)\s*)?(?<right>(?:(?:(?:'|"")[a-zA-Z_$][0-9A-Za-z_$\.\s]*(?:'|""))|(?:[0-9][0-9\.]*)|[a-zA-Z_$][0-9A-Za-z_$\.]*)|(?<!\s*(?:==|===|!=|!==|\>|\<|\>=|\<=)\s*))$", RegexOptions.Compiled);

		internal static LogicalExpression<TSource> CompileLogicalExpression<TSource, TToken>(string text, Func<string, TToken> pathToken)
			where TToken : Token<TSource>
		{
			LogicalExpression<TSource> result = null;

			var whereMatch = parser.Match(text);
			if (whereMatch == null || !whereMatch.Success)
				throw new ArgumentException("Invalid expression \"" + text + "\".");

			var exprCaptures = whereMatch.Groups["expr"].Captures;
			var nextCaptures = whereMatch.Groups["next"].Captures;

			AndExpressionGroup<TSource> andGroup = null;

			for (var i = 0; i < exprCaptures.Count; i++)
			{
				var exprText = exprCaptures[i].Value.Trim();
				var nextText = nextCaptures[i].Value.Trim();

				IEvaluate<TSource> expr;

				if (Regex.IsMatch(exprText, @"^\(.*\)$"))
					expr = CompileLogicalExpression<TSource, TToken>(exprText.Substring(1, exprText.Length - 2), pathToken);
				else
				{
					var exprMatch = exprParser.Match(exprText);

					if (exprMatch == null || !exprMatch.Success)
						throw new Exception("Invalid expression \"" + exprText + "\".");

					var leftText = exprMatch.Groups["left"].Value.Trim();
					var opText = exprMatch.Groups["op"].Value.Trim();
					var rightText = exprMatch.Groups["right"].Value.Trim();

					if (string.IsNullOrEmpty(opText))
					{
						// No operator, so this is a truthy property or constant check.

						object value;
						if (JavaScriptHelpers.TryParseConstant(leftText, out value))
							expr = new TruthyConstantExpression<TSource>(new ConstantToken<TSource>(value));
						else
							expr = new PathExpression<TSource>(pathToken(leftText));
					}
					else
					{
						// Parse the comparison operator.
						LogicalOperator op = ParseLogicalOperator(opText);

						// Parse the left-hand token.
						Token<TSource> leftToken;
						object leftValue;
						if (JavaScriptHelpers.TryParseConstant(leftText, out leftValue))
							leftToken = new ConstantToken<TSource>(leftValue);
						else
							leftToken = pathToken(leftText);

						// Parse the right-hand token.
						Token<TSource> rightToken;
						object rightValue;
						if (JavaScriptHelpers.TryParseConstant(rightText, out rightValue))
							rightToken = new ConstantToken<TSource>(rightValue);
						else
							rightToken = pathToken(rightText);

						// Create the expression from "left op right".
						expr = new CompareExpression<TSource>(leftToken, op, rightToken);
					}
				}

				if (nextText == "&&" && andGroup == null)
					// There is currently no active and group and the next expression
					// will be "ANDed", so start a new and group, beginning with this expression.
					andGroup = AndExpressionGroup<TSource>.Begin(expr);
				else if (andGroup != null)
					// There is an active and group expression, so add this expression to it.
					andGroup.And(expr);
				else if (result != null)
					// There is currently a result, so or it with this expression.
					result = result.Or(expr);
				else
					// There is currently no result, so use this expression as the result.
					result = new TruthyExpressionWrapper<TSource>(expr);

				// Add the existing group if we have reached the end of the expression, or the next expression will be "ORed".
				if ((string.IsNullOrEmpty(nextText) || nextText == "||") && andGroup != null)
				{
					if (result == null)
						result = andGroup;
					else
						result = result.Or(andGroup);
					andGroup = null;
				}
			}

			return result;
		}

		#region LogicalOperator

		/// <summary>
		/// Represents JavaScript logical operators: ==, ===, !=, !===, &lt;=, &lt;, &gt;=, &gt;.
		/// </summary>
		internal enum LogicalOperator
		{
			DoubleEqual,
			TripleEqual,
			NotDoubleEqual,
			NotTripleEqual,
			LessThanEqual,
			LessThan,
			GreaterThanEqual,
			GreaterThan
		}

		internal static IEnumerable<string> GetNonLogicalOperators()
		{
			return new string[] { "+", "-", "*", "/", "%", "++", "--", "=", "+=", "-=", "*=", "/=", "%=" };
		}

		/// <summary>
		/// Parses an operator and returns the corresponding CompareOperator enum.
		/// </summary>
		/// <param name="opText"></param>
		/// <param name="truthy"></param>
		/// <returns></returns>
		internal static LogicalOperator ParseLogicalOperator(string value)
		{
			LogicalOperator op;

			var opText = value.Trim();

			if (opText == "==")
				op = LogicalOperator.DoubleEqual;
			else if (opText == "===")
				op = LogicalOperator.TripleEqual;
			else if (opText == "!=")
				op = LogicalOperator.NotDoubleEqual;
			else if (opText == "!==")
				op = LogicalOperator.NotTripleEqual;
			else if (opText == ">")
				op = LogicalOperator.GreaterThan;
			else if (opText == ">=")
				op = LogicalOperator.GreaterThanEqual;
			else if (opText == "<")
				op = LogicalOperator.LessThan;
			else if (opText == "<=")
				op = LogicalOperator.LessThanEqual;
			else if (GetNonLogicalOperators().Contains(opText))
				throw new Exception("The \"" + opText + "\" operator is not a logical operator.");
			else
				// If the operator was not found then there is a problem with the parsing regex.
				throw new Exception("Unknown operator \"" + value + "\".");

			return op;
		}

		#endregion

		#region Tokens

		/// <summary>
		/// The base token class, which can be used to get a value given a source object.
		/// </summary>
		internal abstract class Token<TSource>
		{
			internal abstract object GetValue(TSource source);
		}

		/// <summary>
		/// A token that simply represents a contant value.
		/// </summary>
		internal class ConstantToken<TSource> : Token<TSource>
		{
			internal ConstantToken(object value)
			{
				Value = value;
			}

			/// <summary>
			/// The constant value represented by this token.
			/// </summary>
			object Value { get; set; }

			internal override object GetValue(TSource source)
			{
				return Value;
			}
		}

		#endregion

		#region Expressions

		internal interface IEvaluate<TSource>
		{
			object Evaluate(TSource source);
		}
		
		internal interface IEvaluate<TSource, TResult> : IEvaluate<TSource>
		{
			new TResult Evaluate(TSource source);
		}

		/// <summary>
		/// A simple path expression (i.e. "IsEnabled", or "Customer.Name").
		/// </summary>
		internal class PathExpression<TSource> : IEvaluate<TSource>
		{
			internal PathExpression(Token<TSource> token)
			{
				Token = token;
			}

			/// <summary>
			/// The path token value.
			/// </summary>
			Token<TSource> Token { get; set; }

			public object Evaluate(TSource source)
			{
				return Token.GetValue(source);
			}
		}

		/// <summary>
		/// A logical expression that wraps a constant token and returns whether the value is truthy.
		/// </summary>
		internal class TruthyConstantExpression<TSource> : LogicalExpression<TSource>
		{
			internal TruthyConstantExpression(ConstantToken<TSource> token)
			{
				Token = token;
			}

			/// <summary>
			/// The constant token.
			/// </summary>
			internal ConstantToken<TSource> Token { get; private set; }

			public override bool Evaluate(TSource source)
			{
				return JavaScriptHelpers.IsTruthy(Token.GetValue(source));
			}
		}

		/// <summary>
		/// A logical expression that wraps an inner exception and returns
		/// true of false depending on whether the resulting value is truthy.
		/// </summary>
		internal class TruthyExpressionWrapper<TSource> : LogicalExpression<TSource>
		{
			internal TruthyExpressionWrapper(IEvaluate<TSource> inner)
			{
				Inner = inner;
			}

			/// <summary>
			/// The inner path expression token.
			/// </summary>
			internal IEvaluate<TSource> Inner { get; private set; }

			public override bool Evaluate(TSource source)
			{
				return JavaScriptHelpers.IsTruthy(Inner.Evaluate(source));
			}
		}

		/// <summary>
		/// An expression that evaluates as a boolean and can
		/// be ANDed and ORed with other expressions.
		/// </summary>
		internal abstract class LogicalExpression<TSource> : IEvaluate<TSource, bool>
		{
			internal LogicalExpression<TSource> Or(IEvaluate<TSource> expression)
			{
				return (this as OrExpressionGroup<TSource> ?? OrExpressionGroup<TSource>.Begin(this)).AddExpression(expression);
			}

			internal LogicalExpression<TSource> And(IEvaluate<TSource> expression)
			{
				return (this as AndExpressionGroup<TSource> ?? AndExpressionGroup<TSource>.Begin(this)).AddExpression(expression);
			}

			public abstract bool Evaluate(TSource source);

			bool IEvaluate<TSource, bool>.Evaluate(TSource source)
			{
				return Evaluate(source);
			}

			object IEvaluate<TSource>.Evaluate(TSource source)
			{
				return Evaluate(source);
			}
		}

		/// <summary>
		/// An expression that compares two tokens and returns true or false.
		/// </summary>
		internal class CompareExpression<TSource> : LogicalExpression<TSource>
		{
			internal CompareExpression(Token<TSource> left, LogicalOperator op, Token<TSource> right)
			{
				Left = left;
				Op = op;
				Right = right;
			}

			/// <summary>
			/// The left-hand side token value.
			/// </summary>
			Token<TSource> Left { get; set; }

			/// <summary>
			/// The operator to use for comparison.
			/// </summary>
			LogicalOperator Op { get; set; }

			/// <summary>
			/// The operator to use for comparison.
			/// </summary>
			Token<TSource> Right { get; set; }

			public override bool Evaluate(TSource source)
			{
				var left = Left.GetValue(source);
				var right = Right.GetValue(source);

				if (Op == LogicalOperator.DoubleEqual)
					throw new NotSupportedException("The == operator is not supported.");
				else if (Op == LogicalOperator.NotDoubleEqual)
					throw new NotSupportedException("The != operator is not supported.");

				// Account for nulls
				if (left == null && right == null)
				{
					if (Op == LogicalOperator.NotTripleEqual) return false;
					else return true;
				}
				else if (left == null)
				{
					if (Op == LogicalOperator.NotTripleEqual || Op == LogicalOperator.LessThan || Op == LogicalOperator.LessThanEqual) return true;
					else return false;
				}
				else if (right == null)
				{
					if (Op == LogicalOperator.NotTripleEqual || Op == LogicalOperator.GreaterThan || Op == LogicalOperator.GreaterThanEqual) return true;
					else return false;
				}

				// Perform the comparison and return the result
				int compareResult = ((IComparable)left).CompareTo(right);
				switch (Op)
				{
					case LogicalOperator.TripleEqual: return compareResult == 0;
					case LogicalOperator.NotTripleEqual: return compareResult != 0;
					case LogicalOperator.GreaterThan: return compareResult > 0;
					case LogicalOperator.GreaterThanEqual: return compareResult >= 0;
					case LogicalOperator.LessThan: return compareResult < 0;
					case LogicalOperator.LessThanEqual: return compareResult <= 0;
					default:
						throw new Exception("Unexpected operator \"" + Op.ToString() + "\".");
				}
			}
		}

		/// <summary>
		/// Abstract class that represents a group of logical operations
		/// evaluated as a single logical expression.
		/// </summary>
		internal abstract class LogicalExpressionGroup<TSource> : LogicalExpression<TSource>
		{
			List<IEvaluate<TSource>> expressions = new List<IEvaluate<TSource>>();

			/// <summary>
			/// Adds a new expression to evaluate.
			/// </summary>
			/// <param name="expression"></param>
			protected internal LogicalExpressionGroup<TSource> AddExpression(IEvaluate<TSource> expression)
			{
				expressions.Add(expression);
				return this;
			}

			internal IEnumerable<IEvaluate<TSource>> Expressions
			{
				get
				{
					foreach (IEvaluate<TSource> expr in expressions)
						yield return expr;
				}
			}
		}

		/// <summary>
		/// Represents a number of expressions which, when evaluated, returns true if
		/// any of the expressions are "truthy".
		/// </summary>
		internal class OrExpressionGroup<TSource> : LogicalExpressionGroup<TSource>
		{
			internal OrExpressionGroup() { }
			
			internal OrExpressionGroup(IEvaluate<TSource> expression)
			{
				AddExpression(expression);
			}

			internal static OrExpressionGroup<TSource> Begin(IEvaluate<TSource> expression)
			{
				return new OrExpressionGroup<TSource>(expression is TruthyExpressionWrapper<TSource> ? ((TruthyExpressionWrapper<TSource>)expression).Inner : expression);
			}

			public override bool Evaluate(TSource source)
			{
				foreach (IEvaluate<TSource> expr in Expressions)
					if (JavaScriptHelpers.IsTruthy(expr.Evaluate(source)))
						return true;

				return false;
			}
		}

		/// <summary>
		/// Represents a number of expressions which, when evaluated, returns true if
		/// all of the expressions are "truthy".
		/// </summary>
		internal class AndExpressionGroup<TSource> : LogicalExpressionGroup<TSource>
		{
			internal AndExpressionGroup() { }

			internal AndExpressionGroup(IEvaluate<TSource> expression)
			{
				AddExpression(expression);
			}

			/// <summary>
			/// Wraps an evaluatable expression in a new compound expression.
			/// </summary>
			/// <param name="expression"></param>
			/// <returns></returns>
			internal static AndExpressionGroup<TSource> Begin(IEvaluate<TSource> expression)
			{
				return new AndExpressionGroup<TSource>(expression is TruthyExpressionWrapper<TSource> ? ((TruthyExpressionWrapper<TSource>)expression).Inner : expression);
			}

			public override bool Evaluate(TSource source)
			{
				foreach (IEvaluate<TSource> expr in Expressions)
					if (!JavaScriptHelpers.IsTruthy(expr.Evaluate(source)))
						return false;

				return true;
			}
		}

		#endregion
	}
}
