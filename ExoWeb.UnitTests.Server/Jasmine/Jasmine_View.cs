using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class Jasmine_View : JasmineTest
	{
		public Jasmine_View() : base("ExoWeb\\Client\\specs\\base\\view") { }

		[TestMethod]
		public void Binding()
		{
			RunSpec("test_Binding.js");
		}
	}
}
