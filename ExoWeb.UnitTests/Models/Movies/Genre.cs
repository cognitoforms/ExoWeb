using ExoModel;
using ExoModel.Json;

namespace ExoWeb.UnitTests.Models.Movies
{
	[ModelFormat("[Name]")]
	public class Genre : JsonEntity
	{
		public string Name { get; set; }
	}
}
