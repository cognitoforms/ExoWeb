using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.QUnit
{
	[TestClass]
	public class UiQUnitTests : BaseQUnitTests
	{
		public UiQUnitTests() : base("UI") { }

		//[TestMethod]
		public void DataViewPartial()
		{
			TestPage("DataViewPartial.htm");
		}

		//[TestMethod]
		public void Helpers()
		{
			TestPage("Helpers.htm");
		}

		//[TestMethod]
		public void ServerRender()
		{
			TestPage("ServerRender.htm");
		}

		//[TestMethod]
		public void ServerRenderAbort()
		{
			TestPage("ServerRenderAbort.htm");
		}

		//[TestMethod]
		public void ServerRenderToggle()
		{
			TestPage("ServerRenderToggle.htm");
		}

		//[TestMethod]
		public void TemplateSelection()
		{
			TestPage("TemplateSelection.htm");
		}
	}
}
