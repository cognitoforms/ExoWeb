using System;

namespace ExoWeb
{
	internal class ServerInformation
	{
		public int TimeZoneOffset { get; set; }

		public string TimeZoneStandardName { get; set; }

		public string TimeZoneDaylightName { get; set; }

		public ServerInformation()
		{
			TimeZoneOffset = TimeZone.CurrentTimeZone.GetUtcOffset(DateTime.Now).Hours;
			TimeZoneStandardName = TimeZone.CurrentTimeZone.StandardName;
			TimeZoneDaylightName = TimeZone.CurrentTimeZone.DaylightName;
		}
	}
}
