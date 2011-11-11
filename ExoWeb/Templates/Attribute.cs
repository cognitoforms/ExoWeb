﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Represents an attribute of an HTML element that may be bound.
	/// </summary>
	public class Attribute
	{
		public string Name { get; internal set; }

		public string Value { get; internal set; }

		public Binding Binding { get; internal set; }

		public override string ToString()
		{
			return String.Format("{0}=\"{1}\"", Name, Value);
		}
	}
}
