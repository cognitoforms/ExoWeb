// ==UserScript==
// @name          Clear ExoWeb Cache
// @namespace     http://localhost/
// @include       http://localhost/*
// ==/UserScript==

(function(){ 
  function GM_wait() 
  { 
    if(typeof unsafeWindow.jQuery == 'undefined') {
      unsafeWindow.setTimeout(GM_wait,100); 
	  GM_log("ExoWeb Clear Cache - Waiting for jQuery");
	}
    else 
      unsafeWindow.jQuery(function() { letsJQuery(unsafeWindow.jQuery); }); 
  } 
  GM_wait(); 
 
  function letsJQuery($) 
  {
	$(unsafeWindow).unload(function(){
		if(unsafeWindow.ExoWeb){
			unsafeWindow.ExoWeb.clearCache();
			GM_log("ExoWeb Cache Cleared");
		}
	});
	GM_log("ExoWeb Clear Cache Registered");
  } 
})(); 