$exoweb({
	instances: {
		Genre: {
			static: { All: ["action", "adventure", "drama"] },
			action: ["Action"],
			adventure: ["Adventure"],
			crime: ["Crime"],
			drama: ["Drama"],
			fantasy: ["Fantasy"],
			mystery: ["Mystery"],
			sci_fi: ["Sci-fi"],
			documentary: ["Documentary"]
		},
		Movie: {
			static: { All: ["robin_hood", "batman_and_robin", "ghostbusters", "waiting_for_superman"] },
			robin_hood: ["Robin Hood", 2010, "PG-13", "5/14/2010", ["action", "adventure", "drama"], "ridley_scott", ["robin_hood_robin_longstride", "robin_hood_marion_loxley", "robin_hood_sheriff_of_nottingham"], "tests/resources/RobinHood.jpg"],
			batman_and_robin: ["Batman & Robin", 1997, "TV-PG", "6/20/1997", ["action", "crime", "fantasy", "sci_fi"], "joel_schumacher", ["batman_and_robin_mr_freeze_dr_victor_fries", "batman_and_robin_batman_bruce_wayne", "batman_and_robin_robin_dick_grayson", "batman_and_robin_poison_ivy_dr_pamela_isley"], "tests/resources/BatmanAndRobin.jpg"],
			ghostbusters: ["Ghostbusters", 1984, "TV-PG", "6/8/1984", ["adventure", "fantasy", "mystery"], "ivan_reitman", ["ghostbusters_dr_peter_venkman", "ghostbusters_dr_raymond_stantz", "ghostbuster_dana_barrett", "ghostbuster_dr_egon_spengler"], "tests/resources/Ghostbusters.jpg"],
			waiting_for_superman: ["Waiting for 'Superman'", 2010, "TV-PG", "12/3/2010", ["documentary"], "davis_guggenheim", [], "tests/resources/WaitingForSuperman.jpg"]
		},
		Person: {
			static: { All: ["ridley_scott", "russell_crowe", "cate_blanchett", "matthew_macfadyen", "arnold_schwarzenegger", "george_clooney", "chris_odonnell", "uma_thurman", "ivan_reitman", "davis_guggenheim", "geoffrey_canada"] },
			ridley_scott: ["Ridley", "Scott", "tests/resources/RidleyScott.jpg", null, "ridley_scott"],
			russell_crowe: ["Russell", "Crowe", "tests/resources/RussellCrowe.jpg", "russell_crowe", null],
			cate_blanchett: ["Cate", "Blanchett", "tests/resources/CateBlanchett.jpg", "cate_blanchett", null],
			matthew_macfadyen: ["Matthew", "Macfadyen", "tests/resources/MatthewMacfadyen.jpg", "matthew_macfadyen", null],
			joel_schumacher: ["Joel", "Schumacher", "tests/resources/JoelSchumacher.jpg", null, "joel_schumacher"],
			arnold_schwarzenegger: ["Arnold", "Schwarzenegger", "tests/resources/ArnoldSchwarzenegger.jpg", "arnold_schwarzenegger", null],
			george_clooney: ["George", "Clooney", "tests/resources/GeorgeClooney.jpg", "george_clooney", null],
			chris_odonnell: ["Chris", "O'Donnell", "tests/resources/ChrisODonnell.jpg", "chris_odonnell", null],
			uma_thurman: ["Uma", "Thurman", "tests/resources/UmaThurman.jpg", "uma_thurman", null],
			ivan_reitman: ["Ivan", "Reitman", "tests/resources/IvanReitman.jpg", null, "ivan_reitman"],
			bill_murray: ["Bill", "Murray", "tests/resources/BillMurray.jpg", "bill_murray", null],
			dan_aykroyd: ["Dan", "Aykroyd", "tests/resources/DanAykroyd.jpg", "dan_aykroyd", null],
			sigourney_weaver: ["Sigourney", "Weaver", "tests/resources/SigourneyWeaver.jpg", "sigourney_weaver", null],
			harold_ramis: ["Harold", "Ramis", "tests/resources/HaroldRamis.jpg", "harold_ramis", null],
			davis_guggenheim: ["Davis", "Guggenheim", "tests/resources/DavisGuggenheim.jpg", null, "davis_guggenheim"],
			geoffrey_canada: ["Geoffrey", "Canada", "tests/resources/GeoffreyCanada.jpg", "geoffrey_canada", null]
		},
		Actor: {
			static: { All: ["russell_crowe", "cate_blanchett", "matthew_macfadyen", "arnold_schwarzenegger", "george_clooney", "chris_odonnell", "uma_thurman", "geoffrey_canada"] },
			russell_crowe: ["russell_crowe", ["robin_hood_robin_longstride"], "Russell Ira Crowe (born 7 April 1964) is a New Zealander Australian actor...", null],
			cate_blanchett: ["cate_blanchett", ["robin_hood_marion_loxley"], null, null],
			matthew_macfadyen: ["matthew_macfadyen", ["robin_hood_sheriff_of_nottingham"], null, null],
			arnold_schwarzenegger: ["arnold_schwarzenegger", ["batman_and_robin_mr_freeze_dr_victor_fries"], null, null],
			george_clooney: ["george_clooney", ["batman_and_robin_batman_bruce_wayne"], null, null],
			chris_odonnell: ["chris_odonnell", ["batman_and_robin_robin_dick_grayson"], null, null],
			uma_thurman: ["uma_thurman", ["batman_and_robin_poison_ivy_dr_pamela_isley"], null, null],
			bill_murray: ["bill_murray", ["ghostbusters_dr_peter_venkman"], null, null],
			dan_aykroyd: ["dan_aykroyd", ["ghostbusters_dr_raymond_stantz"], null, null],
			sigourney_weaver: ["sigourney_weaver", ["ghostbuster_dana_barrett"], null, null],
			harold_ramis: ["harold_ramis", ["ghostbuster_dr_egon_spengler"], null, null],
			geoffrey_canada: ["geoffrey_canada", [], null, null]
		},
		Role: {
			robin_hood_robin_longstride: ["russell_crowe", "robin_hood", "Robin Longstride", 0, true, true],
			robin_hood_marion_loxley: ["cate_blanchett", "robin_hood", "Marion Loxley", 1, true, false],
			robin_hood_sheriff_of_nottingham: ["matthew_macfadyen", "robin_hood", "Sheriff of Nottingham", 2, true, false],
			batman_and_robin_mr_freeze_dr_victor_fries: ["arnold_schwarzenegger", "batman_and_robin", "Mr. Freeze / Dr. Victor Fries", 0, true, false],
			batman_and_robin_batman_bruce_wayne: ["george_clooney", "batman_and_robin", "Batman / Bruce Wayne", 1, true, true],
			batman_and_robin_robin_dick_grayson: ["chris_odonnell", "batman_and_robin", "Robin / Dick Grayson", 2, true, false],
			batman_and_robin_poison_ivy_dr_pamela_isley: ["uma_thurman", "batman_and_robin", "Poison Ivy / Dr. Pamela Isley", 3, true, false],
			ghostbusters_dr_peter_venkman: ["bill_murray", "ghostbusters", "Dr. Peter Venkman", 3, true, false],
			ghostbusters_dr_raymond_stantz: ["dan_aykroyd", "ghostbusters", "Dr. Raymond Stantz", 3, true, false],
			ghostbuster_dana_barrett: ["sigourney_weaver", "ghostbusters", "Dana Barrett", 3, true, false],
			ghostbuster_dr_egon_spengler: ["harold_ramis", "ghostbusters", "Dr. Egon Spengler", 3, true, false]
		},
		Director: {
			static: { All: ["ridley_scott", "joel_schumacher", "ivan_reitman", "davis_guggenheim"] },
			ridley_scott: ["ridley_scott", ["robin_hood"]],
			joel_schumacher: ["joel_schumacher", ["batman_and_robin"]],
			ivan_reitman: ["ivan_reitman", ["ghostbusters"]],
			davis_guggenheim: ["davis_guggenheim", ["waiting_for_superman"]]
		}
	}
});