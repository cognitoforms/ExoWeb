// (c) 2009 Microsoft Corporation, All Rights Reserved
// Use of this software is subject to the following license terms: 
// http://go.microsoft.com/fwlink/?LinkId=163454

(function() {
function execute(window, Sys) {
    var notLoading = 0, // not loading itself or any dependencies
        loading = 1, // currently loading itself (dependencies have already loaded, executionDependencies may or may not be done)
        loadingCo = 2, // loaded but waiting for executionDependencies
        loaded = 3, // loaded self and all deps/codeps and execution callback executed
        attachEvent = !!document.attachEvent;

    // The script loader has to be small. Empathsis is put on reducing the size
    // of the script over the performance, within reason.
    // These are global closure functions that will aid in minimization of the loader.
    // e.g. document.createElement('foo') becomes just createElement('foo'),
    // which is crunched into just a('foo')
    function callIf(obj, name, args) {
        // calls a function on an object if it exists, passing in the optional arguments
        var fn = obj[name],
            exists = typeof(fn) === "function";
        if (exists) fn.call(obj, args);
        return exists;
    }
    function forIn(obj, callback) {
        for (var x in obj) {
            // todo: use hasOwnProperty, except it isnt supported in VS intellisense
            //if (obj.hasOwnProperty(x)) callback(obj[x], x);
            callback(obj[x], x);
        }
    }
    function forall(objOrArray, callback) {
        if (objOrArray) {
            (objOrArray instanceof Array) ? foreach(objOrArray, callback) : callback(objOrArray);
        }
    }
    function foreach(arr, callback, start) {
        var cancelled;
        if (arr) {
            for (var i = start||0, l = arr.length; i < l; i++) {
                if (callback(arr[i], i)) {
                    cancelled = true;
                    break;
                }
            }
        }
        return !cancelled;
    }
    function foreachScriptInfo(arr, callback) {
        var cancelled;
        if (arr) {
            for (var i = 0, l = arr.length; i < l; i++) {
                if (callback(getScriptInfo(arr[i]))) {
                    cancelled = true;
                    break;
                }
            }
        }
        return !cancelled;
    }
    function foreachCall(obj, field, args) {
        // calls all the functions in an array of functions and deletes
        // the array from the containing object.
        var arr = obj[field];
        delete obj[field];
        forall(arr, function(callback) {
            callback.apply(null, args||[]);
        });
    }
    function toIndex(arr) {
        // converts an array of strings into an object/index
        var obj = {};
        foreach(arr, function(name) {
            obj[name] = true;
        });
        return obj;
    }
    function lazyget(obj, name, value) {
        // aids in lazily adding to an array or object that may not exist yet
        // also makes it simple to get a field from an object that may or may not be defined
        // e.g. lazyget(null, "foo") // undefined
        return obj ? (obj[name] = obj[name] || value) : value;
    }
    function lazypush(obj, name, value) {
        lazyget(obj, name, []).push(value);
    }
    function lazyset(obj, name, key, value) {
        lazyget(obj, name, {})[key] = value;
    }
    function getScriptInfo(name) {
        return resolveScriptInfo(name) || (Sys.scripts[name] = { name: name });
    }
    function state(scriptInfo, newState) {
        var ret = (scriptInfo._state = newState || scriptInfo._state) || 0;
        // if this is a composite script, mirror the state it its contained scripts
        if (newState) {
            foreachScriptInfo(scriptInfo.contains, function(scriptInfo) {
                state(scriptInfo, newState);
            });
        }
        return ret;
    }
    function isLoaded(scriptInfo) {
        return !scriptInfo || (state(scriptInfo) > loadingCo);
    }
    function getComposite(scriptInfo) {
        return scriptInfo._composite;
    }
    function getCompositeDependencies(composite, executionDependencies) {
        // gets the dependencies this composite script has by merging the dependencies of its
        // contained scripts, excluding any dependencies that are a part of the composite.
        var dependencies = [];
        foreachScriptInfo(composite.contains, function(scriptInfo) {
            foreach(lazyget(scriptInfo, executionDependencies ? "executionDependencies" : "dependencies"), function(name) {
                // composite.contains is an array of dependencies. _contains is a dictionary for fast lookup.
                // It was built when the composite was defined.
                if (!composite._contains[name]) dependencies.push(name);
            });
        });
        return dependencies;
    }
    function getDependencies(scriptInfo, executionDependencies) {
        // determines the dependencies this script has, taking into account it may have been selected
        // to be loaded as part of a composite script, or it may BE a composite script.
        // If so, its dependencies are the set of all dependencies of all the scripts in the composite
        // that are not within the composite.
        var dependencies;
        if (scriptInfo.contains) {
            dependencies = getCompositeDependencies(scriptInfo, executionDependencies);
        }
        else {
            var composite = getComposite(scriptInfo);
            if (composite) {
                dependencies = getCompositeDependencies(composite, executionDependencies);
            }
            else {
                dependencies = lazyget(scriptInfo, executionDependencies ? "executionDependencies" : "dependencies");
            }
        }
        return dependencies;
    }
    function requireParents(scriptInfo) {
        forIn(scriptInfo["_parents"], function(parentInfo) {
            // if any parent dependency is trying to load as part of a composite, the composite
            // should get the first chance to execute.
            forIn(parentInfo["_composites"], function(composite) {
                requireScript(composite, null, null, true);
            });
            requireScript(parentInfo, null, null, true);
        });
    }
    function requireScript(scriptInfo, callback, session, readOnly) {
        return Sys.loader._requireScript(scriptInfo, callback, session, readOnly);
    }
    function requireAll(scriptInfos, callback, session, readOnly) {
        var waiting;
        foreach(scriptInfos, function(dependency) {
            dependency = resolveScriptInfo(dependency);
            waiting |= requireScript(dependency, callback, session, readOnly);
        });
        return waiting;
    }
    function all(tag, element) {
        return (element||document).getElementsByTagName(tag);
    }
    function createElement(tag) {
        return document.createElement(tag);
    }
    function resolveScriptInfo(nameOrScriptInfo, onlyScripts) {
        // value might be "foo" which means either Sys.scripts.foo, Sys.composites.foo, Sys.components.foo, Sys.plugins.foo,
        // or value might be equal to one of those
        var info = typeof(nameOrScriptInfo) === "string" ?
                Sys.scripts[nameOrScriptInfo] ||
                Sys.composites[nameOrScriptInfo] ||
                (!onlyScripts && (lazyget(Sys.components[nameOrScriptInfo], "script") || lazyget(Sys.plugins[nameOrScriptInfo], "script"))) :
            (nameOrScriptInfo ? (nameOrScriptInfo.script || nameOrScriptInfo) : null);
        if (info && !info._isScript) {
            info = null;
        }
        return info;
    }
    function merge(target) {
        target = target || {};
        foreach(arguments, function(o) {
            if (o) {
                forIn(o, function(v, n) {
                    target[n] = v;
                });
            }
        }, 1);
        return target;
    }
    function listenOnce(target, name, ieName, callback, isReadyState, isScript) {
        function onEvent() {
            // this closure causes a circular reference with the dom element (target)
            // because it is added as a handler to the target, so target->onEvent,
            // and onEvent references the target through the parameter, onEvent->target.
            // However both sides are removed when the event fires -- the handler is removed
            // and the target is set to null.
            if (!attachEvent || !isReadyState || /loaded|complete/.test(target.readyState)) {
                if (attachEvent) {
                    target.detachEvent(ieName || ("on" + name), onEvent);
                }
                else {
                    target.removeEventListener(name, onEvent, false);
                    if (isScript) {
                        target.removeEventListener("error", onEvent, false);
                    }
                }
                callback.apply(target);
                target = null;
            }
        }
        if (attachEvent) {
            target.attachEvent(ieName || ("on" + name), onEvent);
        }
        else {
            target.addEventListener(name, onEvent, false);
            if (isScript) {
                target.addEventListener("error", onEvent, false);
            }
        }
    }
    function raiseOnReady() {
        if (!Sys.loader._loading && Sys._ready) {
            foreachCall(Sys, "_readyQueue");
        }
    }

    window.Sys = Sys = merge(Sys, {
        __class: true, // hides private members from VS intellisense
        debug: true,
        activateDom: true,
        scripts: {},
        composites: {},
        components: {},
        plugins: {},
        create: {},
        converters: {},
        _create: function _create(properties, target) {
            // this == Sys.component.foo
            if (typeof(target) === "string") {
                target = Sys.get(target);
            }
            var type = this._type || (this._type = window.eval("(" + this.typeName + ")"));
            var instance = (typeof(target) === "undefined" ? new type() : new type(target));
            callIf(instance, "beginUpdate");
            forIn(properties, function(value, field) {
                // events, then properties, then fields.
                callIf(instance, "add_" + field, value) ||
                callIf(instance, "set_" + field, value) ||
                (instance[field] = value);
            });
            // compatibility with created components with Sys.Application in ComponentModel.js
            // call its _register method so it is registered with Sys.Application (which also takes
            // care of calling endUpdate/initialize.
            var componentType = Sys.Component;
            if (!componentType || !componentType._register(instance)) {
                callIf(instance, "endUpdate") || callIf(instance, "initialize");
            }
            return instance;
        },
        _domReady: function _domReady() {
            function domReady() {
                if (!Sys._ready) {
                    Sys._ready = true;
                    // _domReadyQueue contains callbacks for Sys.require() calls that 
                    // completed before the dom was ready. We don't put them in _readyQueue
                    // because unlike calls to Sys.onReady() we do not want them to wait
                    // for the loader to be done, in case other calls to Sys.require are still
                    // loading.
                    foreachCall(Sys, "_domReadyQueue");
                    raiseOnReady();
                }
            }
            listenOnce(window, "load", null, domReady);

            var check;
            if (attachEvent) {
                if ((window == window.top) && document.documentElement.doScroll) {
                    // timer/doscroll trick works only when not in a frame
                    var timeout, er, el = createElement("div");
                    check = function() {
                        try {
                            el.doScroll("left");
                        }
                        catch (er) {
                            timeout = window.setTimeout(check, 0);
                            return;
                        }
                        el = null;
                        domReady();
                    }
                    check();
                }
                else {
                    // in a frame this is the only reliable way to fire before onload, however
                    // testing has shown it is not much better than onload if at all better.
                    // using a <script> element with defer="true" is much better, but you have to
                    // document.write it for the 'defer' to work, and that wouldnt work if this
                    // script is being loaded dynamically, a reasonable possibility.
                    // There is no known way of detecting whether the script is loaded dynamically or not.
                    listenOnce(document, null, "onreadystatechange", domReady, true);
                }
            }
            else if (document.addEventListener) {
                listenOnce(document, "DOMContentLoaded", null, domReady);
            }
        },
        _getById: function(found, id, single, includeSelf, element) {
            if (element) {
                if (includeSelf && (element.id === id)) {
                    found[0] = element;
                }
                else {
                    foreach(all("*", element), function(element) {
                        if (element.id === id) {
                            found[0] = element;
                            return true;
                        }
                    });
                }
            }
            else {
                var e = document.getElementById(id);
                if (e) found[0] = e;
            }
            return found.length;
        },
        _getByClass: function(found, targetClass, single, includeSelf, element) {
            function pushIfMatch(element) {
                var ret, className = element.className;
                if (className && ((className === targetClass) || (className.indexOf(' ' + targetClass) >= 0) || (className.indexOf(targetClass + ' ') >= 0))) {
                    found.push(element);
                    ret = true;
                }
                return ret;
            }
            var i, l, nodes;
            if (includeSelf && pushIfMatch(element) && single) {
                return true;
            }
            element = element || document;
            var finder = element.querySelectorAll || element.getElementsByClassName;
            if (finder) {
                if (element.querySelectorAll) targetClass = "." + targetClass;
                // return is not really an array
                nodes = finder.call(element, targetClass);
                for (i = 0, l = nodes.length; i < l; i++) {
                    found.push(nodes[i]);
                    if (single) return true;
                }
            }
            else {
                nodes = all("*", element);
                for (i = 0, l = nodes.length; i < l; i++) {
                    if (pushIfMatch(nodes[i]) && single) {
                        return true;
                    }
                }
            }
        },
        query: function find(selector, context) {
            /// <summary>Queries the DOM for a set of DOM elements.</summary>
            /// <validationOptions enabled="false" />
            /// <param name="selector">Selector for a set of DOM elements based on id (#&lt;id>), class (.&lt;name>), or tag name (&lt;tagname>). More complex selectors may be used if jQuery is loaded.</param>
            /// <param name="context" optional="true" mayBeNull="true">An element, array of elements, or Sys.UI.TemplateContext to restrict the query within.</param>
            /// <returns type="Array">Array of matching elements. If no results, an empty array.</returns>
            return (context && typeof(context.find) === "function") ?
                context.find(selector) :
                this._find(selector, context);
        },
        get: function get(selector, context) {
            /// <summary>Queries the DOM for a single DOM element.</summary>
            /// <validationOptions enabled="false" />
            /// <param name="selector">
            /// Selector for a DOM element based on id (#&lt;id>), class (.&lt;name>), or tag name (&lt;tagname>). More complex selectors may be used if jQuery is loaded.
            /// If multiple elements match the selector, the first one is returned.
            /// </param>
            /// <param name="context" optional="true" mayBeNull="true">An element, array of elements, or Sys.UI.TemplateContext to restrict the query within.</param>
            /// <returns>The matching element, or null if none match.</returns>
            return (context && typeof(context.get) === "function") ?
                context.get(selector) :
                this._find(selector, context, true);
        },
        _find: function(selector, context, single) {
            var found = [];
            // if already a dom element just return it
            if (typeof(selector) !== "string") {
                found.push(selector);
            }
            else {
                var includeSelf = context instanceof Array,
                    match = /^([\$#\.])((\w|[$:\.\-])+)$/.exec(selector);
                if (match && match.length === 4) {
                    selector = match[2];
                    var type = match[1];
                    if (type === "$") {
                        Sys._getComponent(found, selector, context);
                    }
                    else {
                        var finder = type === "#" ? Sys._getById : Sys._getByClass;
                        if (context) {
                            forall(context, function(node) {
                                if (node.nodeType === 1) {
                                    return finder(found, selector, single, includeSelf, node);
                                }
                            });
                        }
                        else {
                            finder(found, selector, single);
                        }
                    }
                }
                else if (/^\w+$/.test(selector)) {
                    if (includeSelf) {
                        forall(context, function(node) {
                            if (node.nodeType === 1) {
                                if (node.tagName.toLowerCase() === selector) {
                                    found.push(node);
                                    if (single) return true;
                                }
                                // object returned is not really an array
                                if(!foreach(all(selector, node), function(node) {
                                    found.push(node);
                                    if (single) return true;
                                })) {
                                    return true;
                                }
                            }
                        });
                    }
                    else {
                        var nodes = all(selector, context);
                        if (single) {
                            return (nodes[0] || null);
                        }
                        foreach(nodes, function(node) {
                            found.push(node);
                        });
                    }
                }
                else if (window.jQuery) {
                    found = jQuery(selector).get();
                }
            }
            return found.length ? (single ? found[0] : found) : null;
        },
        onReady: function onReady(callback) {
            /// <summary>Registers a function to be called when the DOM is ready and when all required resources have been loaded.</summary>
            /// <validationOptions enabled="false" />
            /// <param name="callback" type="Function"></param>
            lazypush(this, "_readyQueue", callback);
            raiseOnReady();
        },
        require: function require(features, completedCallback, userContext) {
            /// <summary>
            /// Declares what scripts or script features are required, loads the appropriate script resources, and executes a callback when they are available.
            /// </summary>
            /// <validationOptions enabled="false" />
            /// <param name="features" type="Array">Array of all the required scripts and/or features. [Sys.scripts.foo, Sys.scripts.bar, Sys.components.foo, ...]</param>
            /// <param name="completedCallback" type="Function" optional="true" mayBeNull="true">Optional callback that is called when all the requirements are available.</param>
            /// <param name="userContext" optional="true" mayBeNull="true">Optional context that is passed to the completed callback.</param>
            // create a unique ID for this require session, used to ensure we are listening to
            // each script on each iteration only once.
            var session = Sys.loader._session++,
                iterating,
                loaded;
            function raiseCallback() {
                // call the callback but not if the dom isn't ready
                if (completedCallback) {
                    Sys._ready ? completedCallback(features, userContext)
                               : lazypush(Sys, "_domReadyQueue", raiseCallback);
                }
            }
            function allLoaded() {
                // called each time any script from the scripts list or their descendants are loaded.
                // Each time we re-play the requires operation, which allows us to recalculate the dependency
                // tree in case a loaded script has added to it, and also to recalculate additional composites
                // to load. It also makes it possible for the parent scripts of any given types to change.
                
                // Note that when scripts are loading simultaniously, the browser will sometimes execute 
                // more than one script before raising the scriptElement.load/readyStateChange event, which means
                // two or more script-loader aware scripts might all call registerScript() before the 'getHandler'
                // method for the first fires. In that scenario, once the handler does get called for the executed
                // scripts, they will all call this 'allLoaded' handler, and all might find that all the required
                // scripts have been loaded. To simply protect against calling the callback multiple times, we 
                // just ensure it is called once.
                if (!loaded && !iterating && !iteration()) {
                    loaded = true;
                    raiseCallback();
                }
                // when the loader is finished after the domready event, it should
                // raise the ready event again.
                raiseOnReady();
            }
            function iteration() {
                iterating = true;
                var resolvedScripts = [];
                forall(features, function(feature) {
                    feature = resolveScriptInfo(feature);
                    if (feature) {
                        var contains = feature.contains;
                        if (contains) {
                            foreachScriptInfo(contains, function(scriptInfo) {
                                resolvedScripts.push(scriptInfo);
                            });
                        }
                        else {
                            resolvedScripts.push(feature);
                        }
                    }
                });
                if (Sys.loader.combine) {
                    Sys.loader._findComposites(resolvedScripts);
                }
                var waiting = requireAll(resolvedScripts, allLoaded, session);
                iterating = false;
                return waiting;
            }
            allLoaded();
        },
        loadScripts: function loadScripts(scriptUrls, completedCallback, userContext) {
            /// <summary>
            /// Loads the given scripts, and executes a callback when they are available. Ensures each script is not loaded more than once even if one is referenced with a &lt;script&gt; element on the page.
            /// </summary>
            /// <validationOptions enabled="false" />
            /// <param name="scriptUrls" type="Array" elementType="String">Array of all the scripts to load. The scripts are loaded in sequential order.</param>
            /// <param name="completedCallback" type="Function" optional="true" mayBeNull="true">Optional callback that is called when all the scripts are available.</param>
            /// <param name="userContext" optional="true" mayBeNull="true">Optional context that is passed to the completed callback.</param>
            this.loader.loadScripts(scriptUrls, completedCallback, userContext);
        },
        loader: {
            __class: true, // hides private members from VS intellisense
            combine: true,
            basePath: null, // only in debug?
            _loading: 0,
            _session: 0,
            _eval: {},
            _init: function _init() {
                var scripts = all("script"),
                selfUrl = scripts.length ? scripts[scripts.length - 1].src : null;
                this.basePath = selfUrl ? (selfUrl.slice(0, selfUrl.lastIndexOf("/"))) : "";
            },
            _load: function _load(scriptInfo, callback, session) {
                var waiting;
                if (isLoaded(scriptInfo)) {
                    callback();
                }
                else {
                    waiting = true;
                    var notifyList = lazyget(scriptInfo, "_notify", []),
                        key = "session" + session;
                    if (!notifyList[key]) {
                        notifyList[key] = true;
                        notifyList.push(callback);
                    }
                    if (state(scriptInfo) < loading) {
                        state(scriptInfo, loading);
                        this._loadSrc(this._getUrl(scriptInfo), this._getHandler(scriptInfo));
                    }
                }
                return waiting;
            },
            _loadSrc: function _loadSrc(src, callback, allowDup) {
                var script = merge(createElement('script'), {
                        type: 'text/javascript',
                        src: src }),
                    loaded = lazyget(this, "_loadedScripts", {});
                // First take inventory of all the script elements on the page so we can quickly detect whether a particular script has already
                // loaded or not. This is done frequently in case a script element is added by any other means separate from the loader.
                // For example, a script that loads could create a script element when it executes.
                // Urls found are stored in _loadedScripts so even script elements that have been removed will be remembered.
                if (!allowDup) {
                    foreach(all("script"), function(script) {
                        var src = script.src;
                        if (src) loaded[src] = true;
                    });
                }
                if (!allowDup && loaded[script.src]) {
                    if (callback) callback();
                }
                else {
                    listenOnce(script, "load", "onreadystatechange", callback, true, true);
                    this._loading++;
                    loaded[script.src] = true;
                    all("head")[0].appendChild(script);
                }
            },
            _requireScript: function _requireScript(scriptInfo, callback, session, readOnly) {
                // readonly: caller is only interested in knowing if this script is ready for it's execution callback,
                // it should not cause any dependencies to start loading. If it is, it is executed.
                var waiting;
                if (!isLoaded(scriptInfo)) {
                    var waitForDeps = requireAll(getDependencies(scriptInfo), callback, session, readOnly),
                        waitForDepsCo = requireAll(getDependencies(scriptInfo, true), callback, session, readOnly);
                    if (!waitForDeps && !waitForDepsCo && state(scriptInfo) === loadingCo) {
                        // the script has no more dependencies, executionDependencies, itself has already loaded,
                        // but has not yet been confirmed to have been loaded. This is it.
                        // A script that supports executionDependencies might also support an 'execution callback',
                        // a wrapper function that allows us to load the script without executing it.
                        // We then call the callback once its executionDependencies have loaded.
                        state(scriptInfo, loaded);
                        // there can be only one, but this is a dirty trick to call this field if it exists
                        // and delete it in a consise way.
                        foreachCall(scriptInfo, "_callback");
                        if (scriptInfo.name === "jQuery" && window.jQuery) {
                            // create jquery plugins for components/plugins that have previously been registered
                            var loader = Sys.loader;
                            forIn(Sys.components, loader._createPlugin);
                            forIn(Sys.plugins, function(plugin) {
                                loader._createPlugin(plugin, true);
                            });
                        }
                        // Now that this script has loaded, see if any of its parent scripts are waiting for it
                        // We only need to do this in readOnly mode since otherwise, a require() call is coming
                        // again anyway.
                        if (readOnly) {
                            var contains = scriptInfo.contains;
                            if (contains) {
                                foreachScriptInfo(contains, function(scriptInfo) {
                                    requireParents(scriptInfo);
                                });
                            }
                            else {
                                requireParents(getScriptInfo(scriptInfo));
                            }
                        }
                    }
                    else if (!readOnly && !waitForDeps) {
                        // if all dependencies are loaded & executed, now load this script,
                        // or the dependency it was selected for. Some executionDependencies may still be loading
                        this._load(getComposite(scriptInfo) || scriptInfo, callback, session);
                    }
                    waiting |= (waitForDeps || waitForDepsCo);
                }
                return waiting || !isLoaded(scriptInfo);
            },
            _getUrl: function _getUrl(scriptInfo) {
                var debug = Sys.debug,
                    name = scriptInfo.name,
                    path = (debug ? (scriptInfo.debugUrl || scriptInfo.releaseUrl) : scriptInfo.releaseUrl).replace(/\{0\}/, name) || "";
                if (path.substr(0, 2) === "%/") {
                    var basePath = this.basePath,
                        hasSlash = (basePath.charAt(basePath.length-1) === "/");
                    path = basePath + (hasSlash ? "" : "/") + path.substr(2);
                }
                return path;
            },
            _getHandler: function _getHandler(scriptInfo) {
                return function() {
                    // this === <script> element
                    Sys.loader._loading--;
                    if (state(scriptInfo) < loadingCo) {
                        // dont do this if its already marked as 'loaded',
                        // which may happen if the script contains a registerScript() call.
                        state(scriptInfo, loadingCo);
                    }
                    foreachCall(scriptInfo, "_notify");
                    // if it is a composite also notify anyone waiting on any of its contained scripts
                    foreachScriptInfo(scriptInfo.contains, function(scriptInfo) {
                        foreachCall(scriptInfo, "_notify");
                    });
                }
            },
            _findComposites: function _findComposites(scripts) {
                // given a list of top level required scripts, determines all the composite scripts that should load during the process
                // of loading those scripts. Returns an index indicating for each script in the dependency tree, which composite script
                // should load in its place.
                var scriptSet = {},
                    compositeMapping = {},
                    foundAny;
                // first filter out already loaded scripts and expand their dependencies, building
                // up the 'scriptSet' index.
                function visit(script) {
                    script = resolveScriptInfo(script);
                    var currentState = state(script);
                    if (currentState < loading && !getComposite(script)) {
                        // unloaded script, eligible for composite selection
                        scriptSet[script.name] = script;
                        foundAny = true;
                        foreach(script["dependencies"], visit);
                    }
                    if (currentState < loaded) {
                        // this scripts executionDependencies may not be loaded,
                        // also check them for composite candidates
                        foreach(script["executionDependencies"], visit);
                    }
                }
                foreach(scripts, visit);
                if (foundAny) {
                    // scriptSet is now a dictionary of every unloaded dependency in the tree
                    // not already designated to load as part of a composite script.
                    // now enumerate all composites looking for those that contain nothing but
                    // scripts in this set.
                    forIn(Sys.composites, function(composite) {
                        if (foreachScriptInfo(composite.contains, function(contained) {
                                if (!scriptSet[contained.name]) {
                                    return true;
                                }
                            })) {
                            // all of the scripts this composite contains need to be loaded.
                            // But selecting this composite for the scripts it contains could offset
                            // other previously selected composites (in this same execution context)
                            // that contain any of the same scripts.
                            // To ensure maximum coverage of scripts within composites, only select this
                            // composite if doing so would result in less http requests. The number of http
                            // requests saved by a composite is the number of scripts it contains, minus 1.
                            // For example, a composite of 3 scripts takes 1 request, normally 3. 3-1=2.
                            var offsets = {}, offsetCount = 0;
                            foreach(composite.contains, function(name) {
                                var otherCandidate = compositeMapping[name];
                                if (otherCandidate && !offsets[otherCandidate.name]) {
                                    offsets[otherCandidate.name] = otherCandidate;
                                    offsetCount += otherCandidate.contains.length - 1;
                                }
                            });
                            if (composite.contains.length - 1 > offsetCount) {
                                // if offsetting a previously selected composite, unselect that composite
                                // for each of its contains.
                                forIn(offsets, function(offset) {
                                    foreach(offset.contains, function(name) {
                                        delete compositeMapping[name];
                                    });
                                });
                                // select this composite for each script it contains
                                foreach(composite.contains, function(name) {
                                    compositeMapping[name] = composite;
                                });
                            }
                        }
                    });
                    forIn(compositeMapping, function(composite, name) {
                        Sys.scripts[name]._composite = composite;
                    });
                }
            },
            _buildArgs: function _buildArgs(fn, arglist, defaultSummary) {
                var desc = fn.description || defaultSummary,
                    comments = [];
                if (desc) {
                    comments.push('/// <summary>' + desc + '</summary>');
                }
                foreach(fn.parameters, function(parameter) {
                    var name = parameter, type = '', desc = '';
                    if (typeof(parameter) !== "string") {
                        name = parameter.name;
                        type = parameter.type||'';
                        desc = parameter.description||'';
                    }
                    arglist.push(name);
                    comments.push('/// <param name="' + name + '" type="' + type + '">' + desc + '</param>');
                });
                return comments;
            },
            _getCreate: function _getCreate(component, isPlugin, isjQuery, creatingjQueryPlugin) {
                // Creates a new function dynamically that actually has the specified parameters and doc comments for intellisense.
                // In release mode we simply pass through arguments to _callPlugin.
                var name = component.name,
                    scriptInfo = component.script,
                    isBehavior = component._isBehavior,
                    typeName = component.typeName,
                    arglist = [],
                    comments = this._buildArgs(component, arglist,
                        isPlugin ? "" : "Creates an instance of the type '" + typeName  + "' and sets the given properties.");
                if (isBehavior && !isjQuery) {
                    // accepts the target element as a first parameter
                    arglist.splice(0, 0, "target");
                    comments.push('/// <param name="target">The DOM element to attach to, as a DOM element or selector.</param>');
                }
                if (!isPlugin) {
                    arglist.push("properties");
                    comments.push('/// <param name="properties" type="Object" mayBeNull="true" optional="true">Additional properties to set on the component.</param>');
                    if (!isjQuery) {
                        comments.push('/// <returns type="' + typeName + '" />');
                    }
                }
                var fnBody = '';
                fnBody = comments.join('\n') + '\n';
                if (isjQuery) {
                    fnBody += "var args = arguments;\n";
                    if (!isPlugin) {
                        fnBody += "if (!Sys.create." + name + ".defaults) Sys.create." + name + ".defaults = arguments.callee.defaults || null;\n";
                    }
                    fnBody += "return this.each(function() {\n";
                }
                else {
                    fnBody += "return ";
                }
                fnBody += 'Sys.loader._callPlugin.call(this, "' + name + '", ' +
                    (isPlugin ? '"'+component.plugin+'"' : 'Sys._create') + ', ' + (isjQuery ? "args" : "arguments") + ', ' + !!isjQuery + ', this);';
                if (isjQuery) {
                    fnBody += "});";
                }
                arglist.push(fnBody);
                var createFn = Function.apply(null, arglist);
                if (!creatingjQueryPlugin) {
                    this._createPlugin(component, isPlugin);
                }
                return createFn;
            },
            _registerParents: function _registerParents(scriptInfo) {
                // tell each script it depends on that this script depends on it
                function register(dependency) {
                    var depInfo = getScriptInfo(dependency);
                    lazyset(depInfo, "_parents", scriptInfo.name, scriptInfo);
                }
                foreach(scriptInfo["dependencies"], register);
                foreach(scriptInfo["executionDependencies"], register);
            },
            _createPlugin: function(component, isPlugin) {
                if (window.jQuery) {
                    // this fn called via forIn, so isPlugin might be the field name,
                    // only explicit 'true' is treated as a plugin.
                    var name = component.name,
                        isBehavior = component._isBehavior,
                        fn = Sys.loader._getCreate(component, isPlugin === true, isBehavior, true),
                        target = isBehavior ? jQuery.fn : jQuery;
                    target[name] = fn;
                }
            },
            defineScript: function defineScript(scriptInfo) {
                /// <summary>Defines a script and its dependencies.</summary>
                /// <validationOptions enabled="false" />
                /// <param name="scriptInfo" type="Object">The script to define. You may use the following fields: name (required), debugUrl (string), releaseUrl (string), dependencies (array), executionDependencies (array).</param>
                var scripts = Sys.scripts,
                    name = scriptInfo.name,
                    contains = scriptInfo.contains;
                if (contains) {
                    var composites = Sys.composites;
                    composites[name] = scriptInfo = merge(composites[name], scriptInfo);
                    // create an index of its contents for more efficient lookup later
                    scriptInfo._contains = toIndex(contains);
                    // tell each script it contains that it is a part of this composite script
                    foreachScriptInfo(contains, function(contain) {
                        lazyset(contain, "_composites", name, scriptInfo);
                    });
                }
                else {
                    scriptInfo = scripts[name] = merge(scripts[name], scriptInfo);
                    this._registerParents(scriptInfo);
                    var isBehavior;
                    function registerComponent(component) {
                        var name;
                        if (typeof(component) === "string") {
                            component = { typeName: component };
                        }
                        else {
                            name = component.name;
                        }
                        if (!name) {
                            name = component.typeName;
                            var i = name.lastIndexOf('.');
                            if (i >= 0) {
                                // if it is a type name, like Sys.UI.DataView,
                                // we make 'DataView' the component name, but with a 
                                // lowercase first letter to convert to camel case
                                name = name.substr(i+1);
                            }
                            name = name.substr(0, 1).toLowerCase() + name.substr(1);
                            component.name = name;
                        }
                        component._isBehavior = isBehavior;
                        component.script = scriptInfo;
                        Sys.create[name] = Sys.loader._getCreate(component);
                        Sys.components[name] = merge(Sys.components[name], component);
                    }
                    
                    foreach(scriptInfo.components, registerComponent);
                    isBehavior = true;
                    foreach(scriptInfo.behaviors, registerComponent);
                    foreach(scriptInfo.plugins, function(plugin) {
                        // a plugin goes directly on Sys (e.g. Sys.foo())
                        // Calling it shorthand for first requiring the script the plugin lives within in,
                        // then executing it. The function name to call is given by the 'plugin' field.
                        var name = plugin.name;
                        plugin.script = scriptInfo;
                        Sys.plugins[name] = merge(Sys.plugins[name], plugin);
                        Sys[name] = Sys.loader._getCreate(plugin, true);
                    });
                }
                if (scriptInfo.isLoaded) {
                    scriptInfo._state = loaded;
                }
                scriptInfo._isScript = true;
            },
            _callPlugin: function(name, pluginFn, args, isjQuery, context) {
                var plugin = Sys.plugins[name],
                    component = Sys.components[name],
                    target = plugin || component,
                    scriptInfo = target.script;
                if (isLoaded(scriptInfo)) {
                    var cache = Sys.loader._eval,
                        fn = typeof(pluginFn) === "function" ? pluginFn : (cache[pluginFn] || (cache[pluginFn] = window.eval('(' + pluginFn + ')')));
                    if (component) {
                        var parameters = component.parameters || [],
                            isBehavior = component._isBehavior,
                            createArgs = isBehavior ?
                                [null, isjQuery ? context : args[0]] :
                                [];
                        var offsetFromTargetArgument = isBehavior && !isjQuery ? 1 : 0;
                        var props = args[parameters.length + offsetFromTargetArgument] || {};
                        createArgs[0] = props = merge({}, Sys.create[name].defaults, props);
                        // stuff the normal arguments into the props argument before calling Sys._create.
                        // For example, Sys.create.foo(target, /*param1*/a, /*param2*/b, { c: c })
                        // becomes the same as: Sys.create.foo(target, null, null, { param1: a, param2: b, c: c })
                        foreach(parameters, function(parameter, i) {
                            var name = typeof(parameter) === "string" ? parameter : parameter.name,
                                value = args[i + offsetFromTargetArgument];
                            // values already in the properties dictionary have precedence
                            if (typeof(value) !== "undefined" && typeof(props[name]) === "undefined") {
                                props[name] = value;
                            }
                        });
                        args = createArgs;
                    }
                    return fn.apply(target, args);
                }
                else {
                    throw new Error("The '" + name + "' plugin requires Sys.scripts." + scriptInfo.name + " to be loaded with a call to Sys.require() first.");
                }
            },
            defineScripts: function defineScripts(defaultScriptInfo, scriptInfos) {
                /// <summary>Defines a set of script and its dependencies.</summary>
                /// <validationOptions enabled="false" />
                /// <param name="defaultScriptInfo" type="Object">A default set of properties to apply to each defined script.</param>
                /// <param name="scriptInfos" type="Array" elementType="Object">The set of scripts to define. You may define on each: name (required), debugUrl (string), releaseUrl (string), dependencies (array), executionDependencies (array).</param>
                foreach(scriptInfos, function(scriptInfo) {
                    Sys.loader.defineScript(merge(null, defaultScriptInfo, scriptInfo));
                });
            },
            registerScript: function registerScript(name, executionDependencies, executionCallback) {
                /// <summary>Called by a script when it loads and it supports deferred exeuction.</summary>
                /// <validationOptions enabled="false" />
                /// <param name="name" type="String"></param>
                /// <param name="executionDependencies" mayBeNull="true" type="Array" elementType="String"></param>
                /// <param name="executionCallback" type="Function"></param>
                var scriptInfo = getScriptInfo(name);
                scriptInfo._callback = executionCallback;
                var existingList = lazyget(scriptInfo, "executionDependencies", []),
                    existing = toIndex(existingList);
                // add only the items that don't already exist
                foreach(executionDependencies, function(executionDependency) {
                    if (!existing[executionDependency]) {
                        existingList.push(executionDependency);
                    }
                });
                this._registerParents(scriptInfo);
                
                // the getHandler() script element event listener also sets the next state and calls
                // the execution callback. But we do it here also since this might occur when a script
                // loader script is referenced statically without an explicit call to load it, in which
                // case there is no script element listener.
                state(scriptInfo, loadingCo);
                requireScript(scriptInfo, null, null, true);
            },
            loadScripts: function loaderLoadScripts(scriptUrls, completedCallback, userContext) {
                /// <summary>
                /// Loads the given scripts, and executes a callback when they are available. Ensures each script is not loaded more than once even if one is referenced with a &lt;script&gt; element on the page.
                /// </summary>
                /// <validationOptions enabled="false" />
                /// <param name="scriptUrls" type="Array" elementType="String">Array of all the scripts to load. The scripts are loaded in sequential order.</param>
                /// <param name="completedCallback" type="Function" optional="true" mayBeNull="true">Optional callback that is called when all the scripts are available.</param>
                /// <param name="userContext" optional="true" mayBeNull="true">Optional context that is passed to the completed callback.</param>
                var index = -1, loaded = lazyget(this, "_loadedScripts", {});
                // clone the array so outside changes to it do not affect this asynchronous enumeration of it
                scriptUrls = scriptUrls instanceof Array ? Array.apply(null, scriptUrls) : [scriptUrls];
                function scriptLoaded() {
                    if (++index < scriptUrls.length) {
                        Sys.loader._loadSrc(scriptUrls[index], scriptLoaded);
                    }
                    else if (completedCallback) {
                        completedCallback(scriptUrls, userContext);
                    }
                }
                scriptLoaded();
            }
        } // loader
    });
    
    var loader = Sys.loader;
    
    // defined when component model loads, supports '$' syntax
    Sys._getComponent = Sys._getComponent || function() { }

    loader._init();
   
    loader.defineScripts({
        releaseUrl: "%/MicrosoftAjax" + "{0}.js",
        debugUrl: "%/MicrosoftAjax" + "{0}.debug.js",
        executionDependencies: ["Core"]
    },
    [{ name: "Core",
        executionDependencies: null,
        isLoaded: !!window.Type
    },
     { name: "ComponentModel",
       isLoaded: !!Sys.Component,
       plugins: [{name: "setCommand", description: "Causes a DOM element to raise a bubble event when clicked.",
                    plugin: "Sys.UI.DomElement.setCommand",
                    parameters: [{name: "commandSource", description: "The DOM element that causes the event when clicked."},
                                 {name: "commandName", description: "The name of the command to raise."},
                                 {name: "commandArgument", description: "Optional command argument."},
                                 {name: "commandTarget", description: "DOM element from which the command should start bubbling up."}]}]
     },
     { name: "History",
       executionDependencies: ["ComponentModel", "Serialization"],
       isLoaded: !!(Sys.Application && Sys.Application.get_stateString)
     },
     { name: "Serialization",
       isLoaded: !!Sys.Serialization
     },
     { name: "Network",
       executionDependencies: ["Serialization"],
       isLoaded: !!(Sys.Net && Sys.Net.WebRequest)
     },
     { name: "WebServices",
       executionDependencies: ["Network"],
       isLoaded: !!(Sys.Net && Sys.Net.WebServiceProxy)
     },
     { name: "ApplicationServices",
       executionDependencies: ["WebServices"],
       isLoaded: !!(Sys.Services && Sys.Services.RoleService && Sys.Services.RoleService.get_path)
     },
     { name: "Globalization",
       isLoaded: !!Number._parse
     },
     { name: "AdoNet",
       executionDependencies: ["WebServices"],
       components: ["Sys.Data.AdoNetServiceProxy"],
       isLoaded: !!(Sys.Data && Sys.Data.AdoNetServiceProxy)
     },
     { name: "DataContext",
     // TODO: Create new script, AdoNetDataContext.js, so you dont need all of AdoNet to get DataContext
     // webforms scenarios though: to use you'd need AdoNet.js, DataContext.js, AdoNetDataContext.js, Templates.js
       executionDependencies: ["ComponentModel", "Serialization", "WebServices", "AdoNet"],
       components: ["Sys.Data.DataContext", "Sys.Data.AdoNetDataContext"],
       isLoaded: !!(Sys.Data && Sys.Data.DataContext)
     },
     { name: "Templates",
       executionDependencies: ["ComponentModel", "Serialization"],
       behaviors: ["Sys.UI.DataView"],
       plugins: [{name:"bind", plugin: "Sys.Binding.bind", parameters: ['target',{name:'property',type:'String'},'source',{name:'path',type:'String'},'options']}],
       isLoaded: !!(Sys.UI && Sys.UI.Template)
     },
     // Composite Scripts
     { name: "MicrosoftAjax",
       releaseUrl: "%/MicrosoftAjax.js",
       debugUrl: "%/MicrosoftAjax.debug.js",
       executionDependencies: null,
       contains: ["Core", "ComponentModel", "History", "Serialization", "Network", "WebServices", "Globalization"]
     }
    ]);
    
    var ajaxPath = (window.location.protocol === "https" ? "https" : "http") + "://ajax.microsoft.com/ajax/";
    
    loader.defineScripts(null, [
     { name: "jQuery",
       releaseUrl: ajaxPath + "jquery/jquery-1.3.2.min.js",
       debugUrl: ajaxPath + "jquery/jquery-1.3.2.js",
       isLoaded: !!window.jQuery
     },
     { name: "jQueryValidate",
       releaseUrl: ajaxPath + "jquery.validate/1.5.5/jquery.validate.min.js",
       debugUrl: ajaxPath + "jquery.validate/1.5.5/jquery.validate.js",
       dependencies: ["jQuery"],
       isLoaded: !!(window.jQuery && jQuery.fn.validate)
     }
    ]);
    loader = null;
    
if (!window.Type) {
    // We have to provide this global 'Type' alias and 'registerNamespace' on it because ScriptManager adds script resources for
    // scripts that support localizationto the bottom, adding a Type.registerNamespace() call to ensure the strings object can be
    // defined within its namespace. We need it to actually work, too, creating the namespaces.
    window.Type = Function;
    Type.registerNamespace = Type.registerNamespace || function registerNamespace(namespacePath) {
        lazypush(Sys, "_ns", namespacePath);
        var rootObject = window;
        foreach(namespacePath.split('.'), function(part) {
            rootObject = rootObject[part] = rootObject[part] || {};
        });
        rootObject = null;
    }
}
Sys._domReady();
}

// the loader is duplicated in core, so make sure it doesn't execute twice
if (!window.Sys || !Sys.loader) {
    execute(window, window.Sys);
}

})();

// todo: loader is in core, but parts aren't needed.
// todo: duplicated global functions

