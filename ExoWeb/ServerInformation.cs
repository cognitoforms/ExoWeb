using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb
{
	internal class ServerInformation
	{
		public int TimeZoneOffset { get; set; }

		public ServerInformation()
		{
			TimeZoneOffset = TimeZone.CurrentTimeZone.GetUtcOffset(DateTime.Now).Hours;
		}
	}
}
