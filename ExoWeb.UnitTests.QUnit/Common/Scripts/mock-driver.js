if (ExoWeb.Mock) {
	//ExoWeb.Mock.typeProviderDelay = 10;
	//ExoWeb.Mock.objectProviderDelay = 200;
	//ExoWeb.Mock.listProviderDelay = 500;

	ExoWeb.Mock.types({
		Person: {
			properties: {
				Name: { type: "String" },
				BirthDate: { type: "Date", format: "ShortDate" },
				Age: { type: "Number" },
				PhoneNumber: { type: "String", format: "Phone" }
			}
		},
		Driver: {
			baseType: "Person",
			properties: {
				Owner: { type: "CarOwner" },
				Cars: { type: "Car>Product", isList: true },
				PrimaryCar: { type: "Car>Product" },
				Dealer: { type: "Dealer>Person" },
				MilesDriven: { type: "Number" },
				MilesDrivenQuota: { type: "Number" },
				DateCreated: { type: "Date" },
				RetirementGoalDate: { type: "Date" },
				SalesPerson: { type: "Employee>Person" },
				AllowedSalesPersons: { type: "Employee>Person", isList: "true" },
				Notes: { type: "String" }
			}
		},
		Employee: {
			baseType: "Person",
			properties: {
				All: { type: "Employee>Person", isList: true, isStatic: true },
				Title: { type: "String" },
				Salary: { type: "Number" },
				HireDate: { type: "Date" }
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
				Driver: { type: "Driver>Person" },
				OriginalOwner: { type: "CarOwner" }
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
				Location: { type: "OwnerLocation" },
				AvailableLocations: { type: "OwnerLocation", isList: true },
				Partner: { type: "CarOwner" },
				Drivers: { type: "Driver>Person", isList: true }
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

	ExoWeb.Mock.conditionTypes({
		"Person.NameRequired": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Person.NameRequired",
			category: "Error",
			message: "Name is required.",
			rule: { clientRuleType: "required", rootType: "Person", properties: ["this.Name"] }
		},
		"Person.NameLength": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Person.NameLength",
			category: "Error",
			message: "Name must be no more than 40 characters.",
			rule: { clientRuleType: "stringLength", rootType: "Person", max: 40, properties: ["this.Name"] }
		},
		"Person.PhoneNumberRequired": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Person.PhoneNumberRequired",
			category: "Error",
			message: "PhoneNumber is required.",
			rule: { clientRuleType: "required", rootType: "Person", properties: ["this.PhoneNumber"] }
		},
		"Driver.AgeGreaterThanEqual16": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.AgeGreaterThanEqual16",
			category: "Error",
			message: "Driver must be at least 16 years of age.",
			rule: { clientRuleType: "range", min: 16, rootType: "Driver", properties: ["this<Person>.Age"] }
		},
		"Driver.DealerRequired": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.DealerRequired",
			category: "Error",
			message: "Dealer is required.",
			rule: { clientRuleType: "required", rootType: "Driver", properties: ["this.Dealer"] }
		},
		"Driver.DateCreatedCompare": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.DateCreatedCompare",
			category: "Error",
			message: "Driver.DateCreated must be greater than or equal to BirthDate",
			rule: { clientRuleType: "compare", rootType: "Driver", comparePath: "this.BirthDate", compareOp: "GreaterThanEqual", properties: ["this.DateCreated"] }
		},
		"Driver.DealerAllowedValues": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.DealerAllowedValues",
			category: "Error",
			message: "Dealer has an invalid value.",
			rule: { clientRuleType: "allowedValues", rootType: "Driver", source: "Dealer.All", properties: ["this.Dealer"] }
		},
		"Driver.CarsRequired": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.CarsRequired",
			category: "Error",
			message: "Cars is required.",
			rule: { clientRuleType: "required", rootType: "Driver", properties: ["this.Cars"] }
		},
		"Driver.CarsAllowedValues": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.CarsAllowedValues",
			category: "Error",
			message: "Cars has an invalid value.",
			rule: { clientRuleType: "allowedValues", rootType: "Driver", source: "this.Dealer.AvailableCars", properties: ["this.Cars"] }
		},
		"Driver.MilesDrivenRange": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.MilesDrivenRange",
			category: "Error",
			message: "MilesDriven must be at least 0.",
			rule: { clientRuleType: "range", rootType: "Driver", min: 0, properties: ["this.MilesDriven"] }
		},
		"Driver.MilesDrivenQuota": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.MilesDrivenQuota",
			category: "Error",
			message: "MilesDriven must be at least {0}.",
			rule: { clientRuleType: "compare", rootType: "Driver", comparePath: "this.MilesDrivenQuota", compareOp: "GreaterThanEqual", properties: ["this.MilesDriven", "this.MilesDrivenQuota"] }
		},
		"Driver.AllowedSalesPerson": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.AllowedSalesPerson",
			category: "Error",
			message: "SalesPerson has an invalid value.",
			rule: { clientRuleType: "allowedValues", rootType: "Driver", source: "this.AllowedSalesPersons", properties: ["this.SalesPerson"] }
		},
		"Driver.NotesLength": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.NotesLength",
			category: "Error",
			message: "Notes must be no more than 100 characters.",
			rule: { clientRuleType: "stringLength", rootType: "Driver", max: 100, properties: ["this.Notes"] }
		},
		"CarOwner.LocationAllowedValues": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "CarOwner.LocationAllowedValues",
			category: "Error",
			message: "Location has an invalid value.",
			rule: { clientRuleType: "allowedValues", rootType: "CarOwner", source: "this.AvailableLocations", properties: ["this.Location"] }
		},
		"Driver.PrimaryCarRequiredIf": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.PrimaryCarRequiredIf",
			category: "Error",
			message: "Primary Car is required.",
			rule: { clientRuleType: "requiredIf", rootType: "Driver", comparePath: "this.Cars", properties: ["this.PrimaryCar", "this.Cars"] }
		},
		"Driver.RetirementGoalDateRequiredIf": {
			__type: "Error:#ExoWeb",
			sets: null,
			code: "Driver.RetirementGoalDateRequiredIf",
			category: "Error",
			message: "Retirement Goal Date is required.",
			rule: { clientRuleType: "requiredIf", rootType: "Driver", comparePath: "this.MilesDriven", compareOp: "GreaterThan", compareValue: 200000, properties: ["this.RetirementGoalDate", "this.MilesDriven"] }
		}
	});

	ExoWeb.Mock.objects({
		Employee: {
			static: {
				All: [{ id: "100" }, { id: "101" }, { id: "102"}]
			},
			"100": {
				Name: "Joe Salesperson",
				BirthDate: new Date("03/01/1987"),
				Age: 23,
				PhoneNumber: "123-123-1234",
				Title: "Salesperson",
				HireDate: new Date("1/1/2005")
			},
			"101": {
				Name: "New Salesperson",
				BirthDate: new Date("12/22/1980"),
				Age: 29,
				PhoneNumber: "123-123-1234",
				Title: "Salesperson",
				HireDate: new Date("1/1/2009")
			},
			"102": {
				Name: "Jane Manager",
				BirthDate: new Date("01/30/1956"),
				Age: 54,
				PhoneNumber: "123-123-1234",
				Title: "Manager"
			},
			"103": {
				Name: null,
				BirthDate: new Date("01/01/1912"),
				Age: 98,
				PhoneNumber: "123-123-1234",
				Title: "Unknown"
			}
		},
		Driver: {
			"1": {
				Name: "Bryan Matthews",
				Cars: [{ id: "1", type: "NewCar>Car" }, { id: "2", type: "UsedCar>Car"}],
				PrimaryCar: { id: "1", type: "NewCar>Car" },
				Owner: { id: "1" },
				BirthDate: new Date("07/01/1980"),
				Age: 30,
				PhoneNumber: "800-123-4567",
				Dealer: { id: "1" },
				MilesDriven: 100000,
				RetirementGoalDate: null,
				DateCreated: new Date("1/1/2007"),
				SalesPerson: { id: "100" },
				AllowedSalesPersons: [ { id: "100" }, { id: "101" } ],
				Notes: null
			}
		},
		Car: {
			"3": {
				Name: "Tank",
				Driver: null,
				OriginalOwner: { id: "2" }
			}
		},
		NewCar: {
			"1": {
				Name: "Sentra",
				Driver: { id: "1" },
				PlantNumber: "AZ9",
				OriginalOwner: { id: "1" }
			},
			"100": {
				Name: "Focus",
				Driver: null,
				PlantNumber: "AZ9",
				OriginalOwner: { id: "2" }
			}
		},
		UsedCar: {
			"2": {
				Name: "Bike",
				Driver: { id: "1" },
				BoughtFrom: { id: "1" },
				Mileage: 100,
				OriginalOwner: { id: "2" }
			},
			"200": {
				Name: "Taurus",
				Driver: null,
				BoughtFrom: { id: "1" },
				Mileage: 68100,
				OriginalOwner: { id: "2" }
			}
		},
		Dealer: {
			static: {
				All: [{ id: "1" }, { id: "2"}]
			},
			"1": {
				Name: "Dick Smith Nissan",
				AvailableCars: [{ id: "1" }, { id: "2" }, { id: "3"}]
			},
			"2": {
				Name: "Johnny's Suzuki",
				AvailableCars: []
			}
		},
		CarOwner: {
			"1": {
				Name: "Bob",
				Location: { id: "1" },
				AvailableLocations: [{ id: "1" }, { id: "2"}],
				Partner: { id: "2" },
				Drivers: [{ id: "1"}]
			},
			"2": {
				Name: "Joe",
				Location: { id: "2" },
				AvailableLocations: [{ id: "1" }, { id: "2"}],
				Partner: { id: "1" },
				Drivers: []
			}
		},
		OwnerLocation: {
			"1": {
				Name: "Home",
				Address: { id: "1" }
			},
			"2": {
				Name: "Work",
				Address: { id: "2" }
			}
		},
		LocationAddress: {
			"1": {
				State: { id: "1" }
			},
			"2": {
				State: { id: "1" }
			}
		},
		AddressState: {
			"1": {
				Abbreviation: "NY",
				Name: "New York"
			}
		}
	});

	ExoWeb.Mock.conditionTargets({
		"Person.NameRequired": {
			targets: [{ instance: { id: "103", type: "Person" }, properties: ["Name"]}]
		}
	});

	ExoWeb.Mock.roundtrip({
		// no behavior by default
	});

	ExoWeb.Mock.save({
		// no behavior by default
	});
}
else {
	function getOwner(name, age/*, cars */) {
		var owner = {
			name: name,
			age: age,
			cars: []
		};

		Array.forEach(Array.prototype.slice.call(arguments), function(item, index) {
			if (index > 1) {
				owner.cars.push(item);
			}
		});

		return owner;
	}

	window.getOwner = getOwner;

	function getCar(make, owner) {
		var car = {
			make: make,
			owner: null
		};

		if (owner) {
			car.owner = owner;
			if (!Array.contains(owner.cars, car)) {
				owner.cars.push(car);
			}
		}

		return car;
	}

	window.getCar = getCar;

	function getDriver(name, age, car, owner) {
		var driver = {
			name:  name,
			age:  age,
			car: null
		};

		if (car) {
			driver.car = car;
			if (owner) {
				driver.car.owner = owner;
				if (!Array.contains(owner.cars, car)) {
					owner.cars.push(car);
				}
			}
		}

		return driver;
	}

	window.getDriver = getDriver;
}