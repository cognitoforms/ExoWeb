using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class ModelSpecs : JasmineTest
	{
		public ModelSpecs() : base("ExoWeb\\Client\\specs\\base\\model") { }

		[TestMethod]
		public void FormatsSpecs()
		{
			RunSpec("FormatsSpecs.js");
		}

		[TestMethod]
		public void PathTokensSpecs()
		{
			RunSpec("PathTokensSpecs.js");
		}
	}
}
