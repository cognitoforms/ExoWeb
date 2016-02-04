using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Templates.MicrosoftAjax
{
	[TestClass]
	public class AttributeHelperTests
	{
		[TestMethod]
		public void CssStyles()
		{
			var value = "margin-top: 0; display:none; padding:0";

			Assert.IsTrue(AttributeHelper.HasCssStyle(value, "display"));
			Assert.IsTrue(AttributeHelper.HasCssStyle(value, "margin-top"));
			Assert.IsTrue(AttributeHelper.HasCssStyle(value, "padding"));
			Assert.IsFalse(AttributeHelper.HasCssStyle(value, "margin"));

			value = AttributeHelper.EnsureCssStyle(value, "margin", "0");
			Assert.IsTrue(AttributeHelper.HasCssStyle(value, "display"));
			Assert.IsTrue(AttributeHelper.HasCssStyle(value, "margin-top"));
			Assert.IsTrue(AttributeHelper.HasCssStyle(value, "padding"));
			Assert.IsTrue(AttributeHelper.HasCssStyle(value, "margin"));
		}

		[TestMethod]
		public void ClassNames()
		{
			var value = "aa aaa aaaa";

			Assert.IsFalse(AttributeHelper.HasClassName(value, "a"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaa"));
			Assert.IsFalse(AttributeHelper.HasClassName(value, "aaaaa"));

			value = AttributeHelper.EnsureClassName(value, "aaaaa");
			Assert.IsFalse(AttributeHelper.HasClassName(value, "a"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaaa"));

			value = AttributeHelper.RemoveClassName(value, "aaa");
			Assert.IsFalse(AttributeHelper.HasClassName(value, "a"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aa"));
			Assert.IsFalse(AttributeHelper.HasClassName(value, "aaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaaa"));

			value = AttributeHelper.RemoveClassName(value, "aa");
			Assert.IsFalse(AttributeHelper.HasClassName(value, "a"));
			Assert.IsFalse(AttributeHelper.HasClassName(value, "aa"));
			Assert.IsFalse(AttributeHelper.HasClassName(value, "aaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaaa"));

			value = AttributeHelper.RemoveClassName(value, "aaaaa");
			Assert.IsFalse(AttributeHelper.HasClassName(value, "a"));
			Assert.IsFalse(AttributeHelper.HasClassName(value, "aa"));
			Assert.IsFalse(AttributeHelper.HasClassName(value, "aaa"));
			Assert.IsTrue(AttributeHelper.HasClassName(value, "aaaa"));
			Assert.IsFalse(AttributeHelper.HasClassName(value, "aaaaa"));
		}
	}
}
