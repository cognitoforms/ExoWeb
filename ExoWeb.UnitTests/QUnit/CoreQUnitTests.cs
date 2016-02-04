using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.QUnit
{
	[TestClass]
	public class CoreQUnitTests : BaseQUnitTests
	{
		public CoreQUnitTests() : base("Core") { }

		//[TestMethod]
		public void Batch()
		{
			TestPage("Batch.htm");
		}

		//[TestMethod]
		public void Copy()
		{
			TestPage("Copy.htm");
		}

		//[TestMethod]
		public void Observers()
		{
			TestPage("Observers.htm");
		}

		//[TestMethod]
		public void Transform()
		{
			TestPage("Transform.htm");
		}
	}
}
