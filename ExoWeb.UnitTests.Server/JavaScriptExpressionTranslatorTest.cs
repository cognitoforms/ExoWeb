using System;
using System.Text;
using System.Collections.Generic;
using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ExoModel;
using ExoModel.UnitTest.Models.Movies;
using FluentAssertions;

namespace ExoWeb.UnitTests.Server
{
	/// <summary>
	/// Tests all aspects of the <see cref="JavaScriptExpressionTranslator"/>.
	/// </summary>
	[TestClass]
	public class JavaScriptExpressionTranslatorTest
	{
		JavaScriptExpressionTranslator translator;
		Jurassic.ScriptEngine engine;

		[TestInitialize]
		public void Initialize()
		{
			Model.InitializeTestModel();
			translator = new JavaScriptExpressionTranslator();
			engine = new Jurassic.ScriptEngine();
			//engine.ExecuteFile("");
		}

		[TestCleanup]
		public void Cleanup()
		{
			translator = null;
			engine = null;
		}

		/// <summary>
		/// Tests the use of list properties and methods when used in expressions.
		/// </summary>
		[TestMethod]
		public void TestListExpressions()
		{
			// Get the Robin Hood movie
			var movie = Movie.All.First(m => m.Name == "Robin Hood");

			// Count method
			TestExpression(movie, "Roles.Count()", 3, "Roles");
		}

		/// <summary>
		/// Tests the use of intrinsic <see cref="Boolean"/> methods when used in expressions.
		/// </summary>
		[TestMethod]
		public void TestBooleanExpressions()
		{
			// Get the Robin Hood movie
			var movie = Movie.All.First(m => m.Name == "Robin Hood");

			// Boolean Boolean.Equals(Boolean)
			TestExpression(movie, "Roles.Where(Star.Equals(True)).Count()", 3, "Roles.Star");

			// Boolean Boolean.Equals(Object)
			TestExpression(movie, "Roles.Where(Star.Equals(\"True\")).Count()", 0, "Roles.Star");

			// Boolean Boolean.Parse(String)
			TestExpression(movie, "Roles.Where(Star.Equals(Boolean.Parse(\"True\"))).Count()", 3, "Roles.Star");

			// Number Boolean.CompareTo(Boolean)
			TestExpression(movie, "Roles.Where(Star.CompareTo(True) = 0 and Lead.CompareTo(False) > 0).Count()", 1, "Roles{Star,Lead}");
			TestExpression(movie, "Roles.Where(Star.CompareTo(True) = 0 and Lead.CompareTo(True) < 0).Count()", 2, "Roles{Star,Lead}");

			// Number Boolean.CompareTo(Object)
			TestExpression(movie, "Roles.Where(Star.CompareTo(True) = 0 and Lead.CompareTo(null) > 0).Count()", 3, "Roles{Star,Lead}");

			// String Boolean.ToString()
			TestExpression(movie, "Roles.Where(Star.ToString() = \"True\").Count()", 3, "Roles.Star");
		}

