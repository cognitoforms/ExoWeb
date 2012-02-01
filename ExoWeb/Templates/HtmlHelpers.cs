using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates
{
	public static class HtmlHelpers
	{
		public static bool IsBooleanAttribute(string attribute, string tagName)
		{
			return IsBooleanAttribute(attribute, tagName, null, false);
		}

		public static bool IsBooleanAttribute(string attribute, string tagName, string inputType)
		{
			return IsBooleanAttribute(attribute, tagName, inputType, true);
		}

		/// <summary>
		/// Returns a value indicating whether the given attribute for the given
		/// tag name corresponds to a boolean attribute.
		/// http://stackoverflow.com/a/707702/170990
		/// </summary>
		/// <returns></returns>
		public static bool IsBooleanAttribute(string attribute, string tagName, string inputType, bool requireInputTypeMatch)
		{
			bool result;

			switch (attribute)
			{
				case "checked":
					result = tagName == "input" && (!requireInputTypeMatch || inputType == "checkbox" || inputType == "radio");
					break;
				case "selected":
					result = tagName == "option";
					break;
				case "disabled":
					result = tagName == "input" || tagName == "textarea" || tagName == "button" || tagName == "select" || tagName == "option" || tagName == "optgroup";
					break;
				case "readonly":
					result = (tagName == "input" && (!requireInputTypeMatch || inputType == "text" || inputType == "password")) || tagName == "textarea";
					break;
				case "multiple":
					result = tagName == "select";
					break;
				case "ismap":
					result = tagName == "img" || (tagName == "input" && (!requireInputTypeMatch || inputType == "image"));
					break;
				case "defer":
					result = tagName == "script";
					break;
				case "declare":
					result = tagName == "object";
					break;
				case "noresize":
					result = tagName == "frame";
					break;
				case "nowrap":
					result = tagName == "td" || tagName == "th";
					break;
				case "noshade":
					result = tagName == "hr";
					break;
				case "compact":
					result = tagName == "ul" || tagName == "ol" || tagName == "dl" || tagName == "menu" || tagName == "dir";
					break;
				default:
					result = false;
					break;
			}

			return result;
		}

		readonly static string[] selfClosingTags = new string[] { "area", "base", "basefont", "br", "col", "frame", "hr", "img", "input", "link", "meta", "param" };

		/// <summary>
		/// Determines whether the given tag can close itself, i.e. [tag /] in place of [tag][/tag].
		/// http://stackoverflow.com/questions/97522/what-are-all-the-valid-self-closing-tags-in-xhtml-as-implemented-by-the-major-b
		/// </summary>
		/// <param name="tag"></param>
		/// <returns></returns>
		internal static bool IsSelfClosing(string tag)
		{
			return selfClosingTags.Contains(tag.ToLower());
		}
	}
}
