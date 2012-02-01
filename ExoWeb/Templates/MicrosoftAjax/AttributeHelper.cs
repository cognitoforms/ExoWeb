using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace ExoWeb.Templates.MicrosoftAjax
{
	public static class AttributeHelper
	{
		private static Regex BuildCssRegex(string property)
		{
			return new Regex("(.*)(?<=^|(?:;\\s*))" + Regex.Escape(property) + "\\:([^;]*(?:;)?)((?<=;).*)?");
		}

		public static string GetCssStyle(string styleValue, string property)
		{
			if (string.IsNullOrEmpty(property))
				throw new ArgumentNullException("property", "Css property name must be specified.");

			if (!HasCssStyle(styleValue, property))
				return null;

			return BuildCssRegex(property).Match(styleValue).Groups[2].Value.Trim().Trim(';');
		}

		public static bool HasCssStyle(string styleValue, string property)
		{
			if (string.IsNullOrEmpty(property))
				throw new ArgumentNullException("property", "Css property name must be specified.");

			return !string.IsNullOrEmpty(styleValue) && BuildCssRegex(property).IsMatch(styleValue);
		}

		public static string EnsureCssStyle(string styleValue, string property, string value)
		{
			if (string.IsNullOrEmpty(property))
				throw new ArgumentNullException("property", "Css property name must be specified.");

			if (string.IsNullOrEmpty(value))
				throw new ArgumentNullException("value", "Css property value must be specified.");

			var pair = property + ":" + value + ";";

			if (HasCssStyle(styleValue, property))
				return BuildCssRegex(property).Replace(styleValue, "$1" + pair + "$3");
			else
				return pair + (string.IsNullOrEmpty(styleValue) ? "" : " " + styleValue);
		}

		public static string RemoveCssStyle(string styleValue, string property)
		{
			if (string.IsNullOrEmpty(property))
				throw new ArgumentNullException("property", "Css property name must be specified.");

			if (!HasCssStyle(styleValue, property))
				return styleValue;
			else
				return BuildCssRegex(property).Replace(styleValue, "$1$3");
		}

		private static Regex BuildClassRegex(string className)
		{
			return new Regex("(?:^|(?:(?<=[^\\s])(\\s+)))" + Regex.Escape(className) + "(?:(?:\\s+(?=[^\\s]))|$)");
		}

		public static bool HasClassName(string classValue, string className)
		{
			if (string.IsNullOrEmpty(className))
				throw new ArgumentNullException("className", "Class name must be specified.");

			return !string.IsNullOrEmpty(classValue) && BuildClassRegex(className).IsMatch(classValue);
		}

		public static string EnsureClassName(string classValue, string className)
		{
			if (string.IsNullOrEmpty(className))
				throw new ArgumentNullException("className", "Class name must be specified.");

			if (HasClassName(classValue, className))
				return classValue;
			else
				return (string.IsNullOrEmpty(classValue) ? "" : classValue + " ") + className;
		}

		public static string RemoveClassName(string classValue, string className)
		{
			if (string.IsNullOrEmpty(className))
				throw new ArgumentNullException("className", "Class name must be specified.");

			if (string.IsNullOrEmpty(classValue))
				return "";
			else
				return BuildClassRegex(className).Replace(classValue, "$1").TrimEnd();
		}
	}
}
