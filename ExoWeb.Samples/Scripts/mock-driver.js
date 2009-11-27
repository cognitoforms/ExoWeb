
// Sys.require(ExoWeb.Mock)???
//with (ExoWeb.Mock) {

ExoWeb.Mock.typeProvider({ delay: 10 });
ExoWeb.Mock.objectProvider({ delay: 200 });
ExoWeb.Mock.listProvider({ delay: 500 });

ExoWeb.Mock.types({
	Driver: {
		properties: {
			Id: { type: "String" },
			Name: { type: "String" },
			PhoneNumber: { type: "String", format: "Phone", rules: [{ required: null}] },
			Owner: { type: "CarOwner" },
			Cars: { type: "Car", isList: true, rules: [{ allowedValues: "Dealer.AvailableCars" }] },
			BirthDate: { type: "Date", format: "ShortDate" },
			Dealer: { type: "Dealer", rules: [{ allowedValues: "Dealer.All"}] },
			MilesDriven: { type: "Number", rules: [{ range: { minimum: 0}}] }
		}
	},
	Car: {
		properties: {
			Id: { type: "String" },
			Name: { type: "String" },
			Driver: { type: "Driver" }
		}
	},
	Dealer: {
		properties: {
			Id: { type: "String" },
			Name: { type: "String" },
			PhoneNumber: { type: "String", format: "Phone" },
			AvailableCars: { type: "Car", isList: true }
		}
	},
	CarOwner: {
		properties: {
			Id: { type: "String" },
			Name: { type: "String" },
			Location: { type: "OwnerLocation", rules: [{ allowedValues: "AvailableLocations"}] },
			AvailableLocations: { type: "OwnerLocation", isList: true }
		}
	},
	OwnerLocation: {
		properties: {
			Id: { type: "String" },
			Name: { type: "String" },
			Address: { type: "LocationAddress" }
		}
	},
	LocationAddress: {
		properties: {
			Id: { type: "String" },
			State: { type: "AddressState" }
		}
	},
	AddressState: {
		properties: {
			Id: { type: "String" },
			Abbreviation: { type: "String" },
			Name: { type: "String" }
		}
	}
});

ExoWeb.Mock.objects({
	Driver: {
		1: {
			Id: "1",
			Name: "Bryan Matthews",
			Cars: ["1", "2"],
			Owner: "1",
			BirthDate: new Date("02/07/1985"),
			PhoneNumber: "803-608-7508",
			Dealer: "1",
			MilesDriven: 100000
		}
	},
	Car: {
		1: {
			Id: "1",
			Name: "Sentra",
			Driver: "1"
		},
		2: {
			Id: "2",
			Name: "Bike",
			Driver: "1"
		}
	},
	Dealer: {
		1: {
			Id: "1",
			Name: "Dick Smith Nissan",
			AvailableCars: ["1", "2"]
		},
		2: {
			Id: "2",
			Name: "Johnny's Suzuki",
			AvailableCars: []
		}
	},
	CarOwner: {
		1: {
			Id: "1",
			Name: "Bob",
			Location: "1",
			AvailableLocations: ["1", "2"]
		}
	},
	OwnerLocation: {
		1: {
			Id: "1",
			Name: "Home",
			Address: "1"
		},
		2: {
			Id: "2",
			Name: "Work",
			Address: "2"
		}
	},
	LocationAddress: {
		1: {
			Id: "1",
			State: "1"
		},
		2: {
			Id: "2",
			State: "1"
		}
	},
	AddressState: {
		1: {
			Id: "1",
			Abbreviation: "NY",
			Name: "New York"
		}
	}
});