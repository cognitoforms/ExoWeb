using System.ComponentModel.DataAnnotations;
using ExoModel;
using ExoModel.Json;

namespace ExoWeb.UnitTests.Models.Shopping
{
	[ModelFormat("[Product.Name] @ [Price]/each")]
	public class Item : JsonEntity
	{
		[ModelFormat("[Name]")]
		public Product Product { get; set; }

		[DisplayFormat(DataFormatString = "C")]
		public decimal Price { get; set; }

		[DisplayFormat(DataFormatString = "Yes;No")]
		public bool InStock { get; set; }

		[DisplayFormat(DataFormatString = "Yes;No")]
		public bool OnSale { get; set; }
	}
}
