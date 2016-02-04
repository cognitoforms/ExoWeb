using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Jasmine
{
	[TestClass]
	public class ViewSpecTests : BaseJasmineSpecTests
	{
		public ViewSpecTests() : base("..\\ExoWeb\\Client\\specs\\base\\view") { }

		[TestMethod]
		public void BindingSpecs()
		{
			RunSpec("BindingSpecs.js");
		}
	}
}
