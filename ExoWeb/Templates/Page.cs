using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.IO;
using System.Web;
using ExoGraph;

namespace ExoWeb.Templates
{
	public abstract class Page
	{
		public Page()
		{
			Templates = new List<ITemplate>();
			Model = new Dictionary<string, IEnumerable<GraphInstance>>();
			BeginContext(null, null);
		}

		public List<ITemplate> Templates { get; private set; }

		public Dictionary<string, IEnumerable<GraphInstance>> Model { get; private set; }

		public Context Context { get; private set; }

		public static Page Current
		{
			get
			{
				var page = HttpContext.Current.Items["ExoWeb.Page"] as Page;
				if (page == null)
					HttpContext.Current.Items["ExoWeb.Page"] = page = new MicrosoftAjax.AjaxPage();
				return page;
			}
		}

		/// <summary>
		/// Begins a new template context as a child of the current context. 
		/// </summary>
		/// <param name="dataItem"></param>
		/// <param name="variables"></param>
		/// <returns></returns>
		public Context BeginContext(object dataItem, IEnumerable<KeyValuePair<string, object>> variables)
		{
			return Context = new Context() { Page = this, DataItem = dataItem, Variables = variables ?? Context.NoVariables, ParentContext = Context };
		}

		/// <summary>
		/// Ends the current template context.
		/// </summary>
		public void EndContext()
		{
			if (Context != null)
				Context = Context.ParentContext;
		}

		public abstract ITemplate Parse(string template);

		public abstract IEnumerable<ITemplate> LoadTemplates(string path);

		/// <summary>
		/// Gets the data represented by the binding expression for the <see cref="DataView"/>, if available.
		/// </summary>
		/// <param name="page"></param>
		/// <returns></returns>
		public object EvaluatePath(string path, out GraphInstance source, out GraphProperty property)
		{
			// Initialize the source property to null
			property = null;
			source = null;

			// Return the current context if a path was not specified
			if (String.IsNullOrEmpty(path))
				return Context.DataItem;

			// Assume the binding path represents a property path separated by periods
			var steps = path.Split('.').ToList();

			// Remove unnecessary window steps
			if (steps[0] == "window")
				steps.RemoveAt(0);

			// Default the context to the current template context data item
			var context = Context.DataItem;

			// First see if the binding expression represents a model level source
			if (steps.Count > 2 && steps[0] == "context" && steps[1] == "model")
			{
				IEnumerable<GraphInstance> data;
				if (Model.TryGetValue(steps[2], out data))
				{
					// Immediately return if this is the end of the path
					if (steps.Count == 3)
						return data;

					// Return null if the model instance does not exist or incorrectly represents multiple instances
					if (data.Count() == 0 || data.Count() > 1)
						return null;

					// Set the context to the model instance
					context = data.First();
					steps.RemoveRange(0, 3);
				}
				else
					return null;
			}

			// Process the contextual path
			if (context is GraphInstance)
			{
				source = context as GraphInstance;
				for (int s = 0; s < steps.Count - 1; s++)
				{
					if (source == null)
						return null;
					var step = steps[s];
					var reference = ((GraphInstance)context).Type.Properties[step] as GraphReferenceProperty;
					if (reference == null || reference.IsList)
						return null;
					source = source.GetReference(reference);
				}
				if (source == null)
					return null;

				// Evaluate the last step along the path
				property = source.Type.Properties[steps.Last()];
				if (property == null)
					return null;
				if (property is GraphValueProperty)
					return source.GetValue((GraphValueProperty)property);
				if (((GraphReferenceProperty)property).IsList)
					return source.GetList((GraphReferenceProperty)property);
				return source.GetReference((GraphReferenceProperty)property);
			}

			// IBindable
			if (context is IBindable && steps.Count() == 1)
				return ((IBindable)context).Evaluate(steps[0]);

			return null;
		}
	}
}