		/// <summary>
		/// Tests the use of intrinsic <see cref="DateTime"/> methods when used in expressions.
		/// </summary>
		/// Note: Jurassic does not support DateTime model references so must
		/// create a instance of DateTime on the client (using Parse method)
		[TestMethod]
		public void TestDateTimeExpressions()
		{
			// Get the Robin Hood movie
			var movie = Movie.All.First(m => m.Name == "Robin Hood");
			var local = TimeZoneInfo.Local.GetUtcOffset(DateTime.UtcNow);
			String time = "T11:15:45" + local.Hours.ToString("00") + ":" + local.Minutes.ToString("00");

			// Boolean DateTime.Equals(DateTime, DateTime)
			TestExpression(movie, @"DateTime.Equals(DateTime.Parse(""10/30/1991""), DateTime.Parse(""10/30/1991""))", true, "");
			TestExpression(movie, @"DateTime.Equals(DateTime.Parse(""10/30/1991""), DateTime.Parse(""10/31/1991""))", false, "");

			// Boolean DateTime.IsLeapYear(Number)
			TestExpression(movie, @"DateTime.IsLeapYear(2008)", true, "");
			TestExpression(movie, @"DateTime.IsLeapYear(2007)", false, "");
			TestExpression(movie, @"DateTime.IsLeapYear(1900)", false, "");

			// DateTime DateTime.Now - Cannot accurately test
			
			// DateTime.Parse(String)
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"")", new DateTime(1991, 10, 30, 0, 0, 0, DateTimeKind.Local), "");
			TestExpression(movie, @"DateTime.Parse(""October 30, 1991"")", new DateTime(1991, 10, 30, 0, 0, 0, DateTimeKind.Local), "");
			TestExpression(movie, @"DateTime.Parse(""1991 October 30"")", new DateTime(1991, 10, 30, 0, 0, 0, DateTimeKind.Local), "");
			TestExpression(movie, @"DateTime.Parse(""1991-11-02"")", new DateTime(1991, 11, 02, 0, 0, 0, DateTimeKind.Local), "");
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""")", new DateTime(1991, 10, 30, 11, 15, 45, DateTimeKind.Local), "");

			// DateTime.Today - Careful if test run at midnight
			TestExpression(movie, @"DateTime.Today", DateTime.Today, "");

			// DateTime.UTCNow - Cannot accurately test

			// DateTime DateTime.AddDays(Number)
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").AddDays(1)", new DateTime(1991, 10, 31, 0, 0, 0, DateTimeKind.Local), "");

			// DateTime DateTime.AddHours(Number)
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").AddHours(1)", new DateTime(1991, 10, 30, 12, 15, 45, 0, DateTimeKind.Local), "");

			// DateTime DateTime.AddMilliseconds(Number)
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").AddMilliseconds(1)", new DateTime(1991, 10, 30, 11, 15, 45, 1, DateTimeKind.Local), "");

			// DateTime DateTime.AddMinutes(Number)
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").AddMinutes(1)", new DateTime(1991, 10, 30, 11, 16, 45, 0, DateTimeKind.Local), "");

			// DateTime DateTime.AddMonths(Number)
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").AddMonths(1)", new DateTime(1991, 11, 30, 0, 0, 0, DateTimeKind.Local), "");

			// DateTime DateTime.AddSeconds(Number)
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").AddSeconds(1)", new DateTime(1991, 10, 30, 11, 15, 46, DateTimeKind.Local), "");

			// DateTime DateTime.AddTicks(Number)
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").AddTicks(10000)", new DateTime(1991, 10, 30, 11, 15, 45, 1, DateTimeKind.Local), "");

			// DateTime DateTime.AddYears(Number)
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").AddYears(1)", new DateTime(1992, 10, 30, 0, 0, 0, DateTimeKind.Local), "");

			// Number DateTime.CompareTo(DateTime)
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").CompareTo(DateTime.Parse(""10/30/1991""))", 0, "");
			TestExpression(movie, @"DateTime.Parse(""10/29/1991"").CompareTo(DateTime.Parse(""10/30/1991""))", -1, "");
			TestExpression(movie, @"DateTime.Parse(""11/02/1991"").CompareTo(DateTime.Parse(""10/30/1991""))", 1, "");

			// DateTime DateTime.Date
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").Date", new DateTime(1991, 10, 30, 0, 0, 0, DateTimeKind.Local), "");

			// Number DateTime.Day
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").Day", 30, "");

			// String DateTime.DayOfWeek
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").DayOfWeek", "Wednesday", "");

			// Number DateTime.DayOfYear
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").DayOfYear", 303, "");

			// Number DateTime.Hour
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").Hour", 11, "");

			// Number DateTime.Millisecond
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").Millisecond", 0, "");

			// Number DateTime.Minute
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").Minute", 15, "");

			// Number DateTime.Month
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").Month", 10, "");

			// Number DateTime.Second
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").Second", 45, "");

			// Number DateTime.Ticks
			TestExpression(movie, @"DateTime.Parse(""1991-10-30" + time + @""").Ticks", (long)628244181450000000, "");

