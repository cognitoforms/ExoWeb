String.prototype.replaceAll = function replaceAll() {
	var str = this, len = str.length;
	do {
		str = String.prototype.replace.apply(str, arguments);
	}
	while (len !== (len = str.length));
	return str;
};

module("Linking");
asyncTest("initial rendered state", function () {
	expect(8);
	$exoweb({
		domReady: function () {
			Movie.meta.get("robin_hood").set_PosterUrl("tests/resources/TheMatrix.jpg");
			equal($("#client").find(".photo").length, 2, "should start out with 2 images");
			equal($("#client").find(".roles:last-child > div > div.actor-name").length, 4, "should be 4 roles for Batman and Robin");
			equal($("#client").find(".actor-bio:visible").length, 1, "Should be 1 visible actor bio.");
			equal($("#client").find(".actor-bio:visible")[0].innerText, "Russell Ira Crowe (born 7 April 1964) is a New Zealander Australian actor...", "Bio should be Russell Crow's bio.");
			equal($("#server").find(".photo.server").length, 2, "should start out with 2 (server-rendered) images");
			equal($("#server").find(".roles:last-child.server > div > div.actor-name.server").length, 4, "should be 4 (server-rendered) roles for Batman and Robin");
			equal($("#server").find(".actor-bio:visible").length, 1, "Should be 1 visible actor bio.");
			equal($("#server").find(".actor-bio:visible")[0].innerText, "Russell Ira Crowe (born 7 April 1964) is a New Zealander Australian actor...", "Bio should be Russell Crow's bio.");
			start();
		}
	});
});

asyncTest("verify updated content after adding a role", function () {
	expect(2);
	$exoweb({
		domReady: function () {
			Movie.meta.get("robin_hood").set_PosterUrl("tests/resources/TheMatrix.jpg");
			Sys.Application.linkElement(document.getElementById("server"), document.getElementById("_t0"));
			var role = new Role({ Actor: Actor.meta.get("russell_crowe"), Movie: Movie.meta.get("batman_and_robin"), Name: "Bane", Order: 9999, Star: false });
			Movie.meta.get("batman_and_robin").get_Roles().add(role);
			Actor.meta.get("russell_crowe").get_Roles().add(role);
			equal($("#client").find(".roles:last-child > div > div.actor-name").length, 5, "should now be 5 roles");
			equal($("#server").find(".roles:last-child > div > div.actor-name").length, 5, "should now be 5 roles");
			start();
		}
	});
});

//asyncTest("addMovie", function () {
//	description: "verify updated content after adding a movie",
//	expect: 3,
//		$exoweb({
//			domReady: function () {
	
//	setUp: function () {
//		Movie.meta.get("robin_hood").set_PosterUrl("../Common/Resources/TheMatrix.jpg");
//		context.model.movies.add(Movie.meta.get("ghostbusters"));
//	},
//	fn: function () {
//		equal($("#client").find(".photo").length, 3, "should now be 3 images");
//		equal($("#server").find(".photo").length, 3, "should start out with 3 images");
//		equal($("#server").find(".photo.server").length, 2, "should now be 2 server-rendered images");
//	}
//});

//asyncTest("changeViaModel", function () {
//	description: "verify updated image src after changing the poster",
//	expect: 4,
//		$exoweb({
//			domReady: function () {
	
//	setUp: function () {
//		Movie.meta.get("robin_hood").set_Name("The Gladiator - Pt. 2");
//		Movie.meta.get("robin_hood").set_PosterUrl("../Common/Resources/RobinHood.jpg");
//	},
//	fn: function () {
//		equal($("#client").find("input[type=text]")[0].value, "The Gladiator - Pt. 2", "title should be updated");
//		equal($("#client").find(".photo")[0].getAttribute("src"), "../Common/Resources/RobinHood.jpg", "image src should be updated");
//		equal($("#server").find("input[type=text]")[0].value, "The Gladiator - Pt. 2", "title should be updated");
//		equal($("#server").find(".photo")[0].getAttribute("src"), "../Common/Resources/RobinHood.jpg", "image src should be updated");
//	}
//});

//asyncTest("changeViaUI", function () {
//	description: "verify two way binding of title",
//	expect: 2,
	
//		$exoweb({
//			domReady: function () {
	
//	setUp: function () {
//		Movie.meta.get("robin_hood").set_PosterUrl("../Common/Resources/TheMatrix.jpg");
//		var el = $("#server").find("input[type=text][value='The Gladiator - Pt. 2']").val("Robin Hood")[0];
//		if (el.fireEvent) { el.fireEvent("onchange"); }
//		else if (el.dispatchEvent) {
//			var evt = document.createEvent("MutationEvents");
//			evt.initEvent("change", false, true);
//			el.dispatchEvent(evt);
//		}
//	},
//	fn: function () {
//		equal(context.model.movies[0].get_Name(), "Robin Hood", "name should be updated in model");
//		equal($("#client").find("input[type=text][value='Robin Hood']").length, 1, "title should be updated in DOM");
//	}
//});

//asyncTest("innerHTML - verify that markup is the same", function () {
//	$exoweb({
//		domReady: function () {
			
//		}
//	});
//		Movie.meta.get("robin_hood").set_PosterUrl("../Common/Resources/TheMatrix.jpg");
//		var clientMarkup = $("#client")[0].innerHTML
//			.trim().replace(/\t+/g, "").replace(/^\s*$/g, "").replaceAll("\n\n", "\n")
//			.replace(/ value="([^"])*"/g, "")
//			.replace(/ class\=""/g, "");

//		var serverMarkup = $("#server")[0].innerHTML
//			.trim().replace(/\t+/g, "").replace(/^\s*$/g, "").replaceAll("\n\n", "\n")
//			.replace(/ value="([^"])*"/g, "")
//			.replace(/server /g, "").replace(/"server"/g, "\"\"")
//			.replace(/ class\=""/g, "");

//		//console.log(clientMarkup);
//		//console.log(serverMarkup);
//		equal(clientMarkup, serverMarkup);
//	}
//});
