using System;
using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using ExoModel.UnitTests.Models;
using ExoWeb.UnitTests.Models.Movies;
using ExoWeb.UnitTests.Models.Shopping;

namespace ExoWeb.UnitTests
{
	/// <summary>
	/// Tests all aspects of the <see cref="JavaScriptExpressionTranslator"/>.
	/// </summary>
	[TestClass]
	[TestModel(Name = "Movies")]
	public partial class JavaScriptExpressionTranslatorTests : TestModelBase
	{
		[TestMethod]
		public void ExpressionTranslator_LiteralExpressions()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// String
			TestExpression(movie, "\"foo\"", "foo", "");

			// Boolean
			TestExpression(movie, "true", true, "");

			// Number
			TestExpression(movie, "46548", 46548, "");
			TestExpression(movie, "465.25", 465.25m, "");
			TestExpression(movie, "465.259", 465.259m, "");
		}

		[TestMethod]
		public void Expression_Binary()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// Number
			TestExpression(movie, "YearsInPlanning + YearsInProduction", 6f, "{YearsInPlanning,YearsInProduction}");
			TestExpression(movie, "YearsInPlanning == YearsInProduction", false, "{YearsInPlanning,YearsInProduction}");
			TestExpression(movie, "YearsInPlanning == null", false, "YearsInPlanning");
			TestExpression(movie, "YearsInPlanning > YearsInProduction", true, "{YearsInPlanning,YearsInProduction}");
			TestExpression(movie, "YearsInPlanning <= YearsInProduction", false, "{YearsInPlanning,YearsInProduction}");
			TestExpression(movie, "YearsInPlanning + Budget", 1320004m, "{YearsInPlanning,Budget}");

			// String
			TestExpression(movie, "Name + \" (\" + Rated + \")\"", "Robin Hood (PG-13)", "{Name,Rated}");
			TestExpression(movie, "Director.Person.FirstName + \" \" + Director.Person.MiddleName + \" \" + Director.Person.LastName", "Ridley  Scott", "Director.Person{FirstName,MiddleName,LastName}");
			TestExpression(movie, "Name == Rated", false, "{Name,Rated}");
			TestExpression(movie, "Name == null", false, "Name");
			TestExpression(movie, "Name > Rated", true, "{Name,Rated}");
			TestExpression(movie, "Name <= Rated", false, "{Name,Rated}");

			// DateTime
			TestExpression(movie, "Started == Released", false, "{Started,Released}");
			TestExpression(movie, "Started < Released", true, "{Started,Released}");
			TestExpression(movie, "Started > Released", false, "{Started,Released}");