			// Number DateTime.Year
			TestExpression(movie, @"DateTime.Parse(""10/30/1991"").Year", 1991, "");
		}

		/// <summary>
		/// Tests the use of intrinsic <see cref="Math"/> methods when used in expressions.
		/// </summary>
		[TestMethod]
		public void TestMathExpressions()
		{
			// Get the Robin Hood movie
			var movie = Movie.All.First(m => m.Name == "Robin Hood");

			// Number Math.Abs(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Abs(-9.25)", 9.25, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Abs(0)", 0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Abs(9.25)", 9.25, "Roles.Lead");

			// Number Math.Acos(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Acos(0.5)", 1.0471975511965979, "Roles.Lead");

			// Number Math.Asin(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Asin(1)", 1.5707963267948966, "Roles.Lead");

			// Number Math.Atan(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Atan(1)", 0.78539816339744828, "Roles.Lead");

			// Number Math.Atan2(Number, Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Atan2(1, 2)", 0.46364760900080609, "Roles.Lead");

			// Number Math.Ceiling(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Ceiling(9.25)", 10.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Ceiling(-9.25)", -9.0, "Roles.Lead");

			// Number Math.Cos(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Cos(1)", 0.54030230586813972, "Roles.Lead");

			// Number Math.Cosh(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Cosh(1)", 1.54308063481524378, "Roles.Lead");

			// Number Math.Exp(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Exp(-9.25)", 0.0000961116520613947, "Roles.Lead");

			// Number Math.Floor(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Floor(9.25)", 9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Floor(-9.25)", -10.0, "Roles.Lead");

			// Number Math.Log(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Log(3)", 1.0986122886681098, "Roles.Lead");

			// Number Math.Log(Number, Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Log(3, 5)", 0.68260619448598536, "Roles.Lead");

			// Number Math.Log10(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Log10(3)", 0.47712125471966244, "Roles.Lead");

			// Number Math.Max(Number, Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Max(-9.25, 9.25)", 9.25, "Roles.Lead");

			// Number Math.Min(Number, Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Min(-9.25, 9.25)", -9.25, "Roles.Lead");

			// Number Math.Pow(Number, Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Pow(4, 2)", 16.0, "Roles.Lead");

			// Number Math.Round(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(9.25)", 9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(9.75)", 10.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(-9.25)", -9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(-9.75)", -10.0, "Roles.Lead");

			// Number Math.Round(Number, Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(-9.254903, 2)", -9.25, "Roles.Lead");

			// Number Math.Sign(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sign(-9.25)", -1, "Roles.Lead");

			// Number Math.Sin(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sin(-9.25)", -0.17388948538043356, "Roles.Lead");

			// Number Math.Sinh(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sinh(3)", 10.017874927409902, "Roles.Lead");

			// Number Math.Sqrt(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sqrt(3)", 1.7320508075688773, "Roles.Lead");

			// Number Math.Tan(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Tan(3)", -0.1425465430742778, "Roles.Lead");

			// Number Math.Tanh(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Tanh(3)", 0.99505475368673045, "Roles.Lead");

			// Number Math.Truncate(Number)
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Truncate(9.25)", 9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Truncate(-9.25)", -9.0, "Roles.Lead");
		}

		/// <summary>
		/// Tests the use of intrinsic <see cref="String"/> methods when used in expressions.
		/// </summary>
		[TestMethod]
		public void TestStringExpressions()
		{
			// Get the Robin Hood movie
			var movie = Movie.All.First(m => m.Name == "Robin Hood");

			// Boolean String.Contains(String)
			TestExpression(movie, @"Name.Contains(""Hood"")", true, "Name");
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");

			// Boolean String.EndsWith(String)
			TestExpression(movie, @"Name.EndsWith(""Hood"")", true, "Name");
			TestExpression(movie, @"Name.EndsWith(""Robin"")", false, "Name");

			// Boolean String.Equals(Object)
			TestExpression(movie, @"Name.Equals(null + ""Robin Hood"")", true, "Name");
			TestExpression(movie, @"Name.Equals(null)", false, "Name");

			// Boolean String.Equals(String)
			TestExpression(movie, @"Name.Equals(""Robin Hood"")", true, "Name");
			TestExpression(movie, @"Name.Equals(""Robin-Hood"")", false, "Name");

			// Boolean String.Equals(String, String)
			TestExpression(movie, @"String.Equals(Name, ""Robin Hood"")", true, "Name");

			// Boolean String.IsNullOrEmpty(String)
			TestExpression(movie, @"String.IsNullOrEmpty("""")", true, "");
			TestExpression(movie, @"String.IsNullOrEmpty(null)", true, "");
			TestExpression(movie, @"String.IsNullOrEmpty(Name)", false, "Name");

			// Boolean String.IsNullOrWhiteSpace(String)
			TestExpression(movie, @"String.IsNullOrWhiteSpace("""")", true, "");
			TestExpression(movie, @"String.IsNullOrWhiteSpace(null)", true, "");
			TestExpression(movie, @"String.IsNullOrWhiteSpace(""   "")", true, ""); // spaces
			TestExpression(movie, @"String.IsNullOrWhiteSpace(""		"")", true, ""); // tabs
			TestExpression(movie, @"String.IsNullOrWhiteSpace(Name)", false, "Name");

			// Boolean String.StartsWith(String)
			TestExpression(movie, @"Name.StartsWith(""Robin"")", true, "Name");
			TestExpression(movie, @"Name.StartsWith(""Hood"")", false, "Name");
			//TestExpression(movie, @"startswith(Name, ""Robin"") eq true", true, "Name"); // odata

			// Number String.Compare(String, Number, String, Number, Number)
			TestExpression(movie, @"String.Compare(Name, 6, ""Hood"", 0, 4)", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, 6, ""hood"", 0, 4)", 1, "Name");
			TestExpression(movie, @"String.Compare(Name, 5, ""Hood"", 0, 4)", -1, "Name");

			// Number String.Compare(String, Number, String, Number, Number, Boolean)
			TestExpression(movie, @"String.Compare(Name, 6, ""hood"", 0, 4, true)", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, 6, ""hood"", 0, 4, false)", 1, "Name");

			// Number String.Compare(String, String)
			TestExpression(movie, @"String.Compare(Name, ""Robin Hood"")", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, ""Marion Loxley"")", 1, "Name");
			TestExpression(movie, @"String.Compare(""Marion Loxley"", Name)", -1, "Name");

			// Number String.Compare(String, String, Boolean)
			TestExpression(movie, @"String.Compare(Name, ""robin hood"", true)", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, ""robin hood"", false)", 1, "Name");

			// Number String.CompareTo(Object)
			TestExpression(movie, @"Name.CompareTo(null)", 1, "Name");

			// Number String.CompareTo(String)
			TestExpression(movie, @"Name.CompareTo(""Robin Hood"")", 0, "Name");
			TestExpression(movie, @"Name.CompareTo(""Marion Loxley"")", 1, "Name");

			// Number String.IndexOf(Char)
			TestExpression(movie, @"Name.IndexOf('H')", 6, "Name");

			// Number String.IndexOf(Char, Number)
			TestExpression(movie, @"Name.IndexOf('o', 3)", 7, "Name");

			// Number String.IndexOf(Char, Number, Number)
			TestExpression(movie, @"Name.IndexOf('o', 3, 3)", -1, "Name");

			// Number String.IndexOf(String)
			TestExpression(movie, @"Name.IndexOf(""Hood"")", 6, "Name");

			// Number String.IndexOf(String, Number)
			TestExpression(movie, @"Name.IndexOf(""o"", 3)", 7, "Name");

			// Number String.IndexOf(String, Number, Number)
			TestExpression(movie, @"Name.IndexOf(""o"", 3, 3)", -1, "Name");

			// Number String.IndexOfAny(Char[])
			TestExpression(movie, @"Name.IndexOfAny(['d','b'])", 2, "Name");

			// Number String.IndexOfAny(Char[], Number)
			TestExpression(movie, @"Name.IndexOfAny(['d','b','o'], 3)", 7, "Name");

			// Number String.IndexOfAny(Char[], Number, Number)
			TestExpression(movie, @"Name.IndexOfAny(['d','b','o'], 3, 3)", -1, "Name");

			// Number String.LastIndexOf(Char)
			TestExpression(movie, @"Name.LastIndexOf('o')", 8, "Name");

			// Number String.LastIndexOf(Char, Number)
			TestExpression(movie, @"Name.LastIndexOf('o', 4)", 1, "Name");

			// Number String.LastIndexOf(Char, Number, Number)
			TestExpression(movie, @"Name.LastIndexOf('0', 4, 3)", -1, "Name");

			// Number String.LastIndexOf(String)
			TestExpression(movie, @"Name.LastIndexOf(""o"")", 8, "Name");

			// Number String.LastIndexOf(String, Number)
			TestExpression(movie, @"Name.LastIndexOf(""o"", 4)", 1, "Name");

			// Number String.LastIndexOf(String, Number, Number)
			TestExpression(movie, @"Name.LastIndexOf(""o"", 4, 3)", -1, "Name");

			// Number String.LastIndexOfAny(Char[])
			TestExpression(movie, @"Name.LastIndexOfAny(['d','b','o'])", 9, "Name");

			// Number String.LastIndexOfAny(Char[], Number)
			TestExpression(movie, @"Name.LastIndexOfAny(['d','b','o'], 6)", 2, "Name");

			// Number String.LastIndexOfAny(Char[], Number, Number)
			TestExpression(movie, @"Name.LastIndexOfAny(['d','b','o'], 8, 3)", 8, "Name");

			// String String.Concat(Object)
			TestExpression(movie, @"String.Concat(8)", "8", "");
			TestExpression(movie, @"String.Concat(null)", "", "");

			// String String.Concat(Object, Object)
			TestExpression(movie, @"String.Concat(Name, 9.75)", "Robin Hood9.75", "Name");

			// String String.Concat(Object, Object, Object)
			TestExpression(movie, @"String.Concat(Name, 9.75, 'P')", "Robin Hood9.75P", "Name");

			// String String.Concat(Object[])
			//	TestExpression(movie, @"String.Concat([Name, 9.75, null, 'P', DateTime(2012, 1, 1)])", "Robin Hood9.75P1/1/2012 12:00:00 AM", "Name");

			// String String.Concat(String, String)
			TestExpression(movie, @"String.Concat(Name, Name)", "Robin HoodRobin Hood", "Name");

			// String String.Concat(String, String, String)
			//	TestExpression(movie, @"String.Concat(Name, 8.ToString(), DateTime(2012, 1, 1).ToString())", "Robin Hood81/1/2012", "Name");

			// String String.Concat(String[])
			//	TestExpression(movie, @"String.Concat([Name, 8.ToString(), DateTime(2012, 1, 1).ToString(), null])", "Robin Hood81/1/2012", "Name");

			// String String.Format(String, Object)
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");

			// String String.Format(String, Object, Object)
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");

			// String String.Format(String, Object, Object, Object)
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");

			// String String.Format(String, Object[])
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");

			// String String.Insert(Number, String)
			TestExpression(movie, @"Name.Insert(0, ""Little Red "")", "Little Red Robin Hood", "Name");

			// String String.Join(String, Object[])
			TestExpression(movie, @"String.Join("","", [null, 8, ""Eight""])", "", "");					// If first value is null, join returns ""
			TestExpression(movie, @"String.Join("","", [8, null, ""Eight""])", "8,,Eight", "");			// Otherwise, null values are ignored
			TestExpression(movie, @"String.Join("","", 8, null, ""Eight"")", "8,,Eight", "");			// Param arrays are supported too

			// String String.Join(String, String[])
			TestExpression(movie, @"String.Join("","", [null, ""8"", ""Eight""])", ",8,Eight", "");		// If first value is null, join returns ""
			TestExpression(movie, @"String.Join("","", [""8"", null, ""Eight""])", "8,,Eight", "");		// Otherwise, null values are ignored
			TestExpression(movie, @"String.Join("","", ""8"", null, ""Eight"")", "8,,Eight", "");		// Param arrays are supported too

			// String String.Join(String, String[], Number, Number)
			TestExpression(movie, @"String.Join("","", [null, ""8"", Name, ""A"", ""B""], 1, 2)", "8,Robin Hood", "Name");

			// String String.PadLeft(Number)
			TestExpression(movie, @"Name.PadLeft(20)", "          Robin Hood", "Name");
			TestExpression(movie, @"Name.PadLeft(10)", "Robin Hood", "Name");
			TestExpression(movie, @"Name.PadLeft(0)", "Robin Hood", "Name");

			// String String.PadLeft(Number, Char)
			TestExpression(movie, @"Name.PadLeft(15, '*')", "*****Robin Hood", "Name");

			// String String.PadRight(Number)
			TestExpression(movie, @"Name.PadRight(20)", "Robin Hood          ", "Name");
			TestExpression(movie, @"Name.PadRight(10)", "Robin Hood", "Name");
			TestExpression(movie, @"Name.PadRight(0)", "Robin Hood", "Name");

			// String String.PadRight(Number, Char)
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");
			TestExpression(movie, @"Name.PadRight(15, '*')", "Robin Hood*****", "Name");

			// String String.Remove(Number)
			TestExpression(movie, @"Name.Remove(5)", "Robin", "Name");

			// String String.Remove(Number, Number)
			TestExpression(movie, @"Name.Remove(2, 7)", "Rod", "Name");

			// String String.Replace(Char, Char)
			TestExpression(movie, @"Name.Replace('o','0')", "R0bin H00d", "Name");

			// String String.Replace(String, String)
			TestExpression(movie, @"Name.Replace(""o"", ""0"")", "R0bin H00d", "Name");
			TestExpression(movie, @"Name.Replace("" "", """")", "RobinHood", "Name");
			TestExpression(movie, @"Name.Replace(""bin"", ""bert"")", "Robert Hood", "Name");

			// String[] String.Split(Char[])
			TestExpression(movie, @"String.Join("","", Name.Split('o', ' '))", "R,bin,H,,d", "Name");
			TestExpression(movie, @"String.Join("","", Name.Split(['o', ' ']))", "R,bin,H,,d", "Name");

			// String[] String.Split(Char[], Number)
			TestExpression(movie, @"String.Join("","", Name.Split(['o', ' '], 3))", "R,bin,Hood", "Name");

			// String String.Substring(Number)
			TestExpression(movie, @"Name.Substring(6)", "Hood", "Name");

			// String String.Substring(Number, Number)
			TestExpression(movie, @"Name.Substring(7, 2)", "oo", "Name");

			// String String.ToLower()
			TestExpression(movie, @"Name.ToLower()", "robin hood", "Name");

			// String String.ToString()
			TestExpression(movie, @"Name.ToString()", "Robin Hood", "Name");

			// String String.ToUpper()
			TestExpression(movie, @"Name.ToUpper()", "ROBIN HOOD", "Name");

			// String String.Trim()
			TestExpression(movie, @"(Name + ""   "").Trim()", "Robin Hood", "Name");

			// String String.Trim(Char[])
			TestExpression(movie, @"Name.Trim(['R','d','o'])", "bin H", "Name");
			TestExpression(movie, @"Name.Trim('R','d','o')", "bin H", "Name");

			// String String.TrimEnd(Char[])
			TestExpression(movie, @"Name.TrimEnd(['R','d'])", "Robin Hoo", "Name");
			TestExpression(movie, @"Name.TrimEnd('R','d')", "Robin Hoo", "Name");

			// String String.TrimStart(Char[])
			TestExpression(movie, @"Name.TrimStart(['R','d'])", "obin Hood", "Name");
			TestExpression(movie, @"Name.TrimStart('R','d')", "obin Hood", "Name");
		}

		/// <summary>
		/// Parses the specified expression and verifies that both the computed path and expected results are achieved
		/// </summary>
		/// <typeparam name="TRoot"></typeparam>
		/// <typeparam name="TResult"></typeparam>
		/// <param name="instance"></param>
		/// <param name="expression"></param>
		/// <param name="expectedValue"></param>
		/// <param name="expectedPath"></param>
		void TestExpression<TRoot, TResult>(TRoot instance, string expression, TResult expectedValue, string expectedPath)
		{
			// Get the corresponding model type
			var type = typeof(TRoot).GetModelType();

			// Use the type to parse the model expression
			var exp = type.GetExpression<TResult>(expression);

			// Ensure the computed path is correct
			Assert.AreEqual(expectedPath, exp.Path.Path);

			// Ensure the expression yields the correct value
			if (exp.Expression.Parameters.Count == 0)
				Assert.AreEqual(expectedValue, exp.Expression.Compile().DynamicInvoke());
			else
				Assert.AreEqual(expectedValue, exp.Expression.Compile().DynamicInvoke(instance));

			// Convert the expression to javascript
			var translation = translator.Translate(exp.Expression);
			if (translation.Exceptions.Count > 0)
				throw translation.Exceptions.First();

			// Invoke the javascript expression
			var js = "function (x) { " + translation.Exports.Aggregate("", (exports, export) => exports += export.Key + "=" + export.Value + ";") + " return (" + translation.Function + ").call(x);}(x)";
			var f = Accessors.CreateScriptFunction("x", js);
			var result = f(type.GetModelInstance(instance));
			if (typeof(TResult) == typeof(string))
				result = String.Concat(result);
			else if (typeof(TResult) == typeof(DateTime))
				result = ((Jurassic.Library.DateInstance)f(type.GetModelInstance(instance))).Value;
			else
				result = Convert.ChangeType(f(type.GetModelInstance(instance)), typeof(TResult));

			if (typeof(TResult) == typeof(DateTime))
			{
				// Jurassic automatically converts to UTC but in reality we always convert to LocalTime on the client
				DateTime resultDate = (DateTime)Convert.ChangeType(expectedValue, typeof(DateTime));
				Assert.AreEqual(expectedValue, resultDate.ToLocalTime());
			}
			else
			{
				// Verify that the javascript expression evaluated to the correct result
				Assert.AreEqual(expectedValue, result);
			}
		}
	}
}
