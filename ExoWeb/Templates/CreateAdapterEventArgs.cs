using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoModel;
using ExoWeb.Templates.MicrosoftAjax;

namespace ExoWeb.Templates
{
	public class CreateAdapterEventArgs : EventArgs
	{
		Binding binding;
		ModelInstance source;
		ModelProperty property;

		internal CreateAdapterEventArgs(Binding binding, ModelInstance source, ModelProperty property)
		{
			this.binding = binding;
			this.source = source;
			this.property = property;
		}

		public string Extension
		{
			get
			{
				return binding.Extension;
			}
		}

		public ModelInstance Source
		{
			get
			{
				return source;
			}
		}

		public ModelProperty Property
		{
			get
			{
				return property;
			}
		}

		public bool HasParameter(string key)
		{
			return binding.Parameters.ContainsKey(key);
		}

		public string GetParameterValue(string key)
		{
			string value;
			binding.Parameters.TryGetValue(key, out value);
			return value;
		}

		public void SetParameterValue(string key, string value)
		{
			binding.Parameters[key] = value;
		}
	}
}
