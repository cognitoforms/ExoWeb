using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Collections.Generic;
using System.Collections;

namespace ExoWeb.UnitTests.Server.Templates.MicrosoftAjax
{
	[TestClass]
	public class AttributeHelperTest
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

		string orderedClassNames(string value)
		{
			return string.Join(" ", value.Split(' ').OrderBy(n => n).ToArray());
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
