using System;
using System.Collections.Generic;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Templates.JavaScript
{
	[TestClass]
	public class EvaluatorTests
	{
		[TestMethod]
		public void Evaluator_ParseOperators()
		{
			Accessors.ParseLogicalOperator("==").Should().Be("DoubleEqual");
			Accessors.ParseLogicalOperator("!=").Should().Be("NotDoubleEqual");
			Accessors.ParseLogicalOperator("===").Should().Be("TripleEqual");
			Accessors.ParseLogicalOperator("!==").Should().Be("NotTripleEqual");
			Accessors.ParseLogicalOperator(">").Should().Be("GreaterThan");
			Accessors.ParseLogicalOperator(">=").Should().Be("GreaterThanEqual");
			Accessors.ParseLogicalOperator("<").Should().Be("LessThan");
			Accessors.ParseLogicalOperator("<=").Should().Be("LessThanEqual");

			Accessors.ParseLogicalOperator(" == ").Should().Be("DoubleEqual");

			Action singleEqual = () => Accessors.ParseLogicalOperator("=");
			singleEqual.ShouldThrow<Exception>().WithMessage("The \"=\" operator is not a logical operator.");

			Action whitespaceThatCannotBeTrimmed = () => Accessors.ParseLogicalOperator(" = =");
			whitespaceThatCannotBeTrimmed.ShouldThrow<Exception>().WithMessage("Unknown operator \" = =\".");
		}

		private static IDictionary<string, object> EvaluatorSource()
		{
			return new Dictionary<string, object>
			{
				{
					"Name",
					"Pepsi"
				},
				{
					"IsAvailable",
					true
				},
				{
					"Company",
					new Dictionary<string, object>
					{
						{
							"Name",
							"Pepsi Co"
						},
						{
							"IsActive",
							true
						},
						{
							"Founded",
							new DateTime(1898, 1, 1)
						}
					}
				}
			};
		}

		private static bool Evaluate(string expression)
		{
			return Accessors.EvaluateLogicalExpression(expression, EvaluatorSource());
		}

		[TestMethod]
		public void Evaluator_TrueProperty()
		{
			Evaluate("IsAvailable").Should().Be(true);
		}

		[TestMethod]
		public void Evaluator_TruthyProperty()
		{
			Evaluate("Name").Should().Be(true);
		}

		[TestMethod]
		public void Evaluator_TruthyPath()
		{
			Evaluate("Company.Founded").Should().Be(true);
		}

		[TestMethod]
		public void Evaluator_TruePath()
		{
			Evaluate("Company.IsActive").Should().Be(true);
		}

		[TestMethod]
		public void Evaluator_EqualString()
		{
			Evaluate("Company.Name === 'Pepsi Co'").Should().Be(true);
			Evaluate("Company.Name === 'Coca Cola'").Should().Be(false);
		}

		[TestMethod]
		public void Evaluator_NotEqualString()
		{
			Evaluate("Company.Name !== 'Coca Cola'").Should().Be(true);
			Evaluate("Company.Name !== 'Pepsi Co'").Should().Be(false);
		}

		[TestMethod]
		public void Evaluator_UnsupportedOperators()
		{
			Action doubleEquals = () => Evaluate("Company.Name == 'Pepsi Co'");
			doubleEquals.ShouldThrow<Exception>().WithMessage("The == operator is not supported.");

			Action notDoubleEquals = () => Evaluate("Company.Name != 'Coca Cola'");
			notDoubleEquals.ShouldThrow<Exception>().WithMessage("The != operator is not supported.");

			Evaluate("Company.Name !== 'Pepsi Co'").Should().Be(false);
		}

		[TestMethod]
		public void Evaluator_XAndY()
		{
			Evaluate("Company.Name === 'Pepsi Co' && Company.IsActive").Should().Be(true);
			Evaluate("Company.Name !== 'Coca Cola' && Company.IsActive === true").Should().Be(true);
			Evaluate("Company.Name === 'Coca Cola' && Company.IsActive").Should().Be(false);
			Evaluate("Company.Name === 'Pepsi Co' && Company.IsActive === false").Should().Be(false);
		}

		[TestMethod]
		public void Evaluator_ImplicitGrouping()
		{
			Evaluate("Company.Founded || Company.IsActive && Company.Name === 'Coca Cola'").Should().Be(true);
			Evaluate("Company.Founded && Company.IsActive || Company.Name === 'Coca Cola'").Should().Be(true);
			Evaluate("Company.Founded && Company.IsActive === false || Company.Name === 'Coca Cola'").Should().Be(false);
			Evaluate("Company.Founded && Company.IsActive === false || Company.Name === 'Pepsi Co'").Should().Be(true);
		}

		[TestMethod]
		public void Evaluator_ExplicitGrouping()
		{
			Evaluate("Company.Name && (IsAvailable || Company.IsActive === false)").Should().Be(true);
			Evaluate("(Company.Name || IsAvailable) && Company.IsActive === false").Should().Be(false);
			Evaluate("(Company.Name || IsAvailable) && Company.IsActive").Should().Be(true);
			Evaluate("((Company.Name || IsAvailable) && true) || Company.IsActive === false").Should().Be(true);
			Evaluate("(false && (Company.Name || IsAvailable)) || Company.IsActive === false").Should().Be(false);
		}

		[TestMethod]
		public void Evaluator_UnmatchedParens()
		{
			Action unmatchedParens = () => Evaluate("Company.Name && IsAvailable || Company.IsActive === false)");
			unmatchedParens.ShouldThrow<Exception>().WithMessage("Invalid expression \"Company.Name && IsAvailable || Company.IsActive === false)\".");
		}
	}
}
