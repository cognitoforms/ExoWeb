
// Sys.require(ExoWeb.Mock)???
//with (ExoWeb.Mock) {

ExoWeb.Mock.typeProvider({ delay: 10 });
ExoWeb.Mock.objectProvider({ delay: 200 });
ExoWeb.Mock.listProvider({ delay: 500 });
ExoWeb.Mock.syncProvider({ delay: 1000 });

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
			PlantNumber: { type: "String" }
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
			AvailableLocations: { type: "OwnerLocation", isList: true },
			Partner: { type: "CarOwner" }
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
			Cars: [{ id: "1" }, { id: "2"}],
			Owner: { id: "1" },
			BirthDate: new Date("02/07/1985"),
			PhoneNumber: "803-608-7508",
			Dealer: { id: "1" },
			MilesDriven: 100000
		}
	},
	Car: {
		1: {
			Name: "Sentra",
			Driver: { id: "1" }
		},
		2: {
			Name: "Bike",
			Driver: { id: "1" }
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
			BoughtFrom: { id: "1" },
			Mileage: 68100
		}
	},
	Dealer: {
		static: {
			All: [{ id: "1" }, { id: "2"}]
		},
		1: {
			Name: "Dick Smith Nissan",
			AvailableCars: [{ id: "1" }, { id: "2" }, { id: "3"}]
		},
		2: {
			Name: "Johnny's Suzuki",
			AvailableCars: []
		}
	},
	CarOwner: {
		1: {
			Name: "Bob",
			Location: { id: "1" },
			AvailableLocations: [{ id: "1" }, { id: "2"}],
			Partner: { id: "2" }
		},
		2: {
			Name: "Joe",
			Location: { id: "2" },
			AvailableLocations: [{ id: "1" }, { id: "2"}],
			Partner: { id: "1" }
		}
	},
	OwnerLocation: {
		1: {
			Name: "Home",
			Address: { id: "1" }
		},
		2: {
			Name: "Work",
			Address: { id: "2" }
		}
	},
	LocationAddress: {
		1: {
			State: { id: "1" }
		},
		2: {
			State: { id: "1" }
		}
	},
	AddressState: {
		1: {
			Abbreviation: "NY",
			Name: "New York"
		}
	}
});

ExoWeb.Mock.sync({
	rules: [
		// when a new location is created set the Name property to "-- Brand New Location --"
		{
			test: function(change) {
				return change.__type == "Init:#ExoGraph" && change.Instance.Type == "OwnerLocation";
			},
			exec: function(change) {
				return new ChangeSet().val(change.Instance.Type, change.Instance.Id, "Name", null, "-- Brand New Location --").build();
			}
		},
		// when a new driver is created create a new owner and assign its "Owner" property
			{
			test: function(change) {
				return change.__type == "Init:#ExoGraph" && change.Instance.Type == "Driver";
			},
			exec: function(change) {
				var newOwnerId = "?" + change.Instance.Id;
				return new ChangeSet()
					.init("CarOwner", newOwnerId)
					.ref(change.Instance.Type, change.Instance.Id, "Owner", "CarOwner", null, newOwnerId)
					.build();
			}
		}
	]
});