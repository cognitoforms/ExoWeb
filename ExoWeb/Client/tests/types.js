$exoweb({
	types: {
		NamedItem: {
			format: "[Name]",
			properties: {
				Name: { index: 0, type: "String" }
			}
		},
		Genre: {
			baseType: "NamedItem",
			properties: {
				All: { type: "Genre", isStatic: true, isList: true }
			}
		},
		Movie: {
			baseType: "NamedItem",
			format: "[Name] ([Year])",
			properties: {
				All: { type: "Movie", isStatic: true, isList: true },
				Year: { index: 1, type: "Number" },
				Rated: { index: 2, type: "String" },
				Released: { index: 3, type: "Date", format: "d" },
				Genres: { index: 4, type: "Genre", isList: true },
				Director: { index: 5, type: "Director" },
				Roles: { index: 6, type: "Role", isList: true },
				PosterUrl: { index: 7, type: "String" }
			},
			conditionTypes: [
				{
					code: "Movie.Genres.AllowedValues",
					category: "Error",
					message: "Genres is not in the list of allowed values.",
					rule: {
						property: "Genres",
						source: "Genre.All",
						type: "allowedValues"
					}
				},
				{
					code: "Movie.Director.AllowedValues",
					category: "Error",
					message: "Director is not in the list of allowed values.",
					rule: {
						property: "Director",
						source: "Director.All",
						type: "allowedValues"
					}
				}
			]
		},
		Person: {
			format: "[FirstName] [LastName]",
			properties: {
				All: { type: "Person", isStatic: true, isList: true },
				FirstName: { index: 0, type: "String" },
				LastName: { index: 1, type: "String" },
				PhotoUrl: { index: 2, type: "String" },
				Actor: { index: 3, type: "Actor" },
				Director: { index: 4, type: "Director" }
			}
		},
		Director: {
			format: "[Person.FirstName] [Person.LastName]",
			properties: {
				All: { type: "Director", isStatic: true, isList: true },
				Person: { index: 0, type: "Person" },
				Movies: { index: 1, type: "Movie", isList: true }
			}
		},
		Actor: {
			format: "[Person]",
			properties: {
				All: { type: "Actor", isStatic: true, isList: true },
				Person: { index: 0, type: "Person" },
				Roles: { index: 1, type: "Role", isList: true },
				BioPreview: { index: 2, type: "String" },
				Bio: { index: 3, type: "String" }
			}
		},
		Role: {
			format: "[Actor] played [Name] in [Movie]",
			properties: {
				Actor: { index: 0, type: "Actor" },
				Movie: { index: 1, type: "Movie" },
				Name: { index: 2, type: "String" },
				Order: { index: 3, type: "Number" },
				Star: { index: 4, type: "Boolean" },
				Lead: { index: 5, type: "Boolean" }
			}
		}
	}
});
