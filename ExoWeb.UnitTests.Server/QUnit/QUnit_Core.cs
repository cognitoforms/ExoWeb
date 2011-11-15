using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.QUnit
{
	[TestClass]
	public class QUnit_Core : QUnitTest
	{
		public QUnit_Core() : base("Core") { }

		[TestMethod]
		public void Batch()
		{
			TestPage("Batch.htm");
		}

		[TestMethod]
		public void Copy()
		{
			TestPage("Copy.htm");
		}

		[TestMethod]
		public void Observers()
		{
			TestPage("Observers.htm");
		}

		[TestMethod]
		public void Transform()
		{
			TestPage("Transform.htm");
		}
	}
}
