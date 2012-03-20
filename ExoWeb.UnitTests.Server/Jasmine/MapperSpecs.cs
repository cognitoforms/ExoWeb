using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class MapperSpecs : JasmineTest
	{
		public MapperSpecs() : base("ExoWeb\\Client\\specs\\base\\mapper") { }

		[TestMethod]
		public void ChangeLogSpecs()
		{
			RunSpec("ChangeLogSpecs.js");
		}

		[TestMethod]
		public void ChangeSetSpecs()
		{
			RunSpec("ChangeSetSpecs.js");
		}

		[TestMethod]
		public void ResponseHandlerSpecs()
		{
			RunSpec("ResponseHandlerSpecs.js");
		}
	}
}
