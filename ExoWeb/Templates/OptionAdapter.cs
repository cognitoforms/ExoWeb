using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;

namespace ExoWeb.Templates
{
	public class OptionAdapter : IBindable
	{
		internal OptionAdapter(Adapter adapter, object value)
		{
			this.Parent = adapter;
			this.RawValue = value;
		}

		#region Properties
		/// <summary>
		/// The option's parent adapter
		/// </summary>
		public Adapter Parent { get; private set; }

		/// <summary>
		/// The underlying value that the option represents
		/// </summary>
		public object RawValue { get; private set; }

		/// <summary>
		/// The display (human-readable) representation of the option
		/// </summary>
		string DisplayValue
		{
			get
			{
				string value;
				Adapter.TryGetDisplayValue(Parent.Property, Parent.Format, RawValue, out value);
				return value;
			}
		}

		/// <summary>
		/// The system (non-human-readable) representation of the option
		/// </summary>
		string SystemValue
		{
			get
			{
				string systemValue;
				Adapter.TryGetSystemValue(Parent.Property, RawValue, out systemValue);
				return systemValue;
			}
		}

		/// <summary>
		/// Whether or not this object is a currently selected value
		/// </summary>
		public bool Selected
		{
			get
			{
				return Parent.IsList ?
					((IEnumerable<ModelInstance>)Parent.RawValue).Contains((ModelInstance)RawValue) :
					RawValue.Equals(Parent.RawValue);
			}
		}
		#endregion

		#region Jurassic Interface
		BindingResult IBindable.Evaluate(string expression)
		{
			bool isValid = false;
			object value = null;

			switch (expression)
			{
				case "parent":
					isValid = true;
					value = Parent;
					break;
				case "selected":
					isValid = true;
					value = Selected;
					break;
				case "rawValue":
					isValid = true;
					value = RawValue;
					break;
				case "displayValue":
					string displayValue;
					isValid = Adapter.TryGetDisplayValue(Parent.Property, Parent.Format, RawValue, out displayValue);
					value = displayValue;
					break;
				case "systemValue":
					string systemValue;
					if (!(isValid = Adapter.TryGetSystemValue(Parent.Property, RawValue, out systemValue)))
						throw new ApplicationException("Cannot obtain a system value since the given object is invalid for the property");
					value = systemValue;
					break;
			}

			return new BindingResult() { IsValid = isValid, Value = value };
		}
		#endregion
	}
}
