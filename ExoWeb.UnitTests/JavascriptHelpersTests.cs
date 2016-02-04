using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;
using ExoWeb.Templates.JavaScript;

namespace ExoWeb.UnitTests
{
	[TestClass]
	public class JavascriptHelpersTests
	{
		[TestMethod]
		public void Truthiness()
		{
			Assert.IsFalse(JavaScriptHelpers.IsTruthy(null), "Null is not truthy.");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy(this), "Non-null object is truthy.");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy(true), "Boolean value of true is truthy.");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy(false), "Boolean value of false is not truthy.");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((sbyte)42), "Non-zero sbyte value is truthy");
			Assert.IsTrue(JavaScriptHelpers.IsTruthy((sbyte)-42), "Non-zero sbyte value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((sbyte)0), "Zero sbyte value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((byte)42), "Non-zero byte value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((byte)0), "Zero byte value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((char)0), "Char value is truthy.");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((short)42), "Non-zero short value is truthy");
			Assert.IsTrue(JavaScriptHelpers.IsTruthy((short)-42), "Non-zero short value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((short)0), "Zero short value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((ushort)42), "Non-zero ushort value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((ushort)0), "Zero ushort value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((int)42), "Non-zero int value is truthy");
			Assert.IsTrue(JavaScriptHelpers.IsTruthy((int)-42), "Non-zero int value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((int)0), "Zero int value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((uint)42), "Non-zero uint value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((uint)0), "Zero uint value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((long)42), "Non-zero long value is truthy");
			Assert.IsTrue(JavaScriptHelpers.IsTruthy((long)-42), "Non-zero long value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((long)0), "Zero long value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((ulong)42), "Non-zero ulong value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((ulong)0), "Zero ulong value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((float)42), "Non-zero float value is truthy");
			Assert.IsTrue(JavaScriptHelpers.IsTruthy((float)-42), "Non-zero float value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((float)0), "Zero float value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((double)42), "Non-zero double value is truthy");
			Assert.IsTrue(JavaScriptHelpers.IsTruthy((double)-42), "Non-zero double value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((double)0), "Zero double value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((decimal)42), "Non-zero decimal value is truthy");
			Assert.IsTrue(JavaScriptHelpers.IsTruthy((decimal)-42), "Non-zero decimal value is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((decimal)0), "Zero decimal value is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy("42"), "Non-zero length string is truthy");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy(""), "Zero length string is not truthy");

			Assert.IsTrue(JavaScriptHelpers.IsTruthy((bool?)true), "Nullable values' truthiness is based on the actual value if they do not have a value assigned.");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((bool?)false), "Nullable values' truthiness is based on the actual value if they do not have a value assigned.");
			Assert.IsFalse(JavaScriptHelpers.IsTruthy((char?)null), "Nullable values are not truthy if they do not have a value assigned.");
		}

		[TestMethod]
		public void ParseConstant()
		{
			object result;

			JavaScriptHelpers.ParseConstant("'this'").Should().Be("this");
			JavaScriptHelpers.ParseConstant("5").Should().Be(5);
			JavaScriptHelpers.ParseConstant("0.25").Should().Be(0.25);
			JavaScriptHelpers.ParseConstant("true").Should().Be(true);
			JavaScriptHelpers.ParseConstant("false").Should().Be(false);

			JavaScriptHelpers.TryParseConstant("0.25", out result).Should().Be(true);
			JavaScriptHelpers.TryParseConstant("false", out result).Should().Be(true);
			JavaScriptHelpers.TryParseConstant("xi0", out result).Should().Be(false);
			JavaScriptHelpers.TryParseConstant("'unbalanced", out result).Should().Be(false);
		}
	}
}
