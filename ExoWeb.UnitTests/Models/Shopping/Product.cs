using System.ComponentModel.DataAnnotations;
using ExoModel;
using ExoModel.Json;

namespace ExoWeb.UnitTests.Models.Shopping
{
	[ModelFormat("[Name] - List Price: [ListPrice]")]
	public class Product : JsonEntity
	{
		public string Name { get; set; }

		[DisplayFormat(DataFormatString = "C")]
		public decimal ListPrice { get; set; }

		public bool Discontinued { get; set; }
	}
}
