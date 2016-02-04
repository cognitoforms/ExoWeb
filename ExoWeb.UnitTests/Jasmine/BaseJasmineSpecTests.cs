using System;
using System.IO;
using System.Diagnostics;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.Reflection;
using System.Text.RegularExpressions;

namespace ExoWeb.UnitTests.Jasmine
{
	[TestClass]
	public abstract class BaseJasmineSpecTests
	{
		private static Regex suiteParser = new Regex("Suite\\:\\s*\\\"(?<suite>[^\"]*)\\\"\\s*=*\\s*(?:Running\\s*\\\"(?<test>[^\\r\\n]*)\\\"...\\s*\\-*\\s*)*suite\\s*(?<result>[^\\r\\n]*)\\s*=*\\s*", RegexOptions.Compiled | RegexOptions.Multiline | RegexOptions.CultureInvariant);
		private static Regex resultsParser = new Regex("(?<total>\\d*)\\s*spec(?:s?),\\s*(?<failures>\\d*)\\sfailure(?:s?)", RegexOptions.Compiled | RegexOptions.Multiline | RegexOptions.CultureInvariant);
		private static Regex suiteSplit = new Regex("\r\n\r\n");

		protected internal BaseJasmineSpecTests(string basePath)
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

		private static String GetProjectDirectory(Assembly assembly = null)
		{
			if (assembly == null)
				assembly = Assembly.GetEntryAssembly() ?? Assembly.GetExecutingAssembly();

			string projectDirectory;

			//var webCtx = HttpContext.Current;
			//if (webCtx != null)
			//	projectDirectory = webCtx.Server.MapPath("~");
			//else
			//{

			var assemblyDirectory = Path.GetDirectoryName(new Uri(assembly.CodeBase).AbsolutePath);
			if (assemblyDirectory == null)
				throw new Exception("Could not determine the location of assembly '" + assembly.GetName().Name + "'.");

			var assemblyDirectoryName = Path.GetFileName(assemblyDirectory);
			var assemblyParentDirectory = Path.GetDirectoryName(assemblyDirectory);
			var assemblyParentDirectoryName = Path.GetFileName(assemblyParentDirectory);

			if (assemblyParentDirectoryName == "bin")
			{
				// i.e. "\bin\Debug\*.dll"
				projectDirectory = Path.GetDirectoryName(assemblyParentDirectory);
			}
			else if (assemblyDirectoryName == "bin")
			{
				// i.e. "\bin\*.dll"
				projectDirectory = assemblyParentDirectory;
			}
			else
			{
				var assemblyGrandparentDirectory = Path.GetDirectoryName(assemblyParentDirectory);
				var assemblyGrandparentDirectoryName = Path.GetFileName(assemblyGrandparentDirectory);

				if (assemblyDirectoryName == "Out" && assemblyGrandparentDirectoryName == "TestResults")
				{
					// \TestResults\Deploy_username yyyy-MM-dd hh_mm_ss\Out\*.dll
					var appDirectory = Path.GetDirectoryName(assemblyGrandparentDirectory);
					if (appDirectory == null)
						throw new Exception("Found test files in unexpected location '" + assemblyDirectory + "'.");

					projectDirectory = Path.Combine(appDirectory, assembly.GetName().Name);
				}
				else
					throw new Exception("Executing assembly in unexpected location '" + assemblyDirectory + "'.");
			}

			if (projectDirectory == null)
				throw new Exception("Could not determine location of project for assembly '" + assembly.GetName().Name + "' executing from '" + assemblyDirectory + "'.");

			//}

			return projectDirectory;
		}

		protected void RunSpec(string path)
		{
			var projectDirectory = GetProjectDirectory();

			string error;
			string fullPath = Path.Combine(projectDirectory, BasePath, path);
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
