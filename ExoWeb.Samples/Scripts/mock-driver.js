﻿
// Sys.require(ExoWeb.Mock)???
//with (ExoWeb.Mock) {

ExoWeb.Mock.typeProvider({ delay: 10 });
ExoWeb.Mock.objectProvider({ delay: 200 });
ExoWeb.Mock.listProvider({ delay: 500 });

ExoWeb.Mock.types({
	Person: {
		properties: {
			Name: { type: "String", rules: [{ required: {}}] },
			PhoneNumber: { type: "String", format: "Phone", rules: [{ required: {}}] }
		}
	},
	Driver: {
		baseType: "Person",
		properties: {
			Owner: { type: "CarOwner" },
			Cars: { type: "Car>Product", isList: true, rules: [{ allowedValues: { source: "this.Dealer.AvailableCars"}}] },
			BirthDate: { type: "Date", format: "ShortDate" },
			Dealer: { type: "Dealer>Person", rules: [{ allowedValues: { source: "Dealer.All"}}] },
			MilesDriven: { type: "Number", rules: [{ range: { min: 0}}] }
		}
	},
	Product: {
		properties: {
			Name: { type: "String" }
		}
	},
	Car: {
		baseType: "Product",
		properties: {
			Driver: { type: "Driver>Person" }
		}
	},
	NewCar: {
		baseType: "Car>Product",
		properties: {
			PlantNumber: {type: "String"}
		}
	},
	UsedCar: {
		baseType: "Car>Product",
		properties: {
			Mileage: { type: "Number" },
			BoughtFrom: { type: "Person" }
		}
	},
	Dealer: {
		baseType: "Person",
		properties: {
			All: { type: "Dealer>Person", isList: true, isStatic: true },
			AvailableCars: { type: "Car", isList: true }
		}
	},
	CarOwner: {
		properties: {
			Name: { type: "String" },
			Location: { type: "OwnerLocation", rules: [{ allowedValues: { source: "this.AvailableLocations"}}] },
			AvailableLocations: { type: "OwnerLocation", isList: true }
		}
	},
	OwnerLocation: {
		properties: {
			Name: { type: "String" },
			Address: { type: "LocationAddress" }
		}
	},
	LocationAddress: {
		properties: {
			State: { type: "AddressState" }
		}
	},
	AddressState: {
		properties: {
			Abbreviation: { type: "String" },
			Name: { type: "String" }
		}
	}
});

ExoWeb.Mock.objects({
	Driver: {
		1: {
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
			Name: "Sentra",
			Driver: "1"
		},
		2: {
			Name: "Bike",
			Driver: "1"
		},
		3: {
			Name: "Tank",
			Driver: null
		}
	},
	NewCar: {
		100: {
			Name: "Focus",
			Driver: null,
			PlantNumber: "AZ9"
		}
	},
	UsedCar: {
		200: {
			Name: "Taurus",
			Driver: null,
			BoughtFrom: "1",
			Mileage: 68100
		}
	},
	Dealer: {
		static: {
			All: ["1", "2"]
		},
		1: {
			Name: "Dick Smith Nissan",
			AvailableCars: ["1", "2", "3"]
		},
		2: {
			Name: "Johnny's Suzuki",
			AvailableCars: []
		}
	},
	CarOwner: {
		1: {
			Name: "Bob",
			Location: "1",
			AvailableLocations: ["1", "2"]
		}
	},
	OwnerLocation: {
		1: {
			Name: "Home",
			Address: "1"
		},
		2: {
			Name: "Work",
			Address: "2"
		}
	},
	LocationAddress: {
		1: {
			State: "1"
		},
		2: {
			State: "1"
		}
	},
	AddressState: {
		1: {
			Abbreviation: "NY",
			Name: "New York"
		}
	}
});