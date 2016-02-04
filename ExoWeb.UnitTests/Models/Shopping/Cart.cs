using System.Collections.Generic;
using ExoModel.Json;

namespace ExoWeb.UnitTests.Models.Shopping
{
	public class Cart : JsonEntity
	{
		public ICollection<CartItem> Items { get; set; } 
	}
}
