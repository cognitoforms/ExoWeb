using System;
using System.IO;
using System.Linq;
using ExoWeb.Templates.MicrosoftAjax;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace ExoWeb.UnitTests.Server
{
	/// <summary>
	///This is a test class for ExoWebTest and is intended
	///to contain all ExoWebTest Unit Tests
	///</summary>
	[TestClass()]
	public class ExoWebTest
	{
		[TestMethod]
		public void ParseTemplate()
		{
			var templates =
				Directory.GetFiles(@"C:\Users\thomasja\Projects\VC3.TestView\Mainline\VC3.TestView.WebUI\Common\templates", "*.htm").Union(
				Directory.GetFiles(@"C:\Users\thomasja\Projects\VC3.TestView\Mainline\VC3.TestView.WebUI\Common\templates\sections", "*.htm"))
				.Where(p => !p.Contains("Reports.htm"))
				.SelectMany(p => Template.Load(p));

			foreach (var template in templates)
				Console.WriteLine(template);
		}
	}
}
