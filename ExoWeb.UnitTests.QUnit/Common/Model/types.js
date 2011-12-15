$exoweb({
	types: {
		Genre: {
			properties: {
				All: { type: "Genre", isStatic: true, isList: true },
				Name: { index: 0, type: "String" }
			}
		},
		Movie: {
			properties: {
				All: { type: "Movie", isStatic: true, isList: true },
				Title: { index: 0, type: "String" },
				Year: { index: 1, type: "Number" },
				Rated: { index: 2, type: "String" },
				Released: { index: 3, type: "Date" },
				Genres: { index: 4, type: "Genre", isList: true },
				Director: { index: 5, type: "Director" },
				Roles: { index: 6, type: "Role", isList: true },
				PosterUrl: { index: 7, type: "String" }
			},
			conditionTypes: {
				"Movie.Genres.AllowedValues": {
					category: "Error",
					message: "Genres is not in the list of allowed values.",
					rule: {
						property: "Genres",
						source: "Genre.All",
						type: "allowedValues"
					}
				},
				"Movie.Director.AllowedValues": {
					category: "Error",
					message: "Director is not in the list of allowed values.",
					rule: {
						property: "Director",
						source: "Director.All",
						type: "allowedValues"
					}
				}
			}
		},
		Person: {
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
			properties: {
				All: { type: "Director", isStatic: true, isList: true },
				Person: { index: 0, type: "Person" },
				Movies: { index: 1, type: "Movie", isList: true }
			}
		},
		Actor: {
			properties: {
				All: { type: "Actor", isStatic: true, isList: true },
				Person: { index: 0, type: "Person" },
				Roles: { index: 1, type: "Role", isList: true },
				BioPreview: { index: 2, type: "String" },
				Bio: { index: 3, type: "String" }
			}
		},
		Role: {
			properties: {
				Actor: { index: 0, type: "Actor" },
				Name: { index: 1, type: "String" },
				Order: { index: 2, type: "Number" },
				Star: { index: 3, type: "Boolean" },
				Lead: { index: 4, type: "Boolean" }
			}
		}
	}
});

$extend("Director", function() {
	Director.formats.$display = ExoWeb.Model.Format.fromTemplate("{Person.FirstName} {Person.LastName}");
});
