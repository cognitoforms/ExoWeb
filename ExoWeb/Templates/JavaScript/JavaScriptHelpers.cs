using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace ExoWeb.Templates.JavaScript
{
	public static class JavaScriptHelpers
	{
		public static bool IsTruthy(object value)
		{
			if (value == null)
				return false;

			if (value is char)
				return true;

			if (value is string)
				return ((string)value).Length > 0;

			if (value is bool)
				return (bool)value;

			if (value is sbyte)
				return (sbyte)value != 0;

			if (value is byte)
				return (byte)value != 0;

			if (value is short)
				return (short)value != 0;

			if (value is ushort)
				return (ushort)value != 0;

			if (value is int)
				return (int)value != 0;

			if (value is uint)
				return (uint)value != 0;

			if (value is long)
				return (long)value != 0;

			if (value is ulong)
				return (ulong)value != 0;

			if (value is double)
				return (double)value != 0;

			if (value is float)
				return (float)value != 0;

			if (value is decimal)
				return (decimal)value != 0;

			return true;
		}

		/// <summary>
		/// Tries to parse a JavaScript constant value.
		/// </summary>
		/// <param name="text"></param>
		/// <returns></returns>
		public static bool TryParseConstant(string text, out object result)
		{
			if (text == "true")
			{
				result = true;
				return true;
			}
			else if (text == "false")
			{
				result = false;
				return true;
			}
			else if ((text.StartsWith("'") && text.EndsWith("'")) || (text.StartsWith("\"") && text.EndsWith("\"")))
			{
				result = text.Substring(1, text.Length - 2);
				return true;
			}
			else if (Regex.IsMatch(text, "^\\d+$"))
			{
				result = int.Parse(text);
				return true;
			}
			else if (Regex.IsMatch(text, "^\\d*\\.\\d+$"))
			{
				result = double.Parse(text);
				return true;
			}

			result = null;
			return false;
		}

		/// <summary>
		/// Parses a JavaScript constant value.
		/// </summary>
		/// <param name="text"></param>
		/// <returns></returns>
		public static object ParseConstant(string text)
		{
			object result;
			if (!TryParseConstant(text, out result))
				throw new Exception("The text \"" + text + "\" does not represent a JavaScript constant value.");

			return result;
		}
	}
}
