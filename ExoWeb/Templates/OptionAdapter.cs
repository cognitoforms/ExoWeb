using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;

namespace ExoWeb.Templates
{
	public class OptionAdapter : IBindable
	{
		internal OptionAdapter(Adapter adapter, GraphInstance instance)
		{
			this.Parent = adapter;
			this.RawValue = instance;
		}

		public Adapter Parent { get; private set; }

		public GraphInstance RawValue { get; private set; }

		public object DisplayValue
		{
			get
			{
				return Parent.GetDisplayFormat(RawValue);
			}
		}

		public object SystemValue
		{
			get
			{
				return Parent.GetSystemFormat(RawValue);
			}
		}

		public bool Selected
		{
			get
			{
				return Parent.IsList ?
					((IEnumerable<GraphInstance>)Parent.RawValue).Contains(RawValue) :
					RawValue.Equals(Parent.RawValue);
			}
		}

		object IBindable.Evaluate(string expression)
		{
			switch (expression)
			{
				case "parent":
					return Parent;
				case "selected":
					return Selected;
				case "rawValue":
					return RawValue;
				case "displayValue":
					return DisplayValue;
				case "systemValue":
					return SystemValue;
			}
			return null;
		}
	}
}
