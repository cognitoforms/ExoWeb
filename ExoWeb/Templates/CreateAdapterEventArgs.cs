using System;
using System.Collections.Generic;
using ExoModel;
using ExoWeb.Templates.MicrosoftAjax;

namespace ExoWeb.Templates
{
	public class CreateAdapterEventArgs : EventArgs
	{
		Binding binding;
		ModelInstance source;
		ModelProperty property;
		private IDictionary<string, string> modifiedParameters;

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

		internal IDictionary<string, string> ModifiedParameters
		{
			get
			{
				return modifiedParameters;
			}
		}

		public bool HasParameter(string key)
		{
			return (modifiedParameters ?? binding.Parameters).ContainsKey(key);
		}

		public string GetParameterValue(string key)
		{
			string value;

			(modifiedParameters ?? binding.Parameters).TryGetValue(key, out value);

			return value;
		}

		public void SetParameterValue(string key, string value)
		{
			if (modifiedParameters == null)
				modifiedParameters = new Dictionary<string, string>(binding.Parameters);

			modifiedParameters[key] = value;
		}
	}
}
