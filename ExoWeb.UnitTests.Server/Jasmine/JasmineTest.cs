using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Diagnostics;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.Text.RegularExpressions;

namespace ExoWeb.UnitTests.Server.Jasmine
{
	[TestClass]
	public abstract class JasmineTest
	{
		private static Regex suiteParser = new Regex("Suite\\:\\s*\\\"(?<suite>[^\"]*)\\\"\\s*=*\\s*(?:Running\\s*\\\"(?<test>[^\\r\\n]*)\\\"...\\s*\\-*\\s*)*suite\\s*(?<result>[^\\r\\n]*)\\s*=*\\s*", RegexOptions.Compiled | RegexOptions.Multiline | RegexOptions.CultureInvariant);
		private static Regex resultsParser = new Regex("(?<total>\\d*)\\s*spec(?:s?),\\s*(?<failures>\\d*)\\sfailure(?:s?)", RegexOptions.Compiled | RegexOptions.Multiline | RegexOptions.CultureInvariant);
		private static Regex suiteSplit = new Regex("\r\n\r\n");

		protected internal JasmineTest(string basePath)
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
		}

		protected string RunCommand(string executable, string arguments, out string error)
		{
			ProcessStartInfo info = new ProcessStartInfo(executable, arguments);
			info.UseShellExecute = false;
			info.CreateNoWindow = true;
			info.WorkingDirectory = ConfigurationManager.AppSettings["SolutionRoot"];
			info.RedirectStandardOutput = true;
			info.RedirectStandardInput = true;
			info.RedirectStandardError = true;

			var process = Process.Start(info);
			var output = process.StandardOutput.ReadToEnd();

			error = process.StandardError.ReadToEnd();

			return output;
		}

		protected void RunSpec(string path)
		{
			string error;
			string fullPath = Path.Combine(ConfigurationManager.AppSettings["SolutionRoot"], BasePath, path);
			string result = RunCommand("node", fullPath, out error).Replace("\n", "\r\n");

			foreach (string suite in suiteSplit.Split(result))
			{
				if (suiteParser.IsMatch(suite))
				{
					var match = suiteParser.Match(suite);
					string name = match.Groups["suite"].Value;
					Log.Write("Suite: {0}", name);
					foreach(Capture capture in match.Groups["test"].Captures)
						Log.Write("\t{0}\n\n", capture.Value);
				}
			}

			if (resultsParser.IsMatch(result))
			{
				var resultMatch = resultsParser.Match(result);
				int failed = int.Parse(resultMatch.Groups["failures"].Value);
				int total = int.Parse(resultMatch.Groups["total"].Value);

				if (failed > 0)
					throw new ApplicationException(string.Format("{0} out of {1} tests failed.", failed, total));
				else
					Log.Write("All tests passed");
			}
			else if (!string.IsNullOrEmpty(error))
				throw new ApplicationException(string.Format("Errors: {0}", error));
			else
				throw new ApplicationException(string.Format("Results not found: {0}", result));
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
