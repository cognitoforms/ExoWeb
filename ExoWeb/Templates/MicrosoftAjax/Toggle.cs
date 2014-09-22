using System;
using System.Linq;
using Jurassic.Library;
using ExoWeb.Templates.JavaScript;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a toggle control for conditionally rendering content.
	/// </summary>
	internal class Toggle : Control
	{
		private Binding className;

		/// <summary>
		/// Gets or sets the value that will be toggled on
		/// </summary>
		public Binding On { get; internal set; }

		/// <summary>
		/// When using addClass/removeClass mode, gets or sets
		/// the value of the css class that will be added or removed
		/// </summary>
		public Binding ClassName
		{
			get { return className; }
			internal set
			{
				if (value != null)
				{
					if (className != null)
						throw new Exception("Property toggle:classname has already been set.");

					className = value;
				}
			}
		}

		/// <summary>
		/// When using addClass/removeClass mode, gets or sets
		/// the value of the css class that will be added or removed
		/// </summary>
		public Binding Class
		{
			get { return className; }
			internal set
			{
				if (value != null)
				{
					if (className != null)
						throw new Exception("Toggle has both toggle:class and toggle:classname attributes.");

					className = value;
				}
			}
		}

		/// <summary>
		/// Gets or sets the toggling action
		/// </summary>
		public Binding Action { get; internal set; }

		/// <summary>
		/// Gets or sets the group name used by toggle group
		/// to identify this toggle as a member of a group
		/// </summary>
		public Binding GroupName { get; internal set; }

		/// <summary>
		/// Gets or sets a value indicating whether the toggle
		/// should check strictly for a boolean valuej
		/// </summary>
		public Binding StrictMode { get; internal set; }

		/// <summary>
		/// Gets or sets the logic or value that defines when the
		/// toggle is active
		/// </summary>
		public Binding When { get; internal set; }

		/// <summary>
		/// 
		/// </summary>
		/// <returns></returns>
		internal bool IsTemplate()
		{
			return IsTemplate(null);
		}

		/// <summary>
		/// 
		/// </summary>
		/// <param name="page"></param>
		/// <returns></returns>
		internal bool IsTemplate(AjaxPage page)
		{
			bool result = false;

			if (Action != null)
			{
				// action is literal render/dispose
				if (Action.Expression == "render" || Action.Expression == "dispose")
					result = true;
				else
				{
					// if not within a dataview or template, then any binding expressions
					// for toggle action would not be dependent on template context data,
					// so use the newly created page instance with a null context
					var action = Action.Evaluate(page == null ? Page.Current as AjaxPage : page);
					if (action.IsValid && (action.DisplayValue == "render" || action.DisplayValue == "dispose"))
						result = true;
				}
			}

			return result;
		}

		internal override void Abort(AjaxPage page, string[] templateNames, System.IO.TextWriter writer)
		{
			// Write out a render/dispose toggle since it will be interpreted as a template
			// and conditionally render.  Otherwise, the content within the toggle is not affected
			// by the toggle from a rendering perspective.
			if (IsTemplate(page))
				base.Abort(page, templateNames, writer);
			else
			{
				AttributeBinding contentTemplateBinding;
				if (!TryContentTemplate(page, templateNames, writer, out contentTemplateBinding))
				{
					base.Abort(page, templateNames, writer);
					return;
				}

				var ownTemplateNames = contentTemplateBinding != null ?
					((string) contentTemplateBinding.Value).Split(new[] {' '}, StringSplitOptions.RemoveEmptyEntries) :
					new string[0];

				RenderStartTag(page, writer,
					// replace data-sys-attach attribute with sys:attach and add data-continue attribute to notify client that children were allowed to render
					attributes => MergeAttribute(AbortSysAttachDataAttribute(attributes), "data-continue", value => "data-continue"),
					// abort rendering
					true,
					// pass in all binding attributes
					If == null ? null : If.Evaluate(page),
					On == null ? null : On.Evaluate(page),
					ClassName == null ? null : ClassName.Evaluate(page),
					Action == null ? null : Action.Evaluate(page),
					GroupName == null ? null : GroupName.Evaluate(page),
					StrictMode == null ? null : StrictMode.Evaluate(page),
					When == null ? null : When.Evaluate(page),
					contentTemplateBinding);

				// continue rendering child blocks in the same data context
				foreach (var block in Blocks)
					block.Render(page, templateNames.Concat(ownTemplateNames).ToArray(), writer);

				RenderEndTag(writer);
			}
		}

		internal override void Render(AjaxPage page, string[] templateNames, System.IO.TextWriter writer)
		{
			bool canRender;
			AttributeBinding ifBinding;
			if (!TryRenderIf(page, templateNames, writer, out ifBinding, out canRender))
			{
				Abort(page, templateNames, writer);
				return;
			}

			if (!canRender)
				return;

			// Output the original template if toggle on was not specified
			if (On == null)
			{
				Abort(page, templateNames, writer);
				return;
			}

			// Get the data associated with the data view
			var onBinding = On.Evaluate(page);

			// Output the original template if no data for on was found
			if (!onBinding.IsValid)
			{
				Abort(page, templateNames, writer);
				return;
			}

			var onValue = onBinding.Value;

			var classValue = "";
			var classBinding = (AttributeBinding)null;

			if (ClassName != null)
			{
				classBinding = ClassName.Evaluate(page);

				// Output the original template if no data for class was found
				if (!classBinding.IsValid)
				{
					Abort(page, templateNames, writer);
					return;
				}

				classValue = (string)classBinding.Value;
			}

			ToggleAction? actionValue;

			var actionBinding = (AttributeBinding)null;

			// Get the value of the toggle action (i.e.: show, hide, etc.)
			if (Action != null)
			{
				actionBinding = Action.Evaluate(page);

				// Output the original template if no data for action was found
				if (!actionBinding.IsValid)
				{
					Abort(page, templateNames, writer);
					return;
				}

				actionValue = (ToggleAction)Enum.Parse(typeof(ToggleAction), (string)actionBinding.Value, true);
			}
			else if (!string.IsNullOrEmpty(classValue))
				actionValue = ToggleAction.AddClass;
			else
				actionValue = ToggleAction.Show;

			var groupNameBinding = (AttributeBinding)null;

			if (GroupName != null)
			{
				groupNameBinding = GroupName.Evaluate(page);

				// Output the original template if no data for group name was found
				if (!groupNameBinding.IsValid)
				{
					Abort(page, templateNames, writer);
					return;
				}
			}

			var strictModeValue = false;
			var strictModeBinding = (AttributeBinding)null;

			if (StrictMode != null)
			{
				strictModeBinding = StrictMode.Evaluate(page);

				// Output the original template if no data for strict mode was found
				if (!strictModeBinding.IsValid)
				{
					Abort(page, templateNames, writer);
					return;
				}

				if (strictModeBinding.Value is bool)
					strictModeValue = (bool)strictModeBinding.Value;
				else
					strictModeValue = bool.Parse((string)strictModeBinding.Value);
			}

			bool? equals;

			var whenBinding = (AttributeBinding)null;

			// Evaluate whether the on and when conditions are equal or
			// satisified, which determines whether the toggle is on or off
			if (When == null)
			{
				if (strictModeValue)
				{
					// In strict mode the on value must be a boolean true
					if (!(onValue is bool))
						throw new ApplicationException(string.Format("With strict mode enabled, toggle:on should be a value of type Boolean, actual type \"{0}\".", onValue == null ? "null" : onValue.GetType().Name));

					equals = (bool) onValue;
				}
				else if (onValue is System.Collections.IEnumerable)
				{
					equals = false;

					// Satisfied if there are any items
					foreach (object o in (System.Collections.IEnumerable)onValue)
					{
						equals = true;
						break;
					}
				}
				else
				{
					// Otherwise, check to see that the on value is "truthy"
					equals = JavaScriptHelpers.IsTruthy(onValue);
				}
			}
			else
			{
				whenBinding = When.Evaluate(page);

				var whenValue = whenBinding.Value;

				if (whenValue == null)
					equals = (onValue == null);
				else if (whenValue is FunctionInstance)
				{
					object result;

					try
					{
						result = Page.ScriptMarshaller.Unwrap(((FunctionInstance)whenValue).Call(null, Page.ScriptMarshaller.Wrap(onValue)));
					}
					catch
					{
						Abort(page, templateNames, writer);
						return;
					}

					if (strictModeValue)
					{
						if (!(result is bool))
							throw new ApplicationException(string.Format("With strict mode enabled, toggle:when function should return a value of type Boolean, found type \"{0}\".", result == null ? "null" : result.GetType().Name));
						equals = (bool)result;
					}
					else
					{
						equals = JavaScriptHelpers.IsTruthy(result);
					}
				}
				else
				{
					equals = whenValue.Equals(onValue);
				}
			}

			// If no class value is defined then abort
			if ((actionValue == ToggleAction.AddClass || actionValue == ToggleAction.RemoveClass) && string.IsNullOrEmpty(classValue))
			{
				Abort(page, templateNames, writer);
				return;
			}

			bool render = actionValue == ToggleAction.Render || actionValue == ToggleAction.Dispose;

			AttributeBinding contentTemplateBinding;
			if (!TryContentTemplate(page, templateNames, writer, out contentTemplateBinding))
			{
				Abort(page, templateNames, writer);
				return;
			}

			var ownTemplateNames = contentTemplateBinding != null ?
				((string) contentTemplateBinding.Value).Split(new[] {' '}, StringSplitOptions.RemoveEmptyEntries) :
				new string[0];

			using (var context = render ? page.BeginContext(page.Context.DataItem, null) : null)
			{
				RenderStartTag(page, writer, attrs => MergeAttribute(MergeAttribute(MergeAttribute(attrs,
					"class", value =>
					{
						if (actionValue == ToggleAction.AddClass || actionValue == ToggleAction.RemoveClass)
						{
							if ((actionValue == ToggleAction.AddClass && equals.Value) || (actionValue == ToggleAction.RemoveClass && !equals.Value))
								value = AttributeHelper.EnsureClassName(value, classValue);
							else
								value = AttributeHelper.RemoveClassName(value, classValue);
						}

						// Add/remove the "toggle-on" and "toggle-off" classes based on state
						value = AttributeHelper.EnsureClassName(value, equals.Value ? "toggle-on" : "toggle-off");
						value = AttributeHelper.RemoveClassName(value, equals.Value ? "toggle-off" : "toggle-on");

						return value;
					}).ToArray(),
					"style", value =>
					{
						if (actionValue == ToggleAction.Show || actionValue == ToggleAction.Hide ||
							actionValue == ToggleAction.Render || actionValue == ToggleAction.Dispose)
						{
							if (((actionValue == ToggleAction.Show || actionValue == ToggleAction.Render) && equals.Value) ||
								((actionValue == ToggleAction.Hide || actionValue == ToggleAction.Dispose) && !equals.Value))
							{
								if (AttributeHelper.GetCssStyle(value, "display") == "none")
									value = AttributeHelper.RemoveCssStyle(value, "display");
							}
							else
								value = AttributeHelper.EnsureCssStyle(value, "display", "none");
						}

						return value;
					}).ToArray(),
					"disabled", value =>
					{
						if (actionValue == ToggleAction.Enable || actionValue == ToggleAction.Disable)
						{
							if ((actionValue == ToggleAction.Enable && equals.Value) || (actionValue == ToggleAction.Disable && !equals.Value))
								value = null;
							else
								value = "disabled";
						}

						return value;
					}), ifBinding, onBinding, classBinding, actionBinding, groupNameBinding, strictModeBinding, whenBinding, contentTemplateBinding,
					// If this is render/dispose, include the nested template index as a special attribute
					render ? new AttributeBinding(new Attribute() { Name = "data-sys-tmplidx", Value = NestedTemplateIndex.ToString() }, null) : null,
					render ? new AttributeBinding(new Attribute() { Name = "data-sys-tcindex", Value = context.Id }, null) : null);

				// Only render the inner blocks if the template would be rendered client-side
				if (!render || (actionValue == ToggleAction.Render && equals.Value) || (actionValue == ToggleAction.Dispose && !equals.Value))
				{
					foreach (var block in Blocks)
						block.Render(page, templateNames.Concat(ownTemplateNames).ToArray(), writer);
				}

				RenderEndTag(writer);
			}
		}

		public override string ToString()
		{
			return "<toggle on=\"" + On + "\" when=\"" + When + "\" strictmode=\"" + StrictMode + "\" groupname=\"" + GroupName + "\" classname=\"" + ClassName + "\" action=\"" + Action + "\" >";
		}

		/// <summary>
		/// Specifies the action that the toggle control will take
		/// depending on whether or not the condition evaulates to true.
		/// </summary>
		internal enum ToggleAction
		{
			/// <summary>
			/// The toggle element will only render if the condition passses.
			/// </summary>
			Render,

			/// <summary>
			/// The toggle element will NOT render if the condition passses.
			/// </summary>
			Dispose,

			/// <summary>
			/// The toggle element will be shown if the condition passses.
			/// </summary>
			Show,

			/// <summary>
			/// The toggle element will be hidden if the condition passses.
			/// </summary>
			Hide,

			/// <summary>
			/// Children of the toggle element will be enabled if the condition passses.
			/// </summary>
			Enable,

			/// <summary>
			/// Children of the toggle element will be disabled if the condition passses.
			/// </summary>
			Disable,

			/// <summary>
			/// The specified CSS class will be added to the toggle element if the condition passses.
			/// </summary>
			AddClass,

			/// <summary>
			/// The specified CSS class will be removed from the toggle element if the condition passses.
			/// </summary>
			RemoveClass
		}
	}
}
