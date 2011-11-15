using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public class Mapper : JasmineTest
	{
		public Mapper() : base("ExoWeb\\Client\\specs\\base\\mapper") { }

		[TestMethod]
		public void ChangeLog()
		{
			RunSpec("test_ChangeLog.js");
		}

		[TestMethod]
		public void ChangeSet()
		{
			RunSpec("test_ChangeSet.js");
		}

		[TestMethod]
		public void ResponseHandler()
		{
			RunSpec("test_ResponseHandler.js");
		}
	}
}
