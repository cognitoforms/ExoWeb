using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Diagnostics;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.Text.RegularExpressions;
using WatiN.Core;
using WatiN.Core.Native.Windows;

namespace ExoWeb.UnitTests.Server.QUnit
{
	[TestClass]
	public abstract class QUnitTest
	{
		private IE _ie;

		protected internal QUnitTest(string basePath)
		{
			this.BasePath = basePath;
		}

		public TestContext TestContext { get; set; }

		internal protected TestContextLog Log { get; private set; }

		internal protected string BasePath { get; private set; }

		[TestInitialize]
		public void BeforeTest()
		{
			Log = new TestContextLog(TestContext);
			_ie = new IE();
			_ie.ShowWindow(NativeMethods.WindowShowStyle.Hide);
		}

		protected void TestPage(string page)
		{
			_ie.GoTo(string.Format("{0}/{1}/{2}", ConfigurationManager.AppSettings["QUnitAppRootUrl"], BasePath, page));
			_ie.WaitForComplete(5);

			AssertQUnitTestResults();
		}

		private void AssertQUnitTestResults()
		{
			var liElements = _ie.ElementsWithTag("li").Filter(x => x.Parent.Id == "qunit-tests");
			foreach (var liElement in liElements)
			{
				Assert.IsTrue(liElement.ClassName == "pass", liElement.DomContainer.ElementsWithTag("strong")[0].Text);
				Log.Write(liElement.Text);
			}
		}

		public class TestContextLog
		{
			DateTime startTime;
			TestContext testContext;

			internal TestContextLog(TestContext testContext)
			{
				this.testContext = testContext;
				startTime = DateTime.Now;
			}

			/// <summary>
			/// Writes a timestamped message to the log associated with this test run
			/// </summary>
			public void Write(string messageFormat, params object[] args)
			{
				string str = string.Format(string.Format("[{0}] ", DateTime.Now - startTime) + messageFormat, args);

				// Escape braces since message will be string formatted
				testContext.WriteLine(str.Replace("{", "{{").Replace("}", "}}"));

				Debug.WriteLine(str);
			}
		}
	}
}
