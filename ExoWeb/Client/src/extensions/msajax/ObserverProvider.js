function raiseSpecificPropertyChanged(target, args) {
	var func = target.__propertyChangeHandlers[args.get_propertyName()];
	if (func && func instanceof Function) {
		func.apply(this, arguments);
	}
}

setObserverProvider({

	makeObservable: Sys.Observer.makeObservable,

	disposeObservable: Sys.Observer.disposeObservable,

	addCollectionChanged: Sys.Observer.addCollectionChanged,

	removeCollectionChanged: Sys.Observer.removeCollectionChanged,

	addPropertyChanged: function Sys$Observer$addSpecificPropertyChanged(target, property, handler) {
		if (!target.__propertyChangeHandlers) {
			target.__propertyChangeHandlers = {};
			Sys.Observer.addPropertyChanged(target, raiseSpecificPropertyChanged);
		}

		var func = target.__propertyChangeHandlers[property];

		if (!func) {
			target.__propertyChangeHandlers[property] = func = ExoWeb.Functor();
		}

		func.add(handler);
	},

	removePropertyChanged: function Sys$Observer$removeSpecificPropertyChanged(target, property, handler) {
		var func = target.__propertyChangeHandlers ? target.__propertyChangeHandlers[property] : null;

		if (func) {
			func.remove(handler);

			// if the functor is empty then remove the callback as an optimization
			if (func.isEmpty()) {
				delete target.__propertyChangeHandlers[property];

				var hasHandlers = false;
				for (var remainingHandler in target.__propertyChangeHandlers) {
					if (target.__propertyChangeHandlers.hasOwnProperty(remainingHandler)) {
						hasHandlers = true;
					}
				}

				if (!hasHandlers) {
					target.__propertyChangeHandlers = null;
					Sys.Observer.removePropertyChanged(target, raiseSpecificPropertyChanged);
				}
			}
		}
	},

	raisePropertyChanged: Sys.Observer.raisePropertyChanged,

	setValue: Sys.Observer.setValue
});