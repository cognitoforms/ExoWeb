require('./fakeDom.js');

var track = require('./track.js');

console.log("Loading jQuery...");

require('../../ref/jquery/jquery-1.7.2.js');

track('window', global);
track('jQuery', jQuery);
track('jQuery function', jQuery.fn);

console.log("Loading Microsoft AJAX...");

require('../../ref/aspnetajax/MicrosoftAjax.debug.js');
require('../../ref/aspnetajax/MicrosoftAjaxTemplates.debug.js');

track.test("window");
track.test("jQuery");
track.test("jQuery function");

console.log("Loading ExoWeb...");

track('ExoWeb');
track('ExoWeb.Model');
track('ExoWeb.Mapper');
track('ExoWeb.View');
track('ExoWeb.UI');
track('ExoWeb.DotNet');
track('ExoWeb.config');
track('ExoWeb.DotNet.config');

document.appendChild(new Element("script"));

require('../../dist/exoweb-msajax.js');

track.test("window");
track.test("jQuery");
track.test("jQuery function");
track.test('ExoWeb', ExoWeb, true);
track.test('ExoWeb.Model', ExoWeb.Model, true);
track.test('ExoWeb.Mapper', ExoWeb.Mapper, true);
track.test('ExoWeb.View', ExoWeb.View, true);
track.test('ExoWeb.UI', ExoWeb.UI, true);
track.test('ExoWeb.DotNet', ExoWeb.DotNet, true);
track.test('ExoWeb.config', ExoWeb.config);
track.test('ExoWeb.DotNet.config', ExoWeb.DotNet.config);
