using System;
using System.Linq;
using ExoModel;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests
{
	public partial class JavaScriptExpressionTranslatorTests
	{
		JavaScriptExpressionTranslator translator;

		[TestInitialize]
		public void InitializeTranslator()
		{
			translator = new JavaScriptExpressionTranslator();

			CreateDateParseLocale();
			CreateDateLocaleFormat();

			CreateNumberLocaleFormat();
		}

		[TestCleanup]
		public void Cleanup()
		{
			translator = null;
		}

		/// <summary>
		/// Parses the specified expression and verifies that both the computed path and expected results are achieved
		/// </summary>
		void TestExpression<TRoot, TResult>(TRoot instance, string expression, TResult expectedValue, string expectedPath)
		{
			// Get the corresponding model type
			var type = typeof(TRoot).GetModelType();

			// Use the type to parse the model expression
			var exp = type.GetExpression<TResult>(expression);

			// Ensure the computed path is correct
			Assert.AreEqual(expectedPath, exp.Path.Path);

			// Ensure the expression yields the correct value
			if (exp.Expression.Parameters.Count == 0)
				Assert.AreEqual(expectedValue, exp.Expression.Compile().DynamicInvoke());
			else
				Assert.AreEqual(expectedValue, exp.Expression.Compile().DynamicInvoke(instance));

			// Convert the expression to javascript
			var translation = translator.Translate(exp.Expression);
			if (translation.Exceptions.Count > 0)
				throw translation.Exceptions.First();

			// Invoke the javascript expression
			var js = "function (x) { " + translation.Exports.Aggregate("", (exports, export) => exports += export.Key + "=" + export.Value + ";") + " return (" + translation.Function + ").call(x);}(x)";
			var f = Accessors.CreateScriptFunction("x", js);
			var result = f(type.GetModelInstance(instance));
			if (typeof(TResult) == typeof(string))
				result = String.Concat(result);
			else if (typeof(TResult) == typeof(DateTime))
				result = ((Jurassic.Library.DateInstance)f(type.GetModelInstance(instance))).Value;
			else
				result = Convert.ChangeType(f(type.GetModelInstance(instance)), typeof(TResult));

			if (typeof(TResult) == typeof(DateTime))
			{
				// Jurassic automatically converts to UTC but in reality we always convert to LocalTime on the client
				DateTime resultDate = (DateTime)Convert.ChangeType(result, typeof(DateTime));
				var expectedDate = (DateTime)(object)expectedValue;
				Assert.AreEqual(new DateTime(expectedDate.Ticks, DateTimeKind.Local), resultDate.ToLocalTime());
			}
			else
			{
				// Verify that the javascript expression evaluated to the correct result
				Assert.AreEqual(expectedValue, result);
			}
		}

		private static void CreateDateLocaleFormat()
		{
			var createLocaleFormat = Accessors.CreateScriptFunction("o",
				@"(function() {
					Date.prototype.localeFormat = function (format) {
						var date = this;

						if (format === 'd') {
							return (date.getMonth() + 1) + '/' + date.getDate() + '/' + (1900 + date.getYear()).toString();
						}

						if (format.indexOf('/') > 0) {
							var parts = format.split('/');
							if (parts.every(function(p) { return p === 'M' || p === 'MM' || p === 'd' || p === 'dd' || p === 'yyyy'; })) {
								return parts.map(function(p) {
									if (p === 'M') {
										return (date.getMonth() + 1).toString();
									} else if (p === 'MM') {
										return (date.getMonth() < 9 ? '0' : '') + (date.getMonth() + 1).toString();
									} else if (p === 'd') {
										return date.getDate().toString();
									} else if (p === 'dd') {
										return (date.getDate() < 10 ? '0' : '') + date.getDate().toString();
									} else if (p === 'yyyy') {
										return (1900 + date.getYear()).toString();
									}
								}).join('/');
							}
						}

						throw new Error(""Date format '"" + format + ""' is not supported."");
					};
				}())");

			createLocaleFormat(true);
		}

		private static void CreateDateParseLocale()
		{
			var createParseLocale = Accessors.CreateScriptFunction("o",
				@"(function() {
					Date.parseLocale = function (s) {
						var slashParts = s.split('/');
						if (slashParts.length === 3) {
							return new Date(parseInt(slashParts[2], 10), parseInt(slashParts[0], 10) - 1, parseInt(slashParts[1], 10));
						}

						throw new Error(""Date '"" + s + ""' could not be parsed."");
					};
				}())");

			createParseLocale(true);
		}

		private static void CreateNumberLocaleFormat()
		{
			var createLocaleFormat = Accessors.CreateScriptFunction("o",
				@"(function() {
					Number.prototype.localeFormat = function (format) {
						if (format === 'g') {
							return this.toString();
						}
						if (format === 'C') {
							return '$' + this.toFixed(2).toString();
						}

						throw new Error(""Number format '"" + format + ""' is not supported."");
					};
				}())");

			createLocaleFormat(true);
		}
	}
}
