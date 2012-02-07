using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using ExoModel;
using ExoWeb.Templates.JavaScript;

namespace ExoWeb.Templates
{
	public abstract class Page
	{
		static JavaScript.IScriptEngineFactory scriptEngineFactory = new JavaScript.ScriptEngineFactory();

		[ThreadStatic]
		static Page current;

		JavaScript.ContextWrapper globalContext;

		public Page()
		{
			Templates = new List<ITemplate>();
			Model = new Dictionary<string, object>();
			BeginContext(null, null);
		}

		internal JavaScript.ContextWrapper GlobalContext
		{
			get
			{
				if (globalContext == null)
					globalContext = new JavaScript.ContextWrapper(ScriptEngineFactory.GetScriptEngine(), this);
				return globalContext;
			}
		}

		public List<ITemplate> Templates { get; private set; }

		public Dictionary<string, object> Model { get; private set; }

		public Context Context { get; private set; }

		public static Page Current
		{
			get
			{
				HttpContext webCtx = HttpContext.Current;
				Page page;


				// If in a web request, store the reference in HttpContext
				if (webCtx != null)
					page = webCtx.Items["ExoWeb.Page"] as Page;
				else
					page = current;

				if (page == null)
				{
					page = new MicrosoftAjax.AjaxPage();

					if (webCtx != null)
						HttpContext.Current.Items["ExoWeb.Page"] = page;
					else
						current = page;
				}

				return page;
			}
		}

		internal static JavaScript.IScriptEngineFactory ScriptEngineFactory
		{
			get
			{
				return scriptEngineFactory;
			}
		}

		internal static JavaScript.Marshaler ScriptMarshaller
		{
			get
			{
				JavaScript.Marshaler scriptMarshaller = null;

				if (HttpContext.Current != null)
					scriptMarshaller = (JavaScript.Marshaler)HttpContext.Current.Items["ExoWeb.Page.ScriptMarshaller"];

				if (scriptMarshaller == null)
					scriptMarshaller = new JavaScript.Marshaler(ScriptEngineFactory.GetScriptEngine());

				return scriptMarshaller;
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
			return BeginContextInternal(dataItem, null, variables);
		}

		/// <summary>
		/// Begins a new template context as a child of the current context. 
		/// </summary>
		/// <param name="dataItem"></param>
		/// <param name="variables"></param>
		/// <returns></returns>
		public Context BeginContext(object dataItem, int index, IEnumerable<KeyValuePair<string, object>> variables)
		{
			return BeginContextInternal(dataItem, index, variables);
		}

		/// <summary>
		/// Begins a new template context as a child of the current context. 
		/// </summary>
		/// <param name="dataItem"></param>
		/// <param name="variables"></param>
		/// <returns></returns>
		Context BeginContextInternal(object dataItem, int? index, IEnumerable<KeyValuePair<string, object>> variables)
		{
			return Context = new Context() { Page = this, DataItem = dataItem, Index = index, Variables = variables ?? Context.NoVariables, ParentContext = Context };
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

		public abstract IEnumerable<ITemplate> ParseTemplates(string template);

		public abstract IEnumerable<ITemplate> LoadTemplates(string path);

		/// <summary>
		/// Gets the result of evaluating the specified path in the current data context.
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		public BindingResult EvaluatePath(string path)
		{
			var result = new BindingResult();

			// Return the current context if a path was not specified
			if (String.IsNullOrEmpty(path))
			{
				result.Value = Context.DataItem;
				result.IsValid = true;
				if (Context.DataItem is Adapter)
				{
					var adapter = (Adapter)Context.DataItem;
					result.Source = adapter.Source;
					result.Property = adapter.Property;
				}
				return result;
			}

			// Default the context to the current template context data item
			var context = Context.DataItem;

			// First see if the binding expression represents a model level source
			if (path.StartsWith("window.context.model."))
				path = path.Substring(7);
			if (path.StartsWith("context.model."))
			{
				path = path.Substring(14);
				var index = path.IndexOf('.');
				var model = index > 0 ? path.Substring(0, index) : path;

				// Attempt to fetch the specified model value
				if (Model.TryGetValue(model, out context) && context != null)
				{
					// Immediately return if this is the end of the path
					if (index < 0)
					{
						result.IsValid = true;
						result.Value = context;
						return result;
					}

					// Trim the path down to the unevaluated portion
					path = path.Substring(index + 1);
				}


			}

			// Otherwise see if the path represents a static property
			else
			{
				ModelSource source;
				// Return immediately if the path does not represent a valid static property
				if (!ModelSource.TryGetSource(null, path, out source))
					return result;

				result.IsValid = true;
				result.Property = ModelContext.Current.GetModelType(source.SourceType).Properties[source.SourceProperty];
				result.Value =
					result.Property is ModelValueProperty ? source.GetValue(null) :
					result.Property.IsList ? (object)source.GetList(null) :
					source.GetReference(null);
				return result;
			}

			// Transform grouping
			if (context is Transform.Grouping)
			{
				object groupResult;
				if (((Transform.Grouping)context).TryGetValue(path, out path, out groupResult))
				{
					context = result.Value = groupResult;

					if (string.IsNullOrEmpty(path))
					{
						result.IsValid = true;
						return result;
					}
				}
			}

			// ModelInstance
			if (context is ModelInstance)
			{
				result.Source = context as ModelInstance;

				// Exit immediately if the path is not valid
				ModelPath modelPath;
				if (!result.Source.Type.TryGetPath(path, out modelPath))
					return result;

				// Walk the path, honoring only first steps
				for (var step = modelPath.FirstSteps.First(); step != null; step = step.NextSteps.FirstOrDefault())
				{
					if (step.NextSteps.Any())
					{
						// Exit immediately if an intermediary step is a list
						if (step.Property.IsList)
							return result;

						// Attempt to walk the instance path if the current step is valid
						if (result.Source != null)
							result.Source = result.Source.Type.Properties.Contains(step.Property) ? result.Source.GetReference((ModelReferenceProperty)step.Property) : null;
					}
					else
						result.Property = step.Property;
				}

				// Indicate that the result is now considered valid since the path could be walked
				result.IsValid = true;

				// Attempt to evaluate the last step along the path
				if (result.Source != null)
				{
					// Evaluate the last step along the path
					if (result.Property is ModelValueProperty)
						result.Value = result.Source.GetValue((ModelValueProperty)result.Property);
					else if (result.Property.IsList)
						result.Value = result.Source.GetList((ModelReferenceProperty)result.Property);
					else
						result.Value = result.Source.GetReference((ModelReferenceProperty)result.Property);
				}

				return result;
			}

			// IBindable
			if (context is IBindable)
				return ((IBindable)context).Evaluate(path);

			// Invalid
			return result;
		}
	}
}
