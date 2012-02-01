using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server.QUnit
{
	[TestClass]
	public class QUnit_UI : QUnitTest
	{
		public QUnit_UI() : base("UI") { }

		[TestMethod]
		public void DataViewPartial()
		{
			TestPage("DataViewPartial.htm");
		}

		[TestMethod]
		public void Helpers()
		{
			TestPage("Helpers.htm");
		}

		[TestMethod]
		public void ServerRender()
		{
			TestPage("ServerRender.htm");
		}

		[TestMethod]
		public void ServerRenderAbort()
		{
			TestPage("ServerRenderAbort.htm");
		}

		[TestMethod]
		public void ServerRenderToggle()
		{
			TestPage("ServerRenderToggle.htm");
		}

		[TestMethod]
		public void TemplateSelection()
		{
			TestPage("TemplateSelection.htm");
		}
	}
}
