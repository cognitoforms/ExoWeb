using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class Jasmine_Model : JasmineTest
	{
		public Jasmine_Model() : base("ExoWeb\\Client\\specs\\base\\model") { }

		[TestMethod]
		public void Formats()
		{
			RunSpec("test_Formats.js");
		}

		[TestMethod]
		public void PathTokens()
		{
			RunSpec("test_PathTokens.js");
		}
	}
}
