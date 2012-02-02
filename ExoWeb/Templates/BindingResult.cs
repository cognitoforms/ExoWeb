using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;

namespace ExoWeb.Templates
{
	/// <summary>
	/// Represents the result of evaluating a binding expression.
	/// </summary>
	public class BindingResult
	{
		internal static readonly BindingResult Invalid = new BindingResult();

		public object Value { get; set; }

		public ModelInstance Source { get; set; }

		public ModelProperty Property { get; set; }

		public bool IsValid { get; set; }
	}
}
