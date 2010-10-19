using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace ExoWeb.DataAnnotations
{
	public class ServiceAdapter : global::ExoWeb.ServiceAdapter
	{
		static Regex labelRegex = new Regex(@"(^[a-z]+|[A-Z]{2,}(?=[A-Z][a-z]|$)|[A-Z][a-z]*)", RegexOptions.Singleline | RegexOptions.Compiled);

		public override string GetFormatName(GraphProperty property)
		{
			DisplayFormatAttribute formatAttribute = property.GetAttributes<DisplayFormatAttribute>().FirstOrDefault();
				return formatAttribute != null && !string.IsNullOrWhiteSpace(formatAttribute.DataFormatString) ?
				formatAttribute.DataFormatString : null;
		}

		public override string GetLabel(GraphProperty property)
		{
			DisplayAttribute displayAttribute = property.GetAttributes<DisplayAttribute>().FirstOrDefault();
			string defaultLabel = labelRegex.Replace(property.Name, " $1").Substring(1);
			return displayAttribute != null ? displayAttribute.GetName() : defaultLabel;
		}
	}
}