			// Enumerable Extensions
			TestExpression(movie, "Genres.Count() = Roles.Count()", true, "{Genres,Roles}");
			TestExpression(movie, "Genres.Count() + Roles.Count()", 6, "{Genres,Roles}");
			TestExpression(movie, "Roles.Where(Star).Count() + Roles.Where(Lead).Count()", 4, "Roles{Star,Lead}");
		}

		[TestMethod]
		public void Expression_Enumerable()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// Boolean IEnumerable.All(Predicate)
			TestExpression(movie, "Roles.All(Star)", true, "Roles.Star");
			TestExpression(movie, "Roles.All(Lead)", false, "Roles.Lead");

			// Boolean IEnumerable.Any()
			TestExpression(movie, "Roles.Any()", true, "Roles");

			// Boolean IEnumerable.Any(Predicate)
			TestExpression(movie, "Roles.Any(Lead==true)", true, "Roles.Lead");
			TestExpression(movie, "Roles.Any(Lead==true && Star==false)", false, "Roles{Lead,Star}");

			// Number IEnumerable.Average(Selector)
			TestExpression(movie, "Director.Movies.Average(Budget)", 1320000.0m, "Director.Movies.Budget"); // decimal
			TestExpression(movie, "Director.Movies.Average(Year)", 2010.0, "Director.Movies.Year"); // long
			TestExpression(movie, "Director.Movies.Average(YearsInProduction)", 2.0, "Director.Movies.YearsInProduction"); // float
			TestExpression(movie, "Roles.Average(Earnings)", 145000.0, "Roles.Earnings"); // double
			TestExpression(movie, "Roles.Average(Order)", 1.0, "Roles.Order"); // int

			// Number IEnumerable.Contains(value)
			TestExpression(movie, "Roles.Select(Name).Contains(\"Robin Longstride\")", true, "Roles.Name");

			// Number IEnumerable.Count()
			TestExpression(movie, "Roles.Count()", 3m, "Roles");

			// Number IEnumerable.Count(Predicate)
			TestExpression(movie, "Roles.Count(Star)", 3m, "Roles.Star");
			TestExpression(movie, "Roles.Count(Star && !Lead)", 2m, "Roles{Star,Lead}");
			TestExpression(movie, "Roles.Count(!Star && Lead)", 0m, "Roles{Star,Lead}");

			// Object[] IEnumerable.Except(IEnumerable)
			TestExpression(movie, "Roles.Select(Name).Except([\"Robin Longstride\"]).First()", "Marion Loxley", "Roles.Name");

			// Object IEnumerable.First()
			TestExpression(movie, "Roles.First().Name", "Robin Longstride", "Roles");

			// Object IEnumerable.First(Predicate)
			TestExpression(movie, "Roles.First(!Lead).Name", "Marion Loxley", "Roles.Lead");

			// Object IEnumerable.FirstOrDefault()
			TestExpression(movie, "Roles.FirstOrDefault().Name", "Robin Longstride", "Roles");

			// Object IEnumerable.FirstOrDefault(Predicate)
			TestExpression(movie, "Roles.FirstOrDefault(Lead && !Star)", (Role)null, "Roles{Lead,Star}");

			// Object IEnumerable.Last()
			TestExpression(movie, "Roles.Last().Name", "Sheriff of Nottingham", "Roles");

			// Object IEnumerable.Last(Predicate)
			TestExpression(movie, "Roles.Last(Lead).Name", "Robin Longstride", "Roles.Lead");

			// Object IEnumerable.LastOrDefault()
			TestExpression(movie, "Roles.LastOrDefault().Name", "Sheriff of Nottingham", "Roles");

			// Object IEnumerable.LastOrDefault(Predicate)
			TestExpression(movie, "Roles.LastOrDefault(Lead && !Star)", (Role)null, "Roles{Lead,Star}");

			// Number IEnumerable.Max(Selector)
			TestExpression(movie, "Roles.Max(Name)", "Sheriff of Nottingham", "Roles.Name");

			// Number IEnumerable.Min(Selector)
			TestExpression(movie, "Roles.Min(Name)", "Marion Loxley", "Roles.Name");

			// Number IEnumerable.OrderBy(Selector)
			TestExpression(movie, "Roles.OrderBy(Earnings).Last().Earnings", 235000m, "Roles.Earnings");

			// Number IEnumerable.OrderByDescending(Selector)
			TestExpression(movie, "Roles.OrderByDescending(Earnings).Last().Earnings", 100000m, "Roles.Earnings");

			// IEnumerable<Object> IEnumerable.Select(Selector)
			TestExpression(movie, "Roles.Select(Name)", "Robin Longstride, Marion Loxley, Sheriff of Nottingham", "Roles.Name");

			// Number IEnumerable.Sum(Selector)
			TestExpression(movie, "Director.Movies.Sum(Budget)", 1320000.0m, "Director.Movies.Budget"); // decimal
			TestExpression(movie, "Director.Movies.Sum(Year)", 2010L, "Director.Movies.Year"); // long
			TestExpression(movie, "Director.Movies.Sum(YearsInProduction)", 2f, "Director.Movies.YearsInProduction"); // float
			TestExpression(movie, "Roles.Sum(Earnings)", 435000.0, "Roles.Earnings"); // double
			TestExpression(movie, "Roles.Sum(Order)", 3, "Roles.Order"); // int

			// Object IEnumerable.Where(Predicate)
			TestExpression(movie, "Roles.Where(Lead).Count()", 1m, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Sum(Order)", 0, "Roles{Lead,Order}");
			TestExpression(movie, "Roles.Where(!Lead).Sum(Order)", 3, "Roles{Lead,Order}");
			TestExpression(movie, "Roles.Where(Name!=\"Robin Longstride\").Max(Order)", 2m, "Roles{Name,Order}");
			TestExpression(movie, "Roles.Where(!Lead).Average(Order)", 1.5m, "Roles{Lead,Order}");
			TestExpression(movie, "Roles.Where(!Lead).Sum(Order)", 3, "Roles{Lead,Order}");
			TestExpression(movie, "Roles.Where(Star).Sum(Order)", 3, "Roles{Star,Order}");
		}

		[TestMethod]
		[TestModel(Name = "Shopping")]
		public void Expression_Enumerable_FormattedModelInstance()
		{
			var justMilk = Context.Fetch<Cart>(1);
			var quickTrip = Context.Fetch<Cart>(2);
			var fullCart = Context.Fetch<Cart>(3);

			TestExpression(justMilk, "Items", String.Join(", ", new[]
			{
				"Milk x 1 @ $3.89",
			}), "Items");

			TestExpression(quickTrip, "Items", String.Join(", ", new[]
			{
				"Eggs x 2 @ $1.00",
				"Bread x 1 @ $1.98",
			}), "Items");

			TestExpression(fullCart, "Items", String.Join(", ", new[]
			{
				"Milk x 1 @ $3.89",
				"Asparagus x 1 @ $6.50",
				"Ground Beef x 2 @ $4.74",
				"Fruit Loops x 1 @ $4.50",
				"Shredded Cheddar Cheese x 1 @ $3.25",
				"Ice Cream x 1 @ $3.99",
				"Cucumber x 3 @ $1.05",
				"Watermelon x 1 @ $3.00",
			}), "Items");

			// Object IEnumerabl.First()
			TestExpression(justMilk, "Items.First()", "Milk x 1 @ $3.89", "Items");

			// Object IEnumerable.First(Predicate)
			TestExpression(quickTrip, "Items.First(!Item.OnSale)", "Bread x 1 @ $1.98", "Items.Item.OnSale");

			// Object IEnumerable.Last()
			TestExpression(quickTrip, "Items.Last()", "Bread x 1 @ $1.98", "Items");

			// Object IEnumerable.Last(Predicate)
			TestExpression(quickTrip, "Items.Last(Item.OnSale)", "Eggs x 2 @ $1.00", "Items.Item.OnSale");

			// IEnumerable<Object> IEnumerable.Select(Selector)
			TestExpression(justMilk, "Items.Select(Item)", "Milk @ $3.89/each", "Items.Item");
			TestExpression(justMilk, "Items.Select(Item.Product)", "Milk", "Items.Item.Product");

			// IEnumerable<Object> IEnumerable.Where(Predicate)
			TestExpression(justMilk, "Items.Where(Item.OnSale)", "", "Items.Item.OnSale");
			TestExpression(quickTrip, "Items.Where(Item.OnSale)", "Eggs x 2 @ $1.00", "Items.Item.OnSale");
			TestExpression(fullCart, "Items.Where(Item.OnSale)", "", "Items.Item.OnSale");

			// Multi-step
			TestExpression(fullCart, "Items.Where(Item.Price > 4.00).Select(Item.Product)", "Asparagus, Ground Beef, Fruit Loops", "Items.Item{Price,Product}");
			TestExpression(quickTrip, "Items.Where(Item.OnSale).Select(Item)", "Eggs @ $1.00/each", "Items.Item.OnSale");
			TestExpression(fullCart, "Items.Select(Item).Where(Price > 4.00).Select(Product)", "Asparagus, Ground Beef, Fruit Loops", "Items.Item"); // TODO: path
			TestExpression(quickTrip, "Items.Select(Item).Where(OnSale).Select(Product)", "Eggs", "Items.Item"); // TODO: path
		}

		[TestMethod]
		[TestModel(Name = "Shopping")]
		public void Expression_Enumerable_FormattedBoolean()
		{
			var justMilk = Context.Fetch<Cart>(1);
			var quickTrip = Context.Fetch<Cart>(2);
			var fullCart = Context.Fetch<Cart>(3);

			// Boolean IEnumerable.All(Predicate)
			TestExpression(fullCart, "Items.All(Item.InStock)", "Yes", "Items.Item.InStock");
			TestExpression(fullCart, "Items.All(Item.OnSale)", "No", "Items.Item.OnSale");
			TestExpression(fullCart, "Items.All(Item.Price > 0.00)", "True", "Items.Item.Price");
			TestExpression(fullCart, "Items.All(Item.Price < 1.00)", "False", "Items.Item.Price");

			// Boolean IEnumerable.Any()
			TestExpression(quickTrip, "Items.Any()", "True", "Items");

			// Boolean IEnumerable.Any(Predicate)
			TestExpression(quickTrip, "Items.Any(Item.InStock)", "Yes", "Items.Item.InStock");
			TestExpression(quickTrip, "Items.Any(Item.InStock==true)", "Yes", "Items.Item.InStock");
			TestExpression(quickTrip, "Items.Any(false==Item.InStock)", "No", "Items.Item.InStock");
			TestExpression(quickTrip, "Items.Any(Item.OnSale==Item.InStock)", "Yes", "Items.Item{OnSale,InStock}");
			TestExpression(quickTrip, "Items.Any(Item.OnSale && Item.InStock)", "Yes", "Items.Item{OnSale,InStock}");
			TestExpression(quickTrip, "Items.Any(Item.OnSale==true && false==Item.InStock)", "No", "Items.Item{OnSale,InStock}");

			// IEnumerable<Object> IEnumerable.Select(Selector)
			TestExpression(justMilk, "Items.Select(Item.Price > 1.00)", "True", "Items.Item.Price");
			TestExpression(justMilk, "Items.Select(Item.OnSale)", "No", "Items.Item.OnSale");
			TestExpression(quickTrip, "Items.Select(Item.OnSale)", "Yes, No", "Items.Item.OnSale");
			TestExpression(fullCart, "Items.Select(Item.OnSale)", "No, No, No, No, No, No, No, No", "Items.Item.OnSale");
			TestExpression(justMilk, "Items.Select(Item.Product.Discontinued)", "False", "Items.Item.Product.Discontinued");

			// Multi-step
			TestExpression(fullCart, "Items.Select(Item).All(Price > 10.00)", "False", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item).All(InStock)", "Yes", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Where(Item.OnSale).All(Item.InStock)", "Yes", "Items.Item{OnSale,InStock}");
			TestExpression(fullCart, "Items.Select(Item).Where(OnSale).All(InStock)", "Yes", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item).Where(InStock).Any()", "True", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item).Any(Price > 5.00)", "True", "Items.Item"); // TODO: path
		}

		[TestMethod]
		[TestModel(Name = "Shopping")]
		public void Expression_Enumerable_FormattedNumeric()
		{
			var justMilk = Context.Fetch<Cart>(1);
			var quickTrip = Context.Fetch<Cart>(2);
			var fullCart = Context.Fetch<Cart>(3);

			// Number IEnumerable.Average(Selector)
			TestExpression(justMilk, "Items.Average(Item.Price)", "$3.89", "Items.Item.Price");
			TestExpression(quickTrip, "Items.Average(Item.Price)", "$1.49", "Items.Item.Price");
			TestExpression(fullCart, "Items.Average(Item.Price)", "$3.87", "Items.Item.Price");

			// Number IEnumerable.Count()
			TestExpression(quickTrip, "Items.Count()", "2", "Items");

			// Number IEnumerable.Count(Predicate)
			TestExpression(justMilk, "Items.Count(Item.InStock)", "1", "Items.Item.InStock");
			TestExpression(quickTrip, "Items.Count(!Item.OnSale && Item.InStock)", "1", "Items.Item{OnSale,InStock}");
			TestExpression(quickTrip, "Items.Count(!Item.InStock && Item.OnSale)", "0", "Items.Item{InStock,OnSale}");

			// Number IEnumerable.Max(Selector)
			TestExpression(fullCart, "Items.Max(Item.Price)", "$6.50", "Items.Item.Price");

			// Number IEnumerable.Min(Selector)
			TestExpression(fullCart, "Items.Min(Item.Price)", "$1.05", "Items.Item.Price");

			// IEnumerable<Object> IEnumerable.Select(Selector)
			TestExpression(justMilk, "Items.Select(Item.Price)", "$3.89", "Items.Item.Price");
			TestExpression(justMilk, "Items.Select(Quantity)", "1", "Items.Quantity");
			TestExpression(quickTrip, "Items.Select(Item.Price)", "$1.00, $1.98", "Items.Item.Price");
			TestExpression(quickTrip, "Items.Select(Quantity)", "2, 1", "Items.Quantity");
			TestExpression(fullCart, "Items.Select(Item.Price)", "$3.89, $6.50, $4.74, $4.50, $3.25, $3.99, $1.05, $3.00", "Items.Item.Price");
			TestExpression(fullCart, "Items.Select(Quantity)", "1, 1, 2, 1, 1, 1, 3, 1", "Items.Quantity");

			// Number IEnumerable.Sum(Selector)
			TestExpression(justMilk, "Items.Sum(Quantity)", "1", "Items.Quantity");
			TestExpression(justMilk, "Items.Sum(Item.Price)", "$3.89", "Items.Item.Price");
			TestExpression(justMilk, "Items.Sum(Item.Price*10)", "$38.90", "Items.Item.Price");
			TestExpression(justMilk, "Items.Sum(Item.Price/10)", "$0.39", "Items.Item.Price");
			TestExpression(justMilk, "Items.Sum(Item.Price*Quantity)", "$3.89", "Items{Item.Price,Quantity}");
			TestExpression(justMilk, "Items.Sum(Quantity*Item.Price)", "$3.89", "Items{Quantity,Item.Price}");
			TestExpression(quickTrip, "Items.Sum(Quantity)", "3", "Items.Quantity");
			TestExpression(quickTrip, "Items.Sum(Item.Price)", "$2.98", "Items.Item.Price");
			TestExpression(quickTrip, "Items.Sum(Item.Price*10)", "$29.80", "Items.Item.Price");
			TestExpression(quickTrip, "Items.Sum(Item.Price/10)", "$0.30", "Items.Item.Price");
			TestExpression(quickTrip, "Items.Sum(Item.Price*Quantity)", "$3.98", "Items{Item.Price,Quantity}");
			TestExpression(quickTrip, "Items.Sum(Quantity*Item.Price)", "$3.98", "Items{Quantity,Item.Price}");
			TestExpression(fullCart, "Items.Sum(Quantity)", "11", "Items.Quantity");
			TestExpression(fullCart, "Items.Sum(Item.Price)", "$30.92", "Items.Item.Price");
			TestExpression(fullCart, "Items.Sum(Item.Price*10)", "$309.20", "Items.Item.Price");
			TestExpression(fullCart, "Items.Sum(Item.Price/10)", "$3.09", "Items.Item.Price");
			TestExpression(fullCart, "Items.Sum(Item.Price*Quantity)", "$37.76", "Items{Item.Price,Quantity}");
			TestExpression(fullCart, "Items.Sum(Quantity*Item.Price)", "$37.76", "Items{Quantity,Item.Price}");

			// Multi-step
			TestExpression(fullCart, "Items.Select(Item).Sum(Price)", "$30.92", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item).Average(Product.ListPrice - Price)", "$0.03", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item).Max(Product.ListPrice - Price)", "$0.20", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item.Product).Max(ListPrice)", "$6.50", "Items.Item.Product"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item.Product).Min(ListPrice)", "$1.25", "Items.Item.Product"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item.Product).Average(ListPrice)", "$3.89", "Items.Item.Product"); // TODO: path
			TestExpression(fullCart, "Items.Where(Item.Price > 4.00).Select(Item.Price*Quantity)", "$6.50, $9.48, $4.50", "Items{Item.Price,Quantity}");
			TestExpression(quickTrip, "Items.Where(Item.OnSale).Select(Item.Product.ListPrice-Item.Price)", "$0.73", "Items.Item{OnSale,Product.ListPrice,Price}");
			TestExpression(quickTrip, "Items.Where(Item.OnSale).Sum(Item.Price)", "$1.00", "Items.Item{OnSale,Price}");
			TestExpression(quickTrip, "Items.Where(Item.Product.Name!=\"Eggs\").Max(Item.Price)", "$1.98", "Items.Item{Product.Name,Price}");
			TestExpression(fullCart, "Items.Where(!Item.OnSale).Average(Item.Price * Quantity)", "$4.72", "Items{Item{OnSale,Price},Quantity}");
			TestExpression(fullCart, "Items.Where(!Item.OnSale).Sum(Item.Price * Quantity)", "$37.76", "Items{Item{OnSale,Price},Quantity}");
			TestExpression(fullCart, "Items.Select(Item).Where(Price > 4.00).Select(Price / 2)", "$3.25, $2.37, $2.25", "Items.Item"); // TODO: path
			TestExpression(quickTrip, "Items.Select(Item).Where(OnSale).Select(Product.ListPrice-Price)", "$0.73", "Items.Item"); // TODO: path
			TestExpression(quickTrip, "Items.Select(Item).Where(OnSale).Sum(Price)", "$1.00", "Items.Item"); // TODO: path
			TestExpression(quickTrip, "Items.Select(Item).Where(Product.Name!=\"Eggs\").Max(Price)", "$1.98", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item).Where(!OnSale).Average(Price * 1.34)", "$5.18", "Items.Item"); // TODO: path
			TestExpression(fullCart, "Items.Select(Item).Where(!OnSale).Sum(Price * 10)", "$309.20", "Items.Item"); // TODO: path
		}

		[TestMethod]
		public void Expression_DateTime_Static()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// Boolean DateTime.Equals(DateTime, DateTime)
			TestExpression(movie, "DateTime.Equals(Started,Released)", false, "{Started,Released}");
			TestExpression(movie, "DateTime.Equals(DateTime.Parse(\"10/30/1991\"), DateTime.Parse(\"10/30/1991\"))", true, "");
			TestExpression(movie, "DateTime.Equals(DateTime.Parse(\"10/30/1991\"), DateTime.Parse(\"10/31/1991\"))", false, "");

			// Boolean DateTime.IsLeapYear(Number)
			TestExpression(movie, "DateTime.IsLeapYear(2008)", true, "");
			TestExpression(movie, "DateTime.IsLeapYear(2007)", false, "");
			TestExpression(movie, "DateTime.IsLeapYear(Year)", false, "Year");
			TestExpression(movie, "DateTime.IsLeapYear(1900)", false, "");
			TestExpression(movie, "DateTime.IsLeapYear(Started.Year)", true, "Started");

			// DateTime DateTime.Now - Cannot accurately test precise time, so just compare the day
			TestExpression(movie, "DateTime.Now.ToString(\"M/d/yyyy\")", DateTime.Now.ToString("M/d/yyyy"), "");

			// DateTime DateTime.Today
			// Test may fail if run around midnight.
			TestExpression(movie, "DateTime.Today", DateTime.Today, "");

			// DateTime DateTime.UTCNow
			// Cannot accurately test
			//TestExpression(movie, "DateTime.UTCNow", DateTime.UTCNow, null);

			// DateTime DateTime.Parse(String)
			TestExpression(movie, "DateTime.Parse(\"10/30/1991\")", new DateTime(1991, 10, 30), "");

			// No need to test complex date string since we're mocking the parsing and really just testing that the translator produced the expected result.
			/*
			TestExpression(movie, "DateTime.Parse(\"October 30, 1991\")", new DateTime(1991, 10, 30), "");
			TestExpression(movie, "DateTime.Parse(\"1991 October 30\")", new DateTime(1991, 10, 30), "");
			TestExpression(movie, "DateTime.Parse(\"1991-11-02\")", new DateTime(1991, 11, 02), "");
			var local = TimeZoneInfo.Local.GetUtcOffset(DateTime.UtcNow);
			String time = "T11:15:45" + local.Hours.ToString("00") + ":" + local.Minutes.ToString("00");
			TestExpression(movie, "DateTime.Parse(\"1991-10-30" + time + "\")", new DateTime(1991, 10, 30, 11, 15, 45), "");
			TestExpression(movie, "DateTime.Parse(\"1/1/\" + Year)", new DateTime(2010, 1, 1), "Year");
			*/
		}

		[TestMethod]
		public void Expression_DateTime_Instance()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// DateTime Released.AddDays(Number days)
			TestExpression(movie, "Released.AddDays(1)", new DateTime(2010, 5, 15), "Released");

			// DateTime Released.AddHours(Number hours)
			TestExpression(movie, "Released.AddHours(1)", new DateTime(2010, 5, 14, 1, 0, 0), "Released");

			// DateTime Released.AddMilliseconds(Number milliseconds)
			TestExpression(movie, "Released.AddMilliseconds(1)", new DateTime(2010, 5, 14, 0, 0, 0, 1), "Released");

			// DateTime Released.AddMinutes(Number minutes)
			TestExpression(movie, "Released.AddMinutes(1)", new DateTime(2010, 5, 14, 0, 1, 0, 0), "Released");

			// DateTime Released.AddMonths(Number months)
			TestExpression(movie, "Released.AddMonths(1)", new DateTime(2010, 6, 14, 0, 0, 0, 0), "Released");

			// DateTime Released.AddSeconds(Number seconds)
			TestExpression(movie, "Released.AddSeconds(1)", new DateTime(2010, 5, 14, 0, 0, 1, 0), "Released");

			//// DateTime Released.AddTicks(Number ticks)
			//TestExpression(movie, "Released.AddTicks(1)", new DateTime(2010, 5, 14).AddTicks(1), "Released");

			// DateTime Released.AddYears(Number years)
			TestExpression(movie, "Released.AddYears(1)", new DateTime(2011, 5, 14), "Released");

			// Number Released.CompareTo(DateTime date)
			TestExpression(movie, "Released.CompareTo(Released)", 0m, "Released");
			TestExpression(movie, "Started.CompareTo(Released)", -1m, "{Started,Released}");
			TestExpression(movie, "Released.CompareTo(Started)", 1m, "{Released,Started}");

			// DateTime Released.Date
			TestExpression(movie, "Released.Date", new DateTime(2010, 5, 14), "Released");

			// Number Released.Day
			TestExpression(movie, "Released.Day", 14m, "Released");

			// String Released.DayOfWeek
			TestExpression(movie, "Released.DayOfWeek", "Friday", "Released");

			// Number Released.DayOfYear
			TestExpression(movie, "Released.DayOfYear", 134m, "Released");

			// Number Released.Hour
			TestExpression(movie, "Released.Hour", 0m, "Released");

			// Number Released.Millisecond
			TestExpression(movie, "Released.Millisecond", 0m, "Released");

			// Number Released.Minute
			TestExpression(movie, "Released.Minute", 0m, "Released");

			// Number Released.Month
			TestExpression(movie, "Released.Month", 5m, "Released");

			// Number Released.Second
			TestExpression(movie, "Released.Second", 0m, "Released");

			// Number Released.Ticks
			TestExpression(movie, "Released.Ticks", (decimal)movie.Released.Ticks, "Released");

			// Number Released.Year
			TestExpression(movie, "Released.Year", 2010m, "Released");
		}

		[TestMethod]
		public void Expression_TimeSpan_Static()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// Number TimeSpan.Compare(TimeSpan, TimeSpan)
			TestExpression(movie, "TimeSpan.Compare(Released-Started,Started-Released)", 1m, "{Released,Started}");
			TestExpression(movie, "TimeSpan.Compare(Started-Released,Released-Released)", -1m, "{Started,Released}");

			// Boolean TimeSpan.Equals(TimeSpan, TimeSpan)
			TestExpression(movie, "TimeSpan.Equals(Released-Started,Released-Started)", true, "{Released,Started}");
			TestExpression(movie, "TimeSpan.Equals(Released-Started,Started-Released)", false, "{Released,Started}");

			// TimeSpan TimeSpan.FromDays(Number)
			TestExpression(movie, "TimeSpan.FromDays(1).Days", 1m, "");

			// TimeSpan TimeSpan.FromHours(Number)
			TestExpression(movie, "TimeSpan.FromHours(24).Days", 1m, "");

			// TimeSpan TimeSpan.FromMilliseconds(Number)
			TestExpression(movie, "TimeSpan.FromMilliseconds(86400000).Days", 1m, "");

			// TimeSpan TimeSpan.FromMinutes(Number)
			TestExpression(movie, "TimeSpan.FromMinutes(1440).Days", 1m, "");

			// TimeSpan TimeSpan.FromSeconds(Number)
			TestExpression(movie, "TimeSpan.FromSeconds(86400).Days", 1m, "");

			// TimeSpan TimeSpan.FromTicks(Number)
			TestExpression(movie, "TimeSpan.FromTicks(864000000000).Days", 1m, "");
		}

		[TestMethod]
		public void Expression_DateTime_Format()
		{
			var movie = Context.Fetch<Movie>(1);
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"d\")", "1/31/2016", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"D\")", "Sunday, January 31, 2016", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"f\")", "Sunday, January 31, 2016 12:00 AM", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"F\")", "Sunday, January 31, 2016 12:00:00 AM", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"g\")", "1/31/2016 12:00 AM", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"G\")", "1/31/2016 12:00:00 AM", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"m\")", "January 31", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"M\")", "January 31", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"o\")", "2016-01-31T00:00:00.0000000", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"O\")", "2016-01-31T00:00:00.0000000", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"r\")", "Sun, 31 Jan 2016 00:00:00 GMT", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"R\")", "Sun, 31 Jan 2016 00:00:00 GMT", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"s\")", "2016-01-31T00:00:00", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"t\")", "12:00 AM", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"u\")", "2016-01-31 00:00:00Z", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"U\")", "Sunday, January 31, 2016 5:00:00 AM", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"y\")", "January 2016", "");
			TestExpression(movie, "DateTime.Parse(\"1/31/16\").ToString(\"Y\")", "January 2016", "");
		}

		[TestMethod]
		public void Expression_TimeSpan_Instance()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// TimeSpan TimeSpan1.Add(TimeSpan)
			TestExpression(movie, "(Released-Started).Add(Released-Started).TotalDays", 4382m, "{Released,Started}");

			// Boolean TimeSpan1.CompareTo(TimeSpan)
			TestExpression(movie, "(Released-Started).CompareTo(Released-Started)", 0m, "{Released,Started}");
			TestExpression(movie, "(Started-Released).CompareTo(Released-Started)", -1m, "{Started,Released}");
			TestExpression(movie, "(Released-Started).CompareTo(Started-Released)", 1m, "{Released,Started}");

			// Number TimeSpan1.Days
			TestExpression(movie, "(Released-Started).Days", 2191m, "{Released,Started}");

			// TimeSpan TimeSpan1.Duration()
			TestExpression(movie, "(Released-Started).Duration().Days", 2191m, "{Released,Started}");
			TestExpression(movie, "(Started-Released).Duration().Days", 2191m, "{Started,Released}");

			// Number TimeSpan1.Hours
			TestExpression(movie, "(Released.AddHours(9)-Released).Hours", 9m, "Released");

			// Number TimeSpan1.Milliseconds
			TestExpression(movie, "(Released-Released).Milliseconds", 0m, "Released");

			// Number TimeSpan1.Minutes
			TestExpression(movie, "(Released.AddMinutes(15)-Released).Minutes", 15m, "Released");

			// TimeSpan TimeSpan1.Negate()
			TestExpression(movie, "(Released-Started).Negate().Days", -2191m, "{Released,Started}");
			TestExpression(movie, "(Started-Released).Negate().Days", 2191m, "{Started,Released}");

			// Number TimeSpan1.Seconds
			TestExpression(movie, "(Released.AddSeconds(15)-Released).Seconds", 15m, "Released");

			// TimeSpan TimeSpan1.Subtract(TimeSpan)
			TestExpression(movie, "(Started-Released).Subtract(Started-Released).Days", 0m, "{Started,Released}");

			// Number TimeSpan1.Ticks
			TestExpression(movie, "(Released.AddHours(1)-Released).Ticks", 36000000000m, "Released");

			// String TimeSpan1.ToString()
			TestExpression(movie, "(Released.AddHours(9).AddMinutes(15).AddSeconds(15)-Released).ToString()", "09:15:15", "Released");

			// Number TimeSpan1.TotalDays
			TestExpression(movie, "(Released-Started).TotalDays", 2191.0m, "{Released,Started}");

			// Number TimeSpan1.TotalHours
			TestExpression(movie, "(Released.AddHours(9).AddMinutes(15)-Released).TotalHours", 9.25m, "Released");

			// Number TimeSpan1.TotalMilliseconds
			TestExpression(movie, "(Released.AddSeconds(33315)-Released).TotalMilliseconds", 33315000.0m, "Released");

			// Number TimeSpan1.TotalMinutes
			TestExpression(movie, "(Released.AddMinutes(555).AddSeconds(15)-Released).TotalMinutes", 555.25m, "Released");

			// Number TimeSpan1.TotalSeconds
			TestExpression(movie, "(Released.AddSeconds(33315)-Released).TotalSeconds", 33315.0m, "Released");
		}

		[TestMethod]
		public void Expression_Math_Static()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// Number Math.Abs(Number)
			TestExpression(movie, "Math.Abs(45)", 45m, "");
			TestExpression(movie, "Math.Abs(-45.43)", 45.43m, "");
			TestExpression(movie, "Math.Abs(0)", 0m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Abs(-9.25)", 9.25, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Abs(0)", 0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Abs(9.25)", 9.25, "Roles.Lead");

			// Number Math.Acos(Number)
			TestExpression(movie, "Math.Acos(0.5)", 1.0471975511966m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Acos(0.5)", 1.0471975511965979, "Roles.Lead");

			// Number Math.Asin(Number)
			TestExpression(movie, "Math.Asin(1)", 1.5707963267949m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Asin(1)", 1.5707963267948966, "Roles.Lead");

			// Number Math.Atan(Number)
			TestExpression(movie, "Math.Atan(1)", 0.785398163397448m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Atan(1)", 0.78539816339744828, "Roles.Lead");

			// Number Math.Atan2(Number, Number)
			TestExpression(movie, "Math.Atan2(1,2)", 0.463647609000806m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Atan2(1, 2)", 0.46364760900080609, "Roles.Lead");

			// Number Math.Ceiling(Number)
			TestExpression(movie, "Math.Ceiling(3.2)", 4.0m, "");
			TestExpression(movie, "Math.Ceiling(-3.2)", -3.0m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Ceiling(9.25)", 10.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Ceiling(-9.25)", -9.0, "Roles.Lead");

			// Number Math.Cos(Number)
			TestExpression(movie, "Math.Cos(1)", 0.54030230586814m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Cos(1)", 0.54030230586813972, "Roles.Lead");

			// Number Math.Cosh(Number)
			TestExpression(movie, "Math.Cosh(1)", 1.54308063481524m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Cosh(1)", 1.54308063481524378, "Roles.Lead");

			// Number Math.E
			TestExpression(movie, "Math.E", 2.71828182845904m, "");

			// Number Math.Exp(Number)
			TestExpression(movie, "Math.Exp(-9.25)", 0.0000961116520613947m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Exp(-9.25)", 0.0000961116520613947, "Roles.Lead");

			// Number Math.Floor(Number)
			TestExpression(movie, "Math.Floor(3.2)", 3.0m, "");
			TestExpression(movie, "Math.Floor(-3.2)", -4.0m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Floor(9.25)", 9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Floor(-9.25)", -10.0, "Roles.Lead");

			// Number Math.Log(Number)
			TestExpression(movie, "Math.Log(3)", 1.09861228866811m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Log(3)", 1.0986122886681098, "Roles.Lead");

			// Number Math.Log(Number, Number)
			TestExpression(movie, "Math.Log(3,5)", 0.682606194485985m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Log(3, 5)", 0.68260619448598536, "Roles.Lead");

			// Number Math.Log10(Number)
			TestExpression(movie, "Math.Log10(3)", 0.477121254719662m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Log10(3)", 0.47712125471966244, "Roles.Lead");

			// Number Math.Max(Number, Number)
			TestExpression(movie, "Math.Max(-3.2, 3.2)", 3.2m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Max(-9.25, 9.25)", 9.25, "Roles.Lead");

			// Number Math.Min(Number, Number)
			TestExpression(movie, "Math.Min(-3.2, 3.2)", -3.2m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Min(-9.25, 9.25)", -9.25, "Roles.Lead");

			// Number Math.PI
			TestExpression(movie, "Math.PI", 3.14159265358979m, "");

			// Number Math.Pow(Number, Number)
			TestExpression(movie, "Math.Pow(4,2)", 16.0m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Pow(4, 2)", 16.0, "Roles.Lead");

			// Number Math.Round(Number)
			TestExpression(movie, "Math.Round(3.2)", 3.0m, "");
			TestExpression(movie, "Math.Round(-3.2)", -3.0m, "");
			TestExpression(movie, "Math.Round(3.75)", 4.0m, "");
			TestExpression(movie, "Math.Round(-3.75)", -4.0m, "");
			TestExpression(movie, "Math.Round(3.5)", 4.0m, "");
			TestExpression(movie, "Math.Round(-3.5)", -4.0m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(9.25)", 9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(9.75)", 10.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(-9.25)", -9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(-9.75)", -10.0, "Roles.Lead");

			// Number Math.Round(Number, Number)
			TestExpression(movie, "Math.Round(3.254684,2)", 3.25m, "");
			TestExpression(movie, "Math.Round(-3.254684,2)", -3.25m, "");
			TestExpression(movie, "Math.Round(3.554684,0)", 4m, "");
			TestExpression(movie, "Math.Round(-3.554684,0)", -4m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Round(-9.254903, 2)", -9.25, "Roles.Lead");

			// Number Math.Sign(Number)
			TestExpression(movie, "Math.Sign(3.2)", 1m, "");
			TestExpression(movie, "Math.Sign(0)", 0m, "");
			TestExpression(movie, "Math.Sign(-3.2)", -1m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sign(-9.25)", -1, "Roles.Lead");

			// Number Math.Sin(Number)
			TestExpression(movie, "Math.Sin(-9.25)", -0.173889485380434m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sin(-9.25)", -0.17388948538043356, "Roles.Lead");

			// Number Math.Sinh(Number)
			TestExpression(movie, "Math.Sinh(3)", 10.0178749274099m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sinh(3)", 10.017874927409902, "Roles.Lead");

			// Number Math.Sqrt(Number)
			TestExpression(movie, "Math.Sqrt(3)", 1.73205080756888m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Sqrt(3)", 1.7320508075688773, "Roles.Lead");

			// Number Math.Tan(Number)
			TestExpression(movie, "Math.Tan(3)", -0.142546543074278m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Tan(3)", -0.1425465430742778, "Roles.Lead");

			// Number Math.Tanh(Number)
			TestExpression(movie, "Math.Tanh(3)", 0.99505475368673m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Tanh(3)", 0.99505475368673045, "Roles.Lead");

			// Number Math.Truncate(Number)
			TestExpression(movie, "Math.Truncate(3.2)", 3.0m, "");
			TestExpression(movie, "Math.Truncate(-3.2)", -3.0m, "");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Truncate(9.25)", 9.0, "Roles.Lead");
			TestExpression(movie, "Roles.Where(Lead).Count() * Math.Truncate(-9.25)", -9.0, "Roles.Lead");
		}

		[TestMethod]
		public void Expression_String_Static()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// Number String.Compare(String, String)
			TestExpression(movie, @"String.Compare(Name, ""Robin Hood"")", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, ""Robin Hoods"")", -1, "Name");
			TestExpression(movie, @"String.Compare(Name, ""Robin"")", 1, "Name");
			TestExpression(movie, @"String.Compare(Name, ""Marion Loxley"")", 1, "Name");
			TestExpression(movie, @"String.Compare(""Marion Loxley"", Name)", -1, "Name");

			// Number String.Compare(String, Number, String, Number, Number)
			TestExpression(movie, @"String.Compare(Name, 6, ""Hood"", 0, 4)", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, 6, ""hood"", 0, 4)", 1, "Name");
			TestExpression(movie, @"String.Compare(Name, 5, ""Hood"", 0, 4)", -1, "Name");

			// Number String.Compare(String, Number, String, Number, Number, Boolean)
			TestExpression(movie, @"String.Compare(Name, 6, ""hood"", 0, 4, true)", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, 6, ""hood"", 0, 4, false)", 1, "Name");

			// Number String.Compare(String, String, Boolean)
			TestExpression(movie, @"String.Compare(Name, ""robin hood"", true)", 0, "Name");
			TestExpression(movie, @"String.Compare(Name, ""robin hood"", false)", 1, "Name");

			// Number String.CompareOrdinals(String, String)
			TestExpression(movie, @"String.CompareOrdinal(Name, ""Robin Hood"")", 0m, "Name");
			// The .NET documentation for `String.CompareOrdinal` doesn't go into much detail about the
			// specific value that will be returned, but rather focuses on the 'sign' of the value.
			// https://msdn.microsoft.com/en-us/library/af26w0wa(v=vs.110).aspx
			//TestExpression(movie, @"String.CompareOrdinal(Name, ""Robin Hoods"")", -1m, "Name");
			TestExpression(movie, @"String.CompareOrdinal(Name, ""Robin Hoods"") < 0", true, "Name");
			//TestExpression(movie, @"String.CompareOrdinal(Name, ""Robin"")", 32m, "Name");
			TestExpression(movie, @"String.CompareOrdinal(Name, ""Robin"") > 0", true, "Name");

			// String String.Concat(Object)
			TestExpression(movie, @"String.Concat(8)", "8", "");
			TestExpression(movie, @"String.Concat(null)", "", "");
			TestExpression(movie, @"String.Concat(Name)", "Robin Hood", "Name");
			TestExpression(movie, @"String.Concat(Released.ToShortDateString())", "5/14/2010", "Released");

			// String String.Concat(Object, Object)
			TestExpression(movie, @"String.Concat(Name, 9.75)", "Robin Hood9.75", "Name");
			TestExpression(movie, @"String.Concat(Released.ToShortDateString(), Name)", "5/14/2010Robin Hood", "{Released,Name}");
			TestExpression(movie, @"String.Concat(Year, "" is recent"")", "2010 is recent", "Year");

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

			// String String.Copy(String)
			TestExpression(movie, @"String.Copy(Name)", "Robin Hood", "Name");

			// Boolean String.Equals(String, String)
			TestExpression(movie, @"String.Equals(Name, ""Robin Hood"")", true, "Name");
			TestExpression(movie, @"String.Equals(Name, ""robin hood"")", false, "Name");
			TestExpression(movie, @"String.Equals(Name, """")", false, "Name");

			// Boolean String.IsNullOrEmpty(String)
			TestExpression(movie, @"String.IsNullOrEmpty("""")", true, "");
			TestExpression(movie, @"String.IsNullOrEmpty(null)", true, "");
			TestExpression(movie, @"String.IsNullOrEmpty(Name)", false, "Name");

			// Boolean String.IsNullOrWhiteSpace(String)
			TestExpression(movie, @"String.IsNullOrWhiteSpace("""")", true, "");
			TestExpression(movie, @"String.IsNullOrWhiteSpace(null)", true, "");
			TestExpression(movie, @"String.IsNullOrWhiteSpace("" "")", true, "");
			TestExpression(movie, @"String.IsNullOrWhiteSpace(""   "")", true, ""); // spaces
			TestExpression(movie, @"String.IsNullOrWhiteSpace(""		"")", true, ""); // tabs
			TestExpression(movie, @"String.IsNullOrWhiteSpace(Name)", false, "Name");

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

			// String[] String.Join(String, Char[])
			TestExpression(movie, @"String.Join("","", Name.Split('o', ' '))", "R,bin,H,,d", "Name");
			TestExpression(movie, @"String.Join("","", Name.Split(['o', ' ']))", "R,bin,H,,d", "Name");

			// String[] String.Join(String, String, Char[], Number)
			TestExpression(movie, @"String.Join("","", Name.Split(['o', ' '], 3))", "R,bin,Hood", "Name");
		}

		[TestMethod]
		public void Expression_String_Instance()
		{
			// Get the 2010 "Robin Hood" movie
			var movie = Context.Fetch<Movie>(1);

			// Boolean String.StartsWith(String)
			TestExpression(movie, @"Name.StartsWith(""Robin"")", true, "Name");
			TestExpression(movie, @"Name.StartsWith(""Hood"")", false, "Name");
			//TestExpression(movie, @"startswith(Name, ""Robin"") eq true", true, "Name"); // odata

			// Number String.CompareTo(Object)
			TestExpression(movie, @"Name.CompareTo(null)", 1, "Name");

			// Number String.CompareTo(String)
			TestExpression(movie, @"Name.CompareTo(""Robin Hood"")", 0, "Name");
			TestExpression(movie, @"Name.CompareTo(""Robin Longstride"")", -1, "Name");
			TestExpression(movie, @"Name.CompareTo(""Marion Loxley"")", 1, "Name");
			TestExpression(movie, @"Name.CompareTo(""Zoo"")", -1, "Name");

			// Boolean String.Contains(String)
			TestExpression(movie, @"Name.Contains(""Robin"")", true, "Name");
			TestExpression(movie, @"Name.Contains(""Batman"")", false, "Name");
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");

			// Boolean String.EndsWith(String)
			TestExpression(movie, @"Name.EndsWith(""Hood"")", true, "Name");
			TestExpression(movie, @"Name.EndsWith(""Robin"")", false, "Name");

			// Number String.IndexOf(Char)
			TestExpression(movie, @"Name.IndexOf('H')", 6, "Name");

			// Number String.IndexOf(Char, Number)
			TestExpression(movie, @"Name.IndexOf('o', 3)", 7, "Name");

			// Number String.IndexOf(Char, Number, Number)
			TestExpression(movie, @"Name.IndexOf('o', 3, 3)", -1, "Name");

			// Number String.IndexOf(String)
			TestExpression(movie, @"Name.IndexOf(""Hood"")", 6, "Name");

			// Number String.IndexOf(String, Number)
			TestExpression(movie, @"Name.IndexOf(""b"", 2)", 2, "Name");
			TestExpression(movie, @"Name.IndexOf(""o"", 3)", 7, "Name");

			// Number String.IndexOf(String, Number, Number)
			TestExpression(movie, @"Name.IndexOf(""b"", 3, 4)", -1, "Name");
			TestExpression(movie, @"Name.IndexOf(""o"", 3, 5)", 7m, "Name");
			TestExpression(movie, @"Name.IndexOf(""o"", 3, 3)", -1, "Name");

			// Number String.IndexOfAny(Char[])
			TestExpression(movie, @"Name.IndexOfAny((""ob"").ToCharArray())", 1m, "Name");
			TestExpression(movie, @"Name.IndexOfAny(['d','b'])", 2, "Name");

			// Number String.IndexOfAny(Char[], Number)
			TestExpression(movie, @"Name.IndexOfAny((""ob"").ToCharArray(), 3)", 7m, "Name");
			TestExpression(movie, @"Name.IndexOfAny(['d','b','o'], 3)", 7, "Name");

			// Number String.IndexOfAny(Char[], Number, Number)
			TestExpression(movie, @"Name.IndexOfAny((""ob"").ToCharArray(), 3, 5)", 7m, "Name");
			TestExpression(movie, @"Name.IndexOfAny(['d','b','o'], 3, 3)", -1, "Name");

			// String String.Insert(Number, String)
			TestExpression(movie, @"Name.Insert(5, "","")", "Robin, Hood", "Name");
			TestExpression(movie, @"Name.Insert(0, ""Little Red "")", "Little Red Robin Hood", "Name");

			// Number String.LastIndexOf(Char)
			TestExpression(movie, @"Name.LastIndexOf('o')", 8, "Name");

			// Number String.LastIndexOf(Char, Number)
			TestExpression(movie, @"Name.LastIndexOf('o', 4)", 1, "Name");

			// Number String.LastIndexOf(Char, Number, Number)
			TestExpression(movie, @"Name.LastIndexOf('0', 4, 3)", -1, "Name");

			// Number String.LastIndexOf(String)
			TestExpression(movie, @"Name.LastIndexOf(""oo"")", 7m, "Name");
			TestExpression(movie, @"Name.LastIndexOf(""o"")", 8, "Name");

			// Number String.LastIndexOf(String, Number)
			TestExpression(movie, @"Name.LastIndexOf(""oo"", 1)", -1m, "Name");
			TestExpression(movie, @"Name.LastIndexOf(""oo"", 10)", 7m, "Name");
			TestExpression(movie, @"Name.LastIndexOf(""o"", 4)", 1, "Name");

			// Number String.LastIndexOf(String, Number, Number)
			TestExpression(movie, @"Name.LastIndexOf(""oo"", 10, 2)", -1m, "Name");
			TestExpression(movie, @"Name.LastIndexOf(""oo"", 10, 8)", 7m, "Name");
			TestExpression(movie, @"Name.LastIndexOf(""o"", 4, 3)", -1, "Name");

			// Number String.LastIndexOfAny(Char[])
			TestExpression(movie, @"Name.LastIndexOfAny((""Ho"").ToCharArray())", 8m, "Name");
			TestExpression(movie, @"Name.LastIndexOfAny(['d','b','o'])", 9, "Name");

			// Number String.LastIndexOfAny(Char[], Number)
			TestExpression(movie, @"Name.LastIndexOfAny((""Hd"").ToCharArray(), 5)", -1m, "Name");
			TestExpression(movie, @"Name.LastIndexOfAny((""Hd"").ToCharArray(), 9)", 9m, "Name");
			TestExpression(movie, @"Name.LastIndexOfAny(['d','b','o'], 6)", 2, "Name");

			// Number String.LastIndexOfAny(Char[], Number, Number)
			TestExpression(movie, @"Name.LastIndexOfAny((""Hd"").ToCharArray(), 9, 4)", 9m, "Name");
			TestExpression(movie, @"Name.LastIndexOfAny(['d','b','o'], 8, 3)", 8, "Name");

			// Number String.Length
			TestExpression(movie, @"Name.Length", 10m, "Name");

			// Boolean String.Equals(Object)
			TestExpression(movie, @"Name.Equals(null + ""Robin Hood"")", true, "Name");
			TestExpression(movie, @"Name.Equals(null)", false, "Name");

			// Boolean String.Equals(String)
			TestExpression(movie, @"Name.Equals(""Robin Hood"")", true, "Name");
			TestExpression(movie, @"Name.Equals(""Robin-Hood"")", false, "Name");

			// String String.PadLeft(Number)
			TestExpression(movie, @"Name.PadLeft(0)", "Robin Hood", "Name");
			TestExpression(movie, @"Name.PadLeft(10)", "Robin Hood", "Name");
			TestExpression(movie, @"Name.PadLeft(20)", "          Robin Hood", "Name");

			// String String.PadLeft(Number, Char)
			TestExpression(movie, @"Name.PadLeft(15, '*')", "*****Robin Hood", "Name");
			TestExpression(movie, @"Name.PadLeft(20, '*')", "**********Robin Hood", "Name");

			// String String.PadRight(Number)
			TestExpression(movie, @"Name.PadRight(0)", "Robin Hood", "Name");
			TestExpression(movie, @"Name.PadRight(10)", "Robin Hood", "Name");
			TestExpression(movie, @"Name.PadRight(20)", "Robin Hood          ", "Name");

			// String String.PadRight(Number, Char)
			TestExpression(movie, @"Name.PadRight(20, '*')", "Robin Hood**********", "Name");
			TestExpression(movie, @"Name.Contains(""Robin-Hood"")", false, "Name");
			TestExpression(movie, @"Name.PadRight(15, '*')", "Robin Hood*****", "Name");

			// String String.Remove(Number)
			TestExpression(movie, @"Name.Remove(5)", "Robin", "Name");

			// String String.Remove(Number, Number)
			TestExpression(movie, @"Name.Remove(0, 6)", "Hood", "Name");
			TestExpression(movie, @"Name.Remove(2, 7)", "Rod", "Name");

			// String String.Replace(Char, Char)
			TestExpression(movie, @"Name.Replace('o','0')", "R0bin H00d", "Name");

			// String String.Replace(String, String)
			TestExpression(movie, @"Name.Replace(""hood"", ""Longstride"")", "Robin Hood", "Name");
			TestExpression(movie, @"Name.Replace(""Hood"", ""Longstride"")", "Robin Longstride", "Name");
			TestExpression(movie, @"Name.Replace(""o"", ""0"")", "R0bin H00d", "Name");
			TestExpression(movie, @"Name.Replace("" "", """")", "RobinHood", "Name");
			TestExpression(movie, @"Name.Replace(""bin"", ""bert"")", "Robert Hood", "Name");

			// String[] String.Split(Char[])
			TestExpression(movie, @"Name.Split(("" "").ToCharArray()).Length", 2m, "Name");
			TestExpression(movie, @"Name.Split((""o"").ToCharArray()).Length", 4m, "Name");

			// String[] String.Split(Char[], Number)
			TestExpression(movie, @"Name.Split(("" "").ToCharArray(), 1).Length", 1m, "Name");

			// String String.Substring(Number)
			TestExpression(movie, @"Name.Substring(6)", "Hood", "Name");

			// String String.Substring(Number, Number)
			TestExpression(movie, @"Name.Substring(6, 3)", "Hoo", "Name");
			TestExpression(movie, @"Name.Substring(7, 2)", "oo", "Name");

			// Char[] String.ToCharArray()
			TestExpression(movie, @"Name.ToCharArray().Length", 10m, "Name");

			// Char[] String.ToCharArray(Number, Number)
			TestExpression(movie, @"Name.ToCharArray(6, 2).Length", 2m, "Name");

			// String String.ToLower()
			TestExpression(movie, @"Name.ToLower()", "robin hood", "Name");

			// String String.ToString()
			TestExpression(movie, @"Name.ToString()", "Robin Hood", "Name");

			// String String.ToUpper()
			TestExpression(movie, @"Name.ToUpper()", "ROBIN HOOD", "Name");

			// String String.Trim()
			TestExpression(movie, @"Name.Trim()", "Robin Hood", "Name");
			TestExpression(movie, @"(Name + ""   "").Trim()", "Robin Hood", "Name");

			// String String.Trim(Char[])
			TestExpression(movie, @"Name.Trim(['R', 'd'])", "obin Hoo", "Name");
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
		/// Tests the use of intrinsic <see cref="Boolean"/> methods when used in expressions.
		/// </summary>
		[TestMethod]
		public void Expression_Boolean()
		{
			// Get the Robin Hood movie
			var movie = Context.FetchAll<Movie>().First(m => m.Name == "Robin Hood");

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
	}
}
