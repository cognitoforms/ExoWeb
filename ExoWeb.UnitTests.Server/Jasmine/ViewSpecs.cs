using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class ViewSpecs : JasmineTest
	{
		public ViewSpecs() : base("ExoWeb\\Client\\specs\\base\\view") { }

		[TestMethod]
		public void BindingSpecs()
		{
			RunSpec("BindingSpecs.js");
		}
	}
}
