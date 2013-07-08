(function () {

	"use strict";

	/*global ExoWeb, context, $exoweb */

	ExoWeb.Mapper.ServerSync.prototype.get_HasPendingChanges = function () {
		return this._changeLog.sets.some(function (set) {
			return set.changes.some(function (change) {
				return this.canSave(change);
			}, this);
		}, this);
	};

	ExoWeb.Mapper.ServerSync.prototype.get_PendingAction = function () {
		ExoWeb.logWarning("Property context.server.get_PendingRoundtrip() is obsolete.");
		return this.pendingServerEvent || this.pendingRoundtrip || this.pendingSave;
	};

	ExoWeb.Mapper.ServerSync.prototype.get_PendingServerEvent = function () {
		ExoWeb.logWarning("Property context.server.get_PendingServerEvent() is obsolete.");
		return this.pendingServerEvent;
	};

	ExoWeb.Mapper.ServerSync.prototype.set_PendingServerEvent = function (value) {
		var oldValue = this.pendingServerEvent;
		this.pendingServerEvent = value;

		if (oldValue !== value) {
			ExoWeb.Observer.raisePropertyChanged(this, "PendingAction");
		}
	};

	ExoWeb.Mapper.ServerSync.prototype.get_PendingRoundtrip = function () {
		ExoWeb.logWarning("Property context.server.get_PendingRoundtrip() is obsolete.");
		return this.pendingRoundtrip;
	};

	ExoWeb.Mapper.ServerSync.prototype.set_PendingRoundtrip = function (value) {
		var oldValue = this.pendingRoundtrip;
		this.pendingRoundtrip = value;

		if (oldValue !== value) {
			ExoWeb.Observer.raisePropertyChanged(this, "PendingAction");
		}
	};

	ExoWeb.Mapper.ServerSync.prototype.get_PendingSave = function () {
		ExoWeb.logWarning("Property context.server.get_PendingSave() is obsolete.");
		return this.pendingSave;
	};

	ExoWeb.Mapper.ServerSync.prototype.set_PendingSave = function (value) {
		var oldValue = this.pendingSave;
		this.pendingSave = value;

		if (oldValue !== value) {
			ExoWeb.Observer.raisePropertyChanged(this, "PendingAction");
		}
	};

	ExoWeb.Mapper.ServerSync.get_Changes = function (includeAllChanges) {
		ExoWeb.logWarning("Property context.server.get_Changes() is obsolete. Use method context.server.changes() instead.");
		return this.changes(includeAllChanges, null);
	};

	ExoWeb.Mapper.ServerSync.Save = function (root, success, failed) {
		ExoWeb.logWarning("Method ExoWeb.Mapper.ServerSync.Save(root, ...) is obsolete. Use method context.server.save(root, ...) instead.");
		root.meta.type.model.server.save(root, success, failed);
	};

	ExoWeb.Mapper.ServerSync.GetServerTimeZone = function (root) {
		ExoWeb.logWarning("Method ExoWeb.Mapper.ServerSync.GetServerTimeZone(root) is obsolete. Use property context.server.get_ServerTimezoneOffset() instead.");
		return root.meta.type.model.server.get_ServerTimezoneOffset();
	};

	$exoweb({
		contextReady: function () {

			context.server.addChangeDetected(function () {
				Observer.raisePropertyChanged(context.server, "HasPendingChanges");
			});

			context.server.pendingServerEvent = false;
			context.server.pendingRoundtrip = false;
			context.server.pendingSave = false;

			context.server.addRaiseServerEventBegin(function () {
				ExoWeb.Observer.setValue(this, "PendingServerEvent", true);
			});
			context.server.addRoundtripBegin(function () {
				ExoWeb.Observer.setValue(this, "PendingRoundtrip", true);
			});
			context.server.addSaveBegin(function () {
				ExoWeb.Observer.setValue(this, "PendingSave", true);
			});

			context.server.addRequestEnd(function (sender, args) {
				if (args.type === "raiseServerEvent") {
					ExoWeb.Observer.setValue(this, "PendingServerEvent", false);
				} else if (args.type === "roundtrip") {
					ExoWeb.Observer.setValue(this, "PendingRoundtrip", false);
				} else if (args.type === "save") {
					ExoWeb.Observer.setValue(this, "PendingSave", false);
				}
			});

		}
	});

}());
