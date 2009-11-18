window.data = {
	drivers: {
		__metadata: {
			Driver: {
				properties: {
					Id: { type: "String" },
					Name: { type: "String" },
					PhoneNumber: { type: "String", format: "Phone" },
					Owner: { type: "CarOwner" },
					Cars: { type: "Car", isList: true, allowed: "Dealer.AvailableCars" },
					BirthDate: { type: "Date", format: "ShortDate" },
					Dealer: { type: "Dealer", allowed: "Dealer.All" }
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
					Location: { type: "OwnerLocation", allowed: "AvailableLocations" },
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
		 },
		__data: {
			Driver: {
				1: {
					Id: "1",
					Name: "Bryan Matthews",
					Cars: [ "1", "2" ],
					Owner: "1",
					BirthDate: "02/07/1985",
					PhoneNumber: "803-608-7508",
					Dealer: "1"
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
					AvailableCars: [ "1", "2" ]
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
					AvailableLocations: [ "1", "2" ]
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
		}
	},
	programs: { 
		__metadata: {
			PrgIntervention: {
				properties: {
					Id: { type: "String" },
					StartStatus: { type: "PrgStatus" },
					Involvement: { type: "PrgInvolvement" },
					SubVariants: { type: "PrgSubVariant", isList: true, allowed: "Involvement.Variant.SubVariants" },
					StartDate: { type: "Date" },
					PlannedEndDate: { type: "Date" },
					Tools: { type: "IntvTool", isList: true },
					ToolDefs: { type: "IntvToolDef", isList: true }
				}
			},
			PrgStatus: {
				properties: {
					Id: { type: "String" },
					Name: { type: "String" }
				}
			},
			PrgInvolvement: {
				properties: {
					Id: { type: "String" },
					Variant: { type: "PrgVariant" }
				}
			},
			PrgVariant: {
				properties: {
					Id: { type: "String" },
					Name: { type: "String" },
					SubVariants: { type: "PrgSubVariant", isList: true }
				}
			},
			PrgSubVariant: {
				properties: {
					Id: { type: "String" },
					Name: { type: "String" }
				}
			},
			IntvTool: {
				properties: {
					Id: { type: "String" },
					Name: { type: "String" },
					ToolDef: { type: "IntvToolDef", allowed: "Intervention.ToolDefs" },
					Intervention: { type: "PrgIntervention" }
				}
			},
			IntvToolDef: {
				properties: {
					Id: { type: "String" },
					Name: { type: "String" }
				}
			}
		},
		__data: {
			PrgIntervention: {
				"01f8c34f-2836-400a-9855-2c0a257b0361": {
					Id: "01f8c34f-2836-400a-9855-2c0a257b0361",
					StartStatus: "a2316c5c-1b05-bd4e-8bfc-c2012b908a90",
					Involvement: "4c28ef2a-ce76-4449-aac5-0bd470b2f5cf",
					SubVariants: [ "e2003c24-0be1-9d48-9991-714877ae55f8" ],
					StartDate: "1/19/2009",
					PlannedEndDate: "1/21/2009",
					Tools: [ "128814d0-acbf-4ea8-8a65-9d1c0f073705" ],
					ToolDefs: [ "61f08a7b-e855-4425-b4f9-81666f49754f", "aa49e0e0-5c08-4f84-b747-4e4e8fd6731e", "73b2034f-f295-4c14-bcbb-4e639ab59b13", "80fee3ee-b9bf-49e6-b2af-068995bf8358" ]
				}
			},
			PrgStatus: {
				"a2316c5c-1b05-bd4e-8bfc-c2012b908a90": {
					Id: "a2316c5c-1b05-bd4e-8bfc-c2012b908a90",
					Name: "Tier 1"
				}
			},
			PrgInvolvement: {
				"4c28ef2a-ce76-4449-aac5-0bd470b2f5cf": {
					Id: "a2316c5c-1b05-bd4e-8bfc-c2012b908a90",
					Variant: "3314601d-9d08-cb4d-9d70-6a157c07c8ef"									
				}
			},
			PrgVariant: {
				"3314601d-9d08-cb4d-9d70-6a157c07c8ef": {
					Id: "3314601d-9d08-cb4d-9d70-6a157c07c8ef",
					Name: "Reading",
					SubVariants: [ "e2003c24-0be1-9d48-9991-714877ae55f8", "529698f7-92df-3649-9ca3-d83de6aecd20", "05bcf437-a77c-ae42-9864-994ccd7fca0d", "7ee3d88a-66cc-1f43-b06c-1e5cd3715422", "52d99caf-df73-ea4d-8bac-984d1d4fcf07", "8a97dfcf-223b-994d-9eff-1001973dab0c" ]
				}
			},
			PrgSubVariant: {
				"e2003c24-0be1-9d48-9991-714877ae55f8": {
					Id: "e2003c24-0be1-9d48-9991-714877ae55f8",
					Name: "Oral Reading Fluency"
				},
				"529698f7-92df-3649-9ca3-d83de6aecd20": {
					Id: "529698f7-92df-3649-9ca3-d83de6aecd20",
					Name: "Reading Comprehension"
				},
				"05bcf437-a77c-ae42-9864-994ccd7fca0d": {
					Id: "05bcf437-a77c-ae42-9864-994ccd7fca0d",
					Name: "Phonics"
				},
				"7ee3d88a-66cc-1f43-b06c-1e5cd3715422": {
					Id: "7ee3d88a-66cc-1f43-b06c-1e5cd3715422",
					Name: "Phonemic Awareness"
				},
				"52d99caf-df73-ea4d-8bac-984d1d4fcf07": {
					Id: "52d99caf-df73-ea4d-8bac-984d1d4fcf07",
					Name: "Vocabulary"
				},
				"8a97dfcf-223b-994d-9eff-1001973dab0c": {
					Id: "8a97dfcf-223b-994d-9eff-1001973dab0c",
					Name: "Other"
				}
			},
			IntvTool: {
				"128814d0-acbf-4ea8-8a65-9d1c0f073705": {
					Id: "128814d0-acbf-4ea8-8a65-9d1c0f073705",
					Name: "Repeated Reading of Passages",
					ToolDef: "aa49e0e0-5c08-4f84-b747-4e4e8fd6731e",
					Intervention: "01f8c34f-2836-400a-9855-2c0a257b0361"
				}
			},
			IntvToolDef: {
				"61f08a7b-e855-4425-b4f9-81666f49754f": {
					Id: "61f08a7b-e855-4425-b4f9-81666f49754f",
					Name: "Question-Generation"
				},
				"aa49e0e0-5c08-4f84-b747-4e4e8fd6731e": {
					Id: "aa49e0e0-5c08-4f84-b747-4e4e8fd6731e",
					Name: "Repeated Reading of Passages"
				},
				"73b2034f-f295-4c14-bcbb-4e639ab59b13": {
					Id: "73b2034f-f295-4c14-bcbb-4e639ab59b13",
					Name: "SRA Corrective Reading"
				},
				"80fee3ee-b9bf-49e6-b2af-068995bf8358": {
					Id: "80fee3ee-b9bf-49e6-b2af-068995bf8358",
					Name: "test intervention 01"
				}
			}
		}
	}
};
