window.data = {

	drivers: {
		__metadata: {
			Driver: { attributes: { Id: { name: "Id", type: String }, Name: { name: "Name", type: String }, Cars: { name: "Cars", type: "Many|Car" }, BirthDate: { name: "BirthDate", type: Date } } },
			Car: { attributes: { Id: { name: "Id", type: String }, Name: { name: "Name", type: String }, Driver: { name: "Driver", type: "One|Driver"} } }
		 },
		__data: {
			Driver: {
				1: { Id: 1, "Name": "Bryan Matthews", Cars: [ "1", "2" ], BirthDate: new Date("2/7/1985") }
			},
			Car: {
				1: { Id: 1, Name: "Sentra", Driver: "1" },
				2: { Id: 2, Name: "Bike", Driver: "1" }
			}
		}
	},

	programs: { 
		__metadata: {
			PrgIntervention: {
				attributes: {
					Id: { name: "Id", type: String },
					StartStatus: { name: "StartStatus", type: "One|PrgStatus" },
					Involvement: { name: "Involvement", type: "One|PrgInvolvement" },
					SubVariants: { name: "SubVariants", type: "Many|PrgSubVariant", allowed: "Involvement.Variant.SubVariants" },
					StartDate: { name: "StartDate", type: "Date" },
					PlannedEndDate: { name: "PlannedEndDate", type: "Date" },
					Tools: { name: "Tools", type: "Many|IntvTool" },
					ToolDefs: { name: "ToolDefs", type: "Many|IntvToolDef" }
				}
			},
			PrgStatus: {
				attributes: {
					Id: { name: "Id", type: String },
					Name: { name: "Name", type: String }
				}
			},
			PrgInvolvement: {
				attributes: {
					Id: { name: "Id", type: String },
					Variant: { name: "Variant", type: "One|PrgVariant" }
				}
			},
			PrgVariant: {
				attributes: {
					Id: { name: "Id", type: String },
					Name: { name: "Name", type: String },
					SubVariants: { name: "SubVariants", type: "Many|PrgSubVariant" }
				}
			},
			PrgSubVariant: {
				attributes: {
					Id: { name: "Id", type: String },
					Name: { name: "Name", type: String },
				}
			},
			IntvTool: {
				attributes: {
					Id: { name: "Id", type: String },
					Name: { name: "Name", type: String },
					ToolDef: { name: "ToolDef", type: "One|IntvToolDef", allowed: "Intervention.ToolDefs" },
					Intervention: { name: "Intervention", type: "One|PrgIntervention" }
				}
			},
			IntvToolDef: {
				attributes: {
					Id: { name: "Id", type: String },
					Name: { name: "Name", type: String }
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
