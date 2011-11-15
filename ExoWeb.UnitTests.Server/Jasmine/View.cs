using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class View : JasmineTest
	{
		public View() : base("ExoWeb\\Client\\specs\\base\\view") { }

		[TestMethod]
		public void Binding()
		{
			RunSpec("test_Binding.js");
		}
	}
}
