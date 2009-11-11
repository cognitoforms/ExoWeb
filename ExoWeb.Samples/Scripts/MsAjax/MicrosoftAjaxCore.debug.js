// (c) 2009 Microsoft Corporation, All Rights Reserved
// Use of this software is subject to the following license terms: 
// http://go.microsoft.com/fwlink/?LinkId=163454


(function() {

(function() {
function execute(window, Sys) {
    var notLoading = 0,         loading = 1,         loadingCo = 2,         loaded = 3,         attachEvent = !!document.attachEvent;

                        function callIf(obj, name, args) {
                var fn = obj[name],
            exists = typeof(fn) === "function";
        if (exists) fn.call(obj, args);
        return exists;
    }
    function forIn(obj, callback) {
        for (var x in obj) {
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
                        var arr = obj[field];
        delete obj[field];
        forall(arr, function(callback) {
            callback.apply(null, args||[]);
        });
    }
    function toIndex(arr) {
                var obj = {};
        foreach(arr, function(name) {
            obj[name] = true;
        });
        return obj;
    }
    function lazyget(obj, name, value) {
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
                        var dependencies = [];
        foreachScriptInfo(composite.contains, function(scriptInfo) {
            foreach(lazyget(scriptInfo, executionDependencies ? "executionDependencies" : "dependencies"), function(name) {
                                                if (!composite._contains[name]) dependencies.push(name);
            });
        });
        return dependencies;
    }
    function getDependencies(scriptInfo, executionDependencies) {
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
        __class: true,         debug: true,
        activateDom: true,
        scripts: {},
        composites: {},
        components: {},
        plugins: {},
        create: {},
        converters: {},
        _create: function _create(properties, target) {
                        if (typeof(target) === "string") {
                target = Sys.get(target);
            }
            var type = this._type || (this._type = window.eval("(" + this.typeName + ")"));
            var instance = (typeof(target) === "undefined" ? new type() : new type(target));
            callIf(instance, "beginUpdate");
            forIn(properties, function(value, field) {
                                callIf(instance, "add_" + field, value) ||
                callIf(instance, "set_" + field, value) ||
                (instance[field] = value);
            });
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
                                                                                                                        foreachCall(Sys, "_domReadyQueue");
                    raiseOnReady();
                }
            }
            listenOnce(window, "load", null, domReady);

            var check;
            if (attachEvent) {
                if ((window == window.top) && document.documentElement.doScroll) {
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
            /// <summary locid="M:J#find" />
            /// <param name="selector"></param>
            /// <param name="context" optional="true" mayBeNull="true"></param>
            /// <returns type="Array"></returns>
            return (context && typeof(context.find) === "function") ?
                context.find(selector) :
                this._find(selector, context);
        },
        get: function get(selector, context) {
            /// <summary locid="M:J#get" />
            /// <param name="selector"></param>
            /// <param name="context" optional="true" mayBeNull="true"></param>
            /// <returns></returns>
            return (context && typeof(context.get) === "function") ?
                context.get(selector) :
                this._find(selector, context, true);
        },
        _find: function(selector, context, single) {
            var found = [];
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
            /// <summary locid="M:J#onReady" />
            /// <param name="callback" type="Function"></param>
            lazypush(this, "_readyQueue", callback);
            raiseOnReady();
        },
        require: function require(features, completedCallback, userContext) {
            /// <summary locid="M:J#require" />
            /// <param name="features" type="Array"></param>
            /// <param name="completedCallback" type="Function" optional="true" mayBeNull="true"></param>
            /// <param name="userContext" optional="true" mayBeNull="true"></param>
                                    var session = Sys.loader._session++,
                iterating,
                loaded;
            function raiseCallback() {
                                if (completedCallback) {
                    Sys._ready ? completedCallback(features, userContext)
                               : lazypush(Sys, "_domReadyQueue", raiseCallback);
                }
            }
            function allLoaded() {
                                                                                
                                                                                                                                if (!loaded && !iterating && !iteration()) {
                    loaded = true;
                    raiseCallback();
                }
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
            /// <summary locid="M:J#loadScripts" />
            /// <param name="scriptUrls" type="Array" elementType="String"></param>
            /// <param name="completedCallback" type="Function" optional="true" mayBeNull="true"></param>
            /// <param name="userContext" optional="true" mayBeNull="true"></param>
            this.loader.loadScripts(scriptUrls, completedCallback, userContext);
        },
        loader: {
            __class: true,             combine: true,
            basePath: null,             _loading: 0,
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
                                                var waiting;
                if (!isLoaded(scriptInfo)) {
                    var waitForDeps = requireAll(getDependencies(scriptInfo), callback, session, readOnly),
                        waitForDepsCo = requireAll(getDependencies(scriptInfo, true), callback, session, readOnly);
                    if (!waitForDeps && !waitForDepsCo && state(scriptInfo) === loadingCo) {
                                                                                                                                                state(scriptInfo, loaded);
                                                                        foreachCall(scriptInfo, "_callback");
                        if (scriptInfo.name === "jQuery" && window.jQuery) {
                                                        var loader = Sys.loader;
                            forIn(Sys.components, loader._createPlugin);
                            forIn(Sys.plugins, function(plugin) {
                                loader._createPlugin(plugin, true);
                            });
                        }
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
                                        Sys.loader._loading--;
                    if (state(scriptInfo) < loadingCo) {
                                                                        state(scriptInfo, loadingCo);
                    }
                    foreachCall(scriptInfo, "_notify");
                                        foreachScriptInfo(scriptInfo.contains, function(scriptInfo) {
                        foreachCall(scriptInfo, "_notify");
                    });
                }
            },
            _findComposites: function _findComposites(scripts) {
                                                                var scriptSet = {},
                    compositeMapping = {},
                    foundAny;
                                                function visit(script) {
                    script = resolveScriptInfo(script);
                    var currentState = state(script);
                    if (currentState < loading && !getComposite(script)) {
                                                scriptSet[script.name] = script;
                        foundAny = true;
                        foreach(script["dependencies"], visit);
                    }
                    if (currentState < loaded) {
                                                                        foreach(script["executionDependencies"], visit);
                    }
                }
                foreach(scripts, visit);
                if (foundAny) {
                                                                                                    forIn(Sys.composites, function(composite) {
                        if (foreachScriptInfo(composite.contains, function(contained) {
                                if (!scriptSet[contained.name]) {
                                    return true;
                                }
                            })) {
                                                                                                                                                                                                                                                            var offsets = {}, offsetCount = 0;
                            foreach(composite.contains, function(name) {
                                var otherCandidate = compositeMapping[name];
                                if (otherCandidate && !offsets[otherCandidate.name]) {
                                    offsets[otherCandidate.name] = otherCandidate;
                                    offsetCount += otherCandidate.contains.length - 1;
                                }
                            });
                            if (composite.contains.length - 1 > offsetCount) {
                                                                                                forIn(offsets, function(offset) {
                                    foreach(offset.contains, function(name) {
                                        delete compositeMapping[name];
                                    });
                                });
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
                                                var name = component.name,
                    scriptInfo = component.script,
                    isBehavior = component._isBehavior,
                    typeName = component.typeName,
                    arglist = [],
                    comments = this._buildArgs(component, arglist,
                        isPlugin ? "" : "Creates an instance of the type '" + typeName  + "' and sets the given properties.");
                if (isBehavior && !isjQuery) {
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
                                function register(dependency) {
                    var depInfo = getScriptInfo(dependency);
                    lazyset(depInfo, "_parents", scriptInfo.name, scriptInfo);
                }
                foreach(scriptInfo["dependencies"], register);
                foreach(scriptInfo["executionDependencies"], register);
            },
            _createPlugin: function(component, isPlugin) {
                if (window.jQuery) {
                                                            var name = component.name,
                        isBehavior = component._isBehavior,
                        fn = Sys.loader._getCreate(component, isPlugin === true, isBehavior, true),
                        target = isBehavior ? jQuery.fn : jQuery;
                    target[name] = fn;
                }
            },
            defineScript: function defineScript(scriptInfo) {
                /// <summary locid="M:J#defineScript" />
                /// <param name="scriptInfo" type="Object"></param>
                var scripts = Sys.scripts,
                    name = scriptInfo.name,
                    contains = scriptInfo.contains;
                if (contains) {
                    var composites = Sys.composites;
                    composites[name] = scriptInfo = merge(composites[name], scriptInfo);
                                        scriptInfo._contains = toIndex(contains);
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
                                                                                                foreach(parameters, function(parameter, i) {
                            var name = typeof(parameter) === "string" ? parameter : parameter.name,
                                value = args[i + offsetFromTargetArgument];
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
                /// <summary locid="M:J#defineScripts" />
                /// <param name="defaultScriptInfo" type="Object"></param>
                /// <param name="scriptInfos" type="Array" elementType="Object"></param>
                foreach(scriptInfos, function(scriptInfo) {
                    Sys.loader.defineScript(merge(null, defaultScriptInfo, scriptInfo));
                });
            },
            registerScript: function registerScript(name, executionDependencies, executionCallback) {
                /// <summary locid="M:J#registerScript" />
                /// <param name="name" type="String"></param>
                /// <param name="executionDependencies" mayBeNull="true" type="Array" elementType="String"></param>
                /// <param name="executionCallback" type="Function"></param>
                var scriptInfo = getScriptInfo(name);
                scriptInfo._callback = executionCallback;
                var existingList = lazyget(scriptInfo, "executionDependencies", []),
                    existing = toIndex(existingList);
                                foreach(executionDependencies, function(executionDependency) {
                    if (!existing[executionDependency]) {
                        existingList.push(executionDependency);
                    }
                });
                this._registerParents(scriptInfo);
                
                                                                                state(scriptInfo, loadingCo);
                requireScript(scriptInfo, null, null, true);
            },
            loadScripts: function loaderLoadScripts(scriptUrls, completedCallback, userContext) {
                /// <summary locid="M:J#loaderLoadScripts" />
                /// <param name="scriptUrls" type="Array" elementType="String"></param>
                /// <param name="completedCallback" type="Function" optional="true" mayBeNull="true"></param>
                /// <param name="userContext" optional="true" mayBeNull="true"></param>
                var index = -1, loaded = lazyget(this, "_loadedScripts", {});
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
        }     });
    
    var loader = Sys.loader;
    
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

if (!window.Sys || !Sys.loader) {
    execute(window, window.Sys);
}

})();


function execute() {

 
Function.__typeName = 'Function';
Function.__class = true;

Function.createCallback = function Function$createCallback(method, context) {
    /// <summary locid="M:J#Function.createCallback" />
    /// <param name="method" type="Function"></param>
    /// <param name="context" mayBeNull="true"></param>
    /// <returns type="Function"></returns>
    var e = Function._validateParams(arguments, [
        {name: "method", type: Function},
        {name: "context", mayBeNull: true}
    ]);
    if (e) throw e;

        
    return function() {
        var l = arguments.length;
        if (l > 0) {
                        var args = [];
            for (var i = 0; i < l; i++) {
                args[i] = arguments[i];
            }
            args[l] = context;
            return method.apply(this, args);
        }
        return method.call(this, context);
    }
}

Function.createDelegate = function Function$createDelegate(instance, method) {
    /// <summary locid="M:J#Function.createDelegate" />
    /// <param name="instance" mayBeNull="true"></param>
    /// <param name="method" type="Function"></param>
    /// <returns type="Function"></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance", mayBeNull: true},
        {name: "method", type: Function}
    ]);
    if (e) throw e;

        
    return function() {
        return method.apply(instance, arguments);
    }
}

Function.emptyFunction = Function.emptyMethod = function Function$emptyMethod() {
    /// <summary locid="M:J#Function.emptyMethod" />
}

Function.validateParameters = function Function$validateParameters(parameters, expectedParameters, validateParameterCount) {
    /// <summary locid="M:J#Function.validateParameters" />
    /// <param name="parameters"></param>
    /// <param name="expectedParameters"></param>
    /// <param name="validateParameterCount" type="Boolean" optional="true"></param>
    /// <returns type="Error" mayBeNull="true"></returns>
    var e = Function._validateParams(arguments, [
        {name: "parameters"},
        {name: "expectedParameters"},
        {name: "validateParameterCount", type: Boolean, optional: true}
    ]);
    if (e) throw e;
        return Function._validateParams(parameters, expectedParameters, validateParameterCount);
}

Function._validateParams = function Function$_validateParams(params, expectedParams, validateParameterCount) {
                                                                                                                                        var e, expectedLength = expectedParams.length;
    validateParameterCount = validateParameterCount || (typeof(validateParameterCount) === "undefined");
    e = Function._validateParameterCount(params, expectedParams, validateParameterCount);
    if (e) {
        e.popStackFrame();
        return e;
    }
    for (var i = 0, l = params.length; i < l; i++) {
                                var expectedParam = expectedParams[Math.min(i, expectedLength - 1)],
            paramName = expectedParam.name;
        if (expectedParam.parameterArray) {
                        paramName += "[" + (i - expectedLength + 1) + "]";
        }
        else if (!validateParameterCount && (i >= expectedLength)) {
                                                break;
        }
        e = Function._validateParameter(params[i], expectedParam, paramName);
        if (e) {
            e.popStackFrame();
            return e;
        }
    }
    return null;
}

Function._validateParameterCount = function Function$_validateParameterCount(params, expectedParams, validateParameterCount) {
    var i, error,
        expectedLen = expectedParams.length,
        actualLen = params.length;
    if (actualLen < expectedLen) {
                var minParams = expectedLen;
        for (i = 0; i < expectedLen; i++) {
            var param = expectedParams[i];
            if (param.optional || param.parameterArray) {
                minParams--;
            }
        }        
        if (actualLen < minParams) {
            error = true;
        }
    }
    else if (validateParameterCount && (actualLen > expectedLen)) {
                error = true;      
        for (i = 0; i < expectedLen; i++) {
            if (expectedParams[i].parameterArray) {
                error = false;                 break;
            }
        }  
    }

    if (error) {
        var e = Error.parameterCount();
        e.popStackFrame();
        return e;
    }

    return null;
}

Function._validateParameter = function Function$_validateParameter(param, expectedParam, paramName) {
    var e,
        expectedType = expectedParam.type,
        expectedInteger = !!expectedParam.integer,
        expectedDomElement = !!expectedParam.domElement,
        mayBeNull = !!expectedParam.mayBeNull;

    e = Function._validateParameterType(param, expectedType, expectedInteger, expectedDomElement, mayBeNull, paramName);
    if (e) {
        e.popStackFrame();
        return e;
    }

        var expectedElementType = expectedParam.elementType,
        elementMayBeNull = !!expectedParam.elementMayBeNull;
    if (expectedType === Array && typeof(param) !== "undefined" && param !== null &&
        (expectedElementType || !elementMayBeNull)) {
        var expectedElementInteger = !!expectedParam.elementInteger,
            expectedElementDomElement = !!expectedParam.elementDomElement;
        for (var i=0; i < param.length; i++) {
            var elem = param[i];
            e = Function._validateParameterType(elem, expectedElementType,
                expectedElementInteger, expectedElementDomElement, elementMayBeNull,
                paramName + "[" + i + "]");
            if (e) {
                e.popStackFrame();
                return e;
            }
        }
    }

    return null;
}

Function._validateParameterType = function Function$_validateParameterType(param, expectedType, expectedInteger, expectedDomElement, mayBeNull, paramName) {
    var e, i;

    if (typeof(param) === "undefined") {
        if (mayBeNull) {
            return null;
        }
        else {
            e = Error.argumentUndefined(paramName);
            e.popStackFrame();
            return e;
        }
    }

    if (param === null) {
        if (mayBeNull) {
            return null;
        }
        else {
            e = Error.argumentNull(paramName);
            e.popStackFrame();
            return e;
        }
    }

    if (expectedType && expectedType.__enum) {
        if (typeof(param) !== 'number') {
            e = Error.argumentType(paramName, Object.getType(param), expectedType);
            e.popStackFrame();
            return e;
        }
        if ((param % 1) === 0) {
            var values = expectedType.prototype;
            if (!expectedType.__flags || (param === 0)) {
                for (i in values) {
                    if (values[i] === param) return null;
                }
            }
            else {
                var v = param;
                for (i in values) {
                    var vali = values[i];
                    if (vali === 0) continue;
                    if ((vali & param) === vali) {
                        v -= vali;
                    }
                    if (v === 0) return null;
                }
            }
        }
        e = Error.argumentOutOfRange(paramName, param, String.format(Sys.Res.enumInvalidValue, param, expectedType.getName()));
        e.popStackFrame();
        return e;
    }

        if (expectedDomElement && (!Sys._isDomElement(param) || (param.nodeType === 3))) {
        e = Error.argument(paramName, Sys.Res.argumentDomElement);
        e.popStackFrame();
        return e;
    }

        if (expectedType && !Sys._isInstanceOfType(expectedType, param)) {
        e = Error.argumentType(paramName, Object.getType(param), expectedType);
        e.popStackFrame();
        return e;
    }

    if (expectedType === Number && expectedInteger) {
                        if ((param % 1) !== 0) {
            e = Error.argumentOutOfRange(paramName, param, Sys.Res.argumentInteger);
            e.popStackFrame();
            return e;
        }
    }

    return null;
}
 
Error.__typeName = 'Error';
Error.__class = true;

Error.create = function Error$create(message, errorInfo) {
    /// <summary locid="M:J#Error.create" />
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <param name="errorInfo" optional="true" mayBeNull="true"></param>
    /// <returns type="Error"></returns>
    var e = Function._validateParams(arguments, [
        {name: "message", type: String, mayBeNull: true, optional: true},
        {name: "errorInfo", mayBeNull: true, optional: true}
    ]);
    if (e) throw e;

            var err = new Error(message);
    err.message = message;

    if (errorInfo) {
        for (var v in errorInfo) {
            err[v] = errorInfo[v];
        }
    }

    err.popStackFrame();
    return err;
}

Error.argument = function Error$argument(paramName, message) {
    /// <summary locid="M:J#Error.argument" />
    /// <param name="paramName" type="String" optional="true" mayBeNull="true"></param>
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "paramName", type: String, mayBeNull: true, optional: true},
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;

    var displayMessage = "Sys.ArgumentException: " + (message ? message : Sys.Res.argument);
    if (paramName) {
        displayMessage += "\n" + String.format(Sys.Res.paramName, paramName);
    }

    var err = Error.create(displayMessage, { name: "Sys.ArgumentException", paramName: paramName });
    err.popStackFrame();
    return err;
}

Error.argumentNull = function Error$argumentNull(paramName, message) {
    /// <summary locid="M:J#Error.argumentNull" />
    /// <param name="paramName" type="String" optional="true" mayBeNull="true"></param>
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "paramName", type: String, mayBeNull: true, optional: true},
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;

    var displayMessage = "Sys.ArgumentNullException: " + (message ? message : Sys.Res.argumentNull);
    if (paramName) {
        displayMessage += "\n" + String.format(Sys.Res.paramName, paramName);
    }

    var err = Error.create(displayMessage, { name: "Sys.ArgumentNullException", paramName: paramName });
    err.popStackFrame();
    return err;
}

Error.argumentOutOfRange = function Error$argumentOutOfRange(paramName, actualValue, message) {
    /// <summary locid="M:J#Error.argumentOutOfRange" />
    /// <param name="paramName" type="String" optional="true" mayBeNull="true"></param>
    /// <param name="actualValue" optional="true" mayBeNull="true"></param>
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "paramName", type: String, mayBeNull: true, optional: true},
        {name: "actualValue", mayBeNull: true, optional: true},
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;

    var displayMessage = "Sys.ArgumentOutOfRangeException: " + (message ? message : Sys.Res.argumentOutOfRange);
    if (paramName) {
        displayMessage += "\n" + String.format(Sys.Res.paramName, paramName);
    }

                if (typeof(actualValue) !== "undefined" && actualValue !== null) {
        displayMessage += "\n" + String.format(Sys.Res.actualValue, actualValue);
    }

    var err = Error.create(displayMessage, {
        name: "Sys.ArgumentOutOfRangeException",
        paramName: paramName,
        actualValue: actualValue
    });
    err.popStackFrame();
    return err;
}

Error.argumentType = function Error$argumentType(paramName, actualType, expectedType, message) {
    /// <summary locid="M:J#Error.argumentType" />
    /// <param name="paramName" type="String" optional="true" mayBeNull="true"></param>
    /// <param name="actualType" type="Type" optional="true" mayBeNull="true"></param>
    /// <param name="expectedType" type="Type" optional="true" mayBeNull="true"></param>
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "paramName", type: String, mayBeNull: true, optional: true},
        {name: "actualType", type: Type, mayBeNull: true, optional: true},
        {name: "expectedType", type: Type, mayBeNull: true, optional: true},
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;

    var displayMessage = "Sys.ArgumentTypeException: ";
    if (message) {
        displayMessage += message;
    }
    else if (actualType && expectedType) {
        displayMessage +=
            String.format(Sys.Res.argumentTypeWithTypes, actualType.getName(), expectedType.getName());
    }
    else {
        displayMessage += Sys.Res.argumentType;
    }

    if (paramName) {
        displayMessage += "\n" + String.format(Sys.Res.paramName, paramName);
    }

    var err = Error.create(displayMessage, {
        name: "Sys.ArgumentTypeException",
        paramName: paramName,
        actualType: actualType,
        expectedType: expectedType
    });
    err.popStackFrame();
    return err;
}

Error.argumentUndefined = function Error$argumentUndefined(paramName, message) {
    /// <summary locid="M:J#Error.argumentUndefined" />
    /// <param name="paramName" type="String" optional="true" mayBeNull="true"></param>
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "paramName", type: String, mayBeNull: true, optional: true},
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;

    var displayMessage = "Sys.ArgumentUndefinedException: " + (message ? message : Sys.Res.argumentUndefined);
    if (paramName) {
        displayMessage += "\n" + String.format(Sys.Res.paramName, paramName);
    }

    var err = Error.create(displayMessage, { name: "Sys.ArgumentUndefinedException", paramName: paramName });
    err.popStackFrame();
    return err;
}

Error.format = function Error$format(message) {
    /// <summary locid="M:J#Error.format" />
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    var displayMessage = "Sys.FormatException: " + (message ? message : Sys.Res.format);
    var err = Error.create(displayMessage, {name: 'Sys.FormatException'});
    err.popStackFrame();
    return err;
}

Error.invalidOperation = function Error$invalidOperation(message) {
    /// <summary locid="M:J#Error.invalidOperation" />
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    var displayMessage = "Sys.InvalidOperationException: " + (message ? message : Sys.Res.invalidOperation);

    var err = Error.create(displayMessage, {name: 'Sys.InvalidOperationException'});
    err.popStackFrame();
    return err;
}

Error.notImplemented = function Error$notImplemented(message) {
    /// <summary locid="M:J#Error.notImplemented" />
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    var displayMessage = "Sys.NotImplementedException: " + (message ? message : Sys.Res.notImplemented);

    var err = Error.create(displayMessage, {name: 'Sys.NotImplementedException'});
    err.popStackFrame();
    return err;
}

Error.parameterCount = function Error$parameterCount(message) {
    /// <summary locid="M:J#Error.parameterCount" />
    /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "message", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;

    var displayMessage = "Sys.ParameterCountException: " + (message ? message : Sys.Res.parameterCount);
    var err = Error.create(displayMessage, {name: 'Sys.ParameterCountException'});
    err.popStackFrame();
    return err;
}

Error.prototype.popStackFrame = function Error$popStackFrame() {
    /// <summary locid="M:J#checkParam" />
    if (arguments.length !== 0) throw Error.parameterCount();

                            
    if (typeof(this.stack) === "undefined" || this.stack === null ||
        typeof(this.fileName) === "undefined" || this.fileName === null ||
        typeof(this.lineNumber) === "undefined" || this.lineNumber === null) {
        return;
    }

    var stackFrames = this.stack.split("\n");

                var currentFrame = stackFrames[0];
    var pattern = this.fileName + ":" + this.lineNumber;
    while(typeof(currentFrame) !== "undefined" &&
          currentFrame !== null &&
          currentFrame.indexOf(pattern) === -1) {
        stackFrames.shift();
        currentFrame = stackFrames[0];
    }

    var nextFrame = stackFrames[1];

        if (typeof(nextFrame) === "undefined" || nextFrame === null) {
        return;
    }

        var nextFrameParts = nextFrame.match(/@(.*):(\d+)$/);
    if (typeof(nextFrameParts) === "undefined" || nextFrameParts === null) {
        return;
    }

    this.fileName = nextFrameParts[1];

        this.lineNumber = parseInt(nextFrameParts[2]);

    stackFrames.shift();
    this.stack = stackFrames.join("\n");
}
 
Object.__typeName = 'Object';
Object.__class = true;

Object.getType = function Object$getType(instance) {
    /// <summary locid="M:J#Object.getType" />
    /// <param name="instance"></param>
    /// <returns type="Type"></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance"}
    ]);
    if (e) throw e;
    var ctor = instance.constructor;
    if (!ctor || (typeof(ctor) !== "function") || !ctor.__typeName || (ctor.__typeName === 'Object')) {
        return Object;
    }
    return ctor;
}

Object.getTypeName = function Object$getTypeName(instance) {
    /// <summary locid="M:J#Object.getTypeName" />
    /// <param name="instance"></param>
    /// <returns type="String"></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance"}
    ]);
    if (e) throw e;
    return Object.getType(instance).getName();
}
 
String.__typeName = 'String';
String.__class = true;

String.prototype.endsWith = function String$endsWith(suffix) {
    /// <summary locid="M:J#String.endsWith" />
    /// <param name="suffix" type="String"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "suffix", type: String}
    ]);
    if (e) throw e;
    return (this.substr(this.length - suffix.length) === suffix);
}

String.prototype.startsWith = function String$startsWith(prefix) {
    /// <summary locid="M:J#String.startsWith" />
    /// <param name="prefix" type="String"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "prefix", type: String}
    ]);
    if (e) throw e;
    return (this.substr(0, prefix.length) === prefix);
}

String.prototype.trim = function String$trim() {
    /// <summary locid="M:J#String.trim" />
    /// <returns type="String"></returns>
    if (arguments.length !== 0) throw Error.parameterCount();
    return this.replace(/^\s+|\s+$/g, '');
}

String.prototype.trimEnd = function String$trimEnd() {
    /// <summary locid="M:J#String.trimEnd" />
    /// <returns type="String"></returns>
    if (arguments.length !== 0) throw Error.parameterCount();
    return this.replace(/\s+$/, '');
}

String.prototype.trimStart = function String$trimStart() {
    /// <summary locid="M:J#String.trimStart" />
    /// <returns type="String"></returns>
    if (arguments.length !== 0) throw Error.parameterCount();
    return this.replace(/^\s+/, '');
}

String.format = function String$format(format, args) {
    /// <summary locid="M:J#String.format" />
    /// <param name="format" type="String"></param>
    /// <param name="args" parameterArray="true" mayBeNull="true"></param>
    /// <returns type="String"></returns>
    var e = Function._validateParams(arguments, [
        {name: "format", type: String},
        {name: "args", mayBeNull: true, parameterArray: true}
    ]);
    if (e) throw e;
    return String._toFormattedString(false, arguments);
}

String._toFormattedString = function String$_toFormattedString(useLocale, args) {
    var result = '';
    var format = args[0];

    for (var i=0;;) {
                var open = format.indexOf('{', i);
        var close = format.indexOf('}', i);
        if ((open < 0) && (close < 0)) {
                        result += format.slice(i);
            break;
        }
        if ((close > 0) && ((close < open) || (open < 0))) {
                        if (format.charAt(close + 1) !== '}') {
                throw Error.argument('format', Sys.Res.stringFormatBraceMismatch);
            }
            result += format.slice(i, close + 1);
            i = close + 2;
            continue;
        }

                result += format.slice(i, open);
        i = open + 1;

                if (format.charAt(i) === '{') {
            result += '{';
            i++;
            continue;
        }

                if (close < 0) throw Error.argument('format', Sys.Res.stringFormatBraceMismatch);

        
                var brace = format.substring(i, close);
        var colonIndex = brace.indexOf(':');
        var argNumber = parseInt((colonIndex < 0)? brace : brace.substring(0, colonIndex), 10) + 1;
        if (isNaN(argNumber)) throw Error.argument('format', Sys.Res.stringFormatInvalid);
        var argFormat = (colonIndex < 0)? '' : brace.substring(colonIndex + 1);

        var arg = args[argNumber];
        if (typeof(arg) === "undefined" || arg === null) {
            arg = '';
        }

                if (arg.toFormattedString) {
            result += arg.toFormattedString(argFormat);
        }
        else if (useLocale && arg.localeFormat) {
            result += arg.localeFormat(argFormat);
        }
        else if (arg.format) {
            result += arg.format(argFormat);
        }
        else
            result += arg.toString();

        i = close + 1;
    }

    return result;
}
 
Boolean.__typeName = 'Boolean';
Boolean.__class = true;

Boolean.parse = function Boolean$parse(value) {
    /// <summary locid="M:J#Boolean.parse" />
    /// <param name="value" type="String"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "value", type: String}
    ], false);
    if (e) throw e;
    var v = value.trim().toLowerCase();
    if (v === 'false') return false;
    if (v === 'true') return true;
    throw Error.argumentOutOfRange('value', value, Sys.Res.boolTrueOrFalse);
}
 
Date.__typeName = 'Date';
Date.__class = true;
 
Number.__typeName = 'Number';
Number.__class = true;
 
RegExp.__typeName = 'RegExp';
RegExp.__class = true;
var merge = Sys._merge = function _merge(target) {
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

var forIn = Sys._forIn = function _forIn(obj, callback) {
    for (var x in obj) {
        if (obj.hasOwnProperty(x)) callback(obj[x], x);
    }
}
var foreach = Sys._foreach = function _foreach(arr, callback, start) {
    var cancelled;
    if (arr) {
        arr = (arr instanceof Array) ? arr : ((typeof(arr.length) === "number" && !/function|string/.test(typeof(arr))) ? arr : [arr]);
        for (var i = start||0, l = arr.length; i < l; i++) {
            if (callback(arr[i], i)) {
                cancelled = true;
                break;
            }
        }
    }
    return !cancelled;
}

Sys._isInstanceOfType = function Sys$_isInstanceOfType(type, instance) {
    if (typeof(instance) === "undefined" || instance === null) return false;
    if (instance instanceof type) return true;
    var instanceType = Object.getType(instance);
    return !!(instanceType === type) ||
           (instanceType.inheritsFrom && instanceType.inheritsFrom(type)) ||
           (instanceType.implementsInterface && instanceType.implementsInterface(type));
}

Sys._getBaseMethod = function Sys$_getBaseMethod(type, instance, name) {
    if (!Sys._isInstanceOfType(type, instance)) throw Error.argumentType('instance', Object.getType(instance), type);
    var baseType = type.getBaseType();
    if (baseType) {
        var baseMethod = baseType.prototype[name];
        return (baseMethod instanceof Function) ? baseMethod : null;
    }
    return null;
}

Sys._isDomElement = function Sys$_isDomElement(obj) {
                        var val = false;
    if (typeof (obj.nodeType) !== 'number') {
                                var doc = obj.ownerDocument || obj.document || obj;
        if (doc != obj) {
                                    var w = doc.defaultView || doc.parentWindow;
            val = (w != obj);
        }
        else {
                                    val = (typeof (doc.body) === 'undefined');
        }
    }
    return !val;
}

var isBrowser = Sys._isBrowser = function Sys$_isBrowser(name) {
    return Sys.Browser.agent === Sys.Browser[name];
}
 
if (!window) this.window = this;

window.Type = Function;

Type.__fullyQualifiedIdentifierRegExp = new RegExp("^[^.0-9 \\s|,;:&*=+\\-()\\[\\]{}^%#@!~\\n\\r\\t\\f\\\\]([^ \\s|,;:&*=+\\-()\\[\\]{}^%#@!~\\n\\r\\t\\f\\\\]*[^. \\s|,;:&*=+\\-()\\[\\]{}^%#@!~\\n\\r\\t\\f\\\\])?$", "i");
Type.__identifierRegExp = new RegExp("^[^.0-9 \\s|,;:&*=+\\-()\\[\\]{}^%#@!~\\n\\r\\t\\f\\\\][^. \\s|,;:&*=+\\-()\\[\\]{}^%#@!~\\n\\r\\t\\f\\\\]*$", "i");

Type.prototype.callBaseMethod = function Type$callBaseMethod(instance, name, baseArguments) {
    /// <summary locid="M:J#Type.callBaseMethod" />
    /// <param name="instance"></param>
    /// <param name="name" type="String"></param>
    /// <param name="baseArguments" type="Array" optional="true" mayBeNull="true" elementMayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance"},
        {name: "name", type: String},
        {name: "baseArguments", type: Array, mayBeNull: true, optional: true, elementMayBeNull: true}
    ]);
    if (e) throw e;
    var baseMethod = Sys._getBaseMethod(this, instance, name);
    if (!baseMethod) throw Error.invalidOperation(String.format(Sys.Res.methodNotFound, name));
    if (!baseArguments) {
        return baseMethod.apply(instance);
    }
    else {
        return baseMethod.apply(instance, baseArguments);
    }
}

Type.prototype.getBaseMethod = function Type$getBaseMethod(instance, name) {
    /// <summary locid="M:J#Type.getBaseMethod" />
    /// <param name="instance"></param>
    /// <param name="name" type="String"></param>
    /// <returns type="Function" mayBeNull="true"></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance"},
        {name: "name", type: String}
    ]);
    if (e) throw e;
    return Sys._getBaseMethod(this, instance, name);
}

Type.prototype.getBaseType = function Type$getBaseType() {
    /// <summary locid="M:J#Type.getBaseType" />
    /// <returns type="Type" mayBeNull="true"></returns>
    if (arguments.length !== 0) throw Error.parameterCount();
    return (typeof(this.__baseType) === "undefined") ? null : this.__baseType;
}

Type.prototype.getInterfaces = function Type$getInterfaces() {
    /// <summary locid="M:J#Type.getInterfaces" />
    /// <returns type="Array" elementType="Type" mayBeNull="false" elementMayBeNull="false"></returns>
    if (arguments.length !== 0) throw Error.parameterCount();
    var result = [];
    var type = this;
    while(type) {
        var interfaces = type.__interfaces;
        if (interfaces) {
            for (var i = 0, l = interfaces.length; i < l; i++) {
                var interfaceType = interfaces[i];
                if (!Array.contains(result, interfaceType)) {
                    result[result.length] = interfaceType;
                }
            }
        }
        type = type.__baseType;
    }
    return result;
}

Type.prototype.getName = function Type$getName() {
    /// <summary locid="M:J#Type.getName" />
    /// <returns type="String"></returns>
    if (arguments.length !== 0) throw Error.parameterCount();
    return (typeof(this.__typeName) === "undefined") ? "" : this.__typeName;
}

Type.prototype.implementsInterface = function Type$implementsInterface(interfaceType) {
    /// <summary locid="M:J#Type.implementsInterface" />
    /// <param name="interfaceType" type="Type"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "interfaceType", type: Type}
    ]);
    if (e) throw e;
    this.resolveInheritance();

    var interfaceName = interfaceType.getName();
    var cache = this.__interfaceCache;
    if (cache) {
        var cacheEntry = cache[interfaceName];
        if (typeof(cacheEntry) !== 'undefined') return cacheEntry;
    }
    else {
        cache = this.__interfaceCache = {};
    }

    var baseType = this;
    while (baseType) {
        var interfaces = baseType.__interfaces;
        if (interfaces) {
            if (Array.indexOf(interfaces, interfaceType) !== -1) {
                return cache[interfaceName] = true;
            }
        }

        baseType = baseType.__baseType;
    }

    return cache[interfaceName] = false;
}

Type.prototype.inheritsFrom = function Type$inheritsFrom(parentType) {
    /// <summary locid="M:J#Type.inheritsFrom" />
    /// <param name="parentType" type="Type"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "parentType", type: Type}
    ]);
    if (e) throw e;
    this.resolveInheritance();
    var baseType = this.__baseType;
    while (baseType) {
        if (baseType === parentType) {
            return true;
        }
        baseType = baseType.__baseType;
    }

    return false;
}

Type.prototype.initializeBase = function Type$initializeBase(instance, baseArguments) {
    /// <summary locid="M:J#Type.initializeBase" />
    /// <param name="instance"></param>
    /// <param name="baseArguments" type="Array" optional="true" mayBeNull="true" elementMayBeNull="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance"},
        {name: "baseArguments", type: Array, mayBeNull: true, optional: true, elementMayBeNull: true}
    ]);
    if (e) throw e;
    if (!Sys._isInstanceOfType(this, instance)) throw Error.argumentType('instance', Object.getType(instance), this);

    this.resolveInheritance();
    if (this.__baseType) {
        if (!baseArguments) {
            this.__baseType.apply(instance);
        }
        else {
            this.__baseType.apply(instance, baseArguments);
        }
    }

    return instance;
}

Type.prototype.isImplementedBy = function Type$isImplementedBy(instance) {
    /// <summary locid="M:J#Type.isImplementedBy" />
    /// <param name="instance" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance", mayBeNull: true}
    ]);
    if (e) throw e;
    if (typeof(instance) === "undefined" || instance === null) return false;

    var instanceType = Object.getType(instance);
    return !!(instanceType.implementsInterface && instanceType.implementsInterface(this));
}

Type.prototype.isInstanceOfType = function Type$isInstanceOfType(instance) {
    /// <summary locid="M:J#Type.isInstanceOfType" />
    /// <param name="instance" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "instance", mayBeNull: true}
    ]);
    if (e) throw e;
    return Sys._isInstanceOfType(this, instance);
}

Type.prototype.registerClass = function Type$registerClass(typeName, baseType, interfaceTypes) {
    /// <summary locid="M:J#Type.registerClass" />
    /// <param name="typeName" type="String"></param>
    /// <param name="baseType" type="Type" optional="true" mayBeNull="true"></param>
    /// <param name="interfaceTypes" parameterArray="true" type="Type"></param>
    /// <returns type="Type"></returns>
    var e = Function._validateParams(arguments, [
        {name: "typeName", type: String},
        {name: "baseType", type: Type, mayBeNull: true, optional: true},
        {name: "interfaceTypes", type: Type, parameterArray: true}
    ]);
    if (e) throw e;
    if (!Type.__fullyQualifiedIdentifierRegExp.test(typeName)) throw Error.argument('typeName', Sys.Res.notATypeName);
        var parsedName;
    try {
        parsedName = window.eval(typeName);
    }
    catch(e) {
        throw Error.argument('typeName', Sys.Res.argumentTypeName);
    }
    if (parsedName !== this) throw Error.argument('typeName', Sys.Res.badTypeName);
        if (Sys.__registeredTypes[typeName]) throw Error.invalidOperation(String.format(Sys.Res.typeRegisteredTwice, typeName));

            if ((arguments.length > 1) && (typeof(baseType) === 'undefined')) throw Error.argumentUndefined('baseType');

    this.prototype.constructor = this;
    this.__typeName = typeName;
    this.__class = true;
    if (baseType) {
        this.__baseType = baseType;
        this.__basePrototypePending = true;
    }
        Sys.__upperCaseTypes[typeName.toUpperCase()] = this;

                if (interfaceTypes) {
        this.__interfaces = [];
        this.resolveInheritance();
        for (var i = 2, l = arguments.length; i < l; i++) {
            var interfaceType = arguments[i];
            if (!interfaceType.__interface) throw Error.argument('interfaceTypes[' + (i - 2) + ']', Sys.Res.notAnInterface);
            for (var methodName in interfaceType.prototype) {
                var method = interfaceType.prototype[methodName];
                if (!this.prototype[methodName]) {
                    this.prototype[methodName] = method;
                }
            }
            this.__interfaces.push(interfaceType);
        }
    }
    Sys.__registeredTypes[typeName] = true;

    return this;
}

Type.prototype.registerInterface = function Type$registerInterface(typeName) {
    /// <summary locid="M:J#Type.registerInterface" />
    /// <param name="typeName" type="String"></param>
    /// <returns type="Type"></returns>
    var e = Function._validateParams(arguments, [
        {name: "typeName", type: String}
    ]);
    if (e) throw e;
    if (!Type.__fullyQualifiedIdentifierRegExp.test(typeName)) throw Error.argument('typeName', Sys.Res.notATypeName);
        var parsedName;
    try {
        parsedName = window.eval(typeName);
    }
    catch(e) {
        throw Error.argument('typeName', Sys.Res.argumentTypeName);
    }
    if (parsedName !== this) throw Error.argument('typeName', Sys.Res.badTypeName);
        if (Sys.__registeredTypes[typeName]) throw Error.invalidOperation(String.format(Sys.Res.typeRegisteredTwice, typeName));
        Sys.__upperCaseTypes[typeName.toUpperCase()] = this;

    this.prototype.constructor = this;
    this.__typeName = typeName;
    this.__interface = true;
    Sys.__registeredTypes[typeName] = true;

    return this;
}

Type.prototype.resolveInheritance = function Type$resolveInheritance() {
    /// <summary locid="M:J#Type.resolveInheritance" />
    if (arguments.length !== 0) throw Error.parameterCount();

    if (this.__basePrototypePending) {
        var baseType = this.__baseType;

        baseType.resolveInheritance();

        for (var memberName in baseType.prototype) {
            var memberValue = baseType.prototype[memberName];
            if (!this.prototype[memberName]) {
                this.prototype[memberName] = memberValue;
            }
        }
        delete this.__basePrototypePending;
    }
}

Type.getRootNamespaces = function Type$getRootNamespaces() {
    /// <summary locid="M:J#Type.getRootNamespaces" />
    /// <returns type="Array"></returns>
    if (arguments.length !== 0) throw Error.parameterCount();
    return Array.clone(Sys.__rootNamespaces);
}

Type.isClass = function Type$isClass(type) {
    /// <summary locid="M:J#Type.isClass" />
    /// <param name="type" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "type", mayBeNull: true}
    ]);
    if (e) throw e;
    if ((typeof(type) === 'undefined') || (type === null)) return false;
    return !!type.__class;
}

Type.isInterface = function Type$isInterface(type) {
    /// <summary locid="M:J#Type.isInterface" />
    /// <param name="type" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "type", mayBeNull: true}
    ]);
    if (e) throw e;
    if ((typeof(type) === 'undefined') || (type === null)) return false;
    return !!type.__interface;
}

Type.isNamespace = function Type$isNamespace(object) {
    /// <summary locid="M:J#Type.isNamespace" />
    /// <param name="object" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "object", mayBeNull: true}
    ]);
    if (e) throw e;
    if ((typeof(object) === 'undefined') || (object === null)) return false;
    return !!object.__namespace;
}

Type.parse = function Type$parse(typeName, ns) {
    /// <summary locid="M:J#Type.parse" />
    /// <param name="typeName" type="String" mayBeNull="true"></param>
    /// <param name="ns" optional="true" mayBeNull="true"></param>
    /// <returns type="Type" mayBeNull="true"></returns>
    var e = Function._validateParams(arguments, [
        {name: "typeName", type: String, mayBeNull: true},
        {name: "ns", mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    var fn;
    if (ns) {
        fn = Sys.__upperCaseTypes[ns.getName().toUpperCase() + '.' + typeName.toUpperCase()];
        return fn || null;
    }
    if (!typeName) return null;
    if (!Type.__htClasses) {
        Type.__htClasses = {};
    }
    fn = Type.__htClasses[typeName];
    if (!fn) {
        fn = window.eval(typeName);
        if (typeof(fn) !== 'function') throw Error.argument('typeName', Sys.Res.notATypeName);
        Type.__htClasses[typeName] = fn;
    }
    return fn;
}

Type.registerNamespace = function Type$registerNamespace(namespacePath) {
    /// <summary locid="M:J#Type.registerNamespace" />
    /// <param name="namespacePath" type="String"></param>
    var e = Function._validateParams(arguments, [
        {name: "namespacePath", type: String}
    ]);
    if (e) throw e;
            Type._registerNamespace(namespacePath);
}
Type._registerNamespace = function Type$_registerNamespace(namespacePath) {
    if (!Type.__fullyQualifiedIdentifierRegExp.test(namespacePath)) throw Error.argument('namespacePath', Sys.Res.invalidNameSpace);
    var rootObject = window;
    var namespaceParts = namespacePath.split('.');

    for (var i = 0, l = namespaceParts.length; i < l; i++) {
        var currentPart = namespaceParts[i];
        var ns = rootObject[currentPart];
        var nsType = typeof(ns);
        if ((nsType !== "undefined") && (ns !== null)) {
            if (nsType === "function") {
                throw Error.invalidOperation(String.format(Sys.Res.namespaceContainsClass, namespaceParts.splice(0, i + 1).join('.')));
            }
            if ((typeof(ns) !== "object") || (ns instanceof Array)) {
                throw Error.invalidOperation(String.format(Sys.Res.namespaceContainsNonObject, namespaceParts.splice(0, i + 1).join('.')));
            }
        }
        if (!ns) {
            ns = rootObject[currentPart] = {};
        }
        if (!ns.__namespace) {
            if (!i && (namespacePath !== "Sys")) {
                Sys.__rootNamespaces.push(ns);
            }
            ns.__namespace = true;
            ns.__typeName = namespaceParts.slice(0, i + 1).join('.');
            var parsedName;
            try {
                parsedName = window.eval(ns.__typeName);
            }
            catch(e) {
                parsedName = null;
            }
            if (parsedName !== ns) {
                delete rootObject[currentPart];
                throw Error.argument('namespacePath', Sys.Res.invalidNameSpace);
            }
            ns.getName = function ns$getName() {return this.__typeName;}
        }
        rootObject = ns;
    }
}

Type._checkDependency = function Type$_checkDependency(dependency, featureName) {
    var scripts = Type._registerScript._scripts, isDependent = (scripts ? (!!scripts[dependency]) : false);
    if ((typeof(featureName) !== 'undefined') && !isDependent) {
        throw Error.invalidOperation(String.format(Sys.Res.requiredScriptReferenceNotIncluded, 
        featureName, dependency));
    }
    return isDependent;
}

Type._registerScript = function Type$_registerScript(scriptName, dependencies) {
    var scripts = Type._registerScript._scripts;
    if (!scripts) {
        Type._registerScript._scripts = scripts = {};
    }
    if (scripts[scriptName]) {
        throw Error.invalidOperation(String.format(Sys.Res.scriptAlreadyLoaded, scriptName));
    }
    scripts[scriptName] = true;
    if (dependencies) {
        for (var i = 0, l = dependencies.length; i < l; i++) {
            var dependency = dependencies[i];
            if (!Type._checkDependency(dependency)) {
                throw Error.invalidOperation(String.format(Sys.Res.scriptDependencyNotFound, scriptName, dependency));
            }
        }
    }
}

Type._registerNamespace("Sys");
Sys.__upperCaseTypes = {};
Sys.__rootNamespaces = [Sys];
Sys.__registeredTypes = {};

foreach(Sys._ns, Type._registerNamespace);
delete Sys._ns;

 
Array.__typeName = 'Array';
Array.__class = true;

Array.add = Array.enqueue = function Array$enqueue(array, item) {
    /// <summary locid="M:J#Array.enqueue" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="item" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "item", mayBeNull: true}
    ]);
    if (e) throw e;

        array[array.length] = item;
}

Array.addRange = function Array$addRange(array, items) {
    /// <summary locid="M:J#Array.addRange" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="items" type="Array" elementMayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "items", type: Array, elementMayBeNull: true}
    ]);
    if (e) throw e;

        array.push.apply(array, items);
}

Array.clear = function Array$clear(array) {
    /// <summary locid="M:J#Array.clear" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true}
    ]);
    if (e) throw e;
    array.length = 0;
}

Array.clone = function Array$clone(array) {
    /// <summary locid="M:J#Array.clone" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <returns type="Array" elementMayBeNull="true"></returns>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true}
    ]);
    if (e) throw e;
    if (array.length === 1) {
        return [array[0]];
    }
    else {
                        return Array.apply(null, array);
    }
}

Array.contains = function Array$contains(array, item) {
    /// <summary locid="M:J#Array.contains" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="item" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "item", mayBeNull: true}
    ]);
    if (e) throw e;
    return (indexOf(array, item) >= 0);
}

Array.dequeue = function Array$dequeue(array) {
    /// <summary locid="M:J#Array.dequeue" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <returns mayBeNull="true"></returns>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true}
    ]);
    if (e) throw e;
    return array.shift();
}

Array.forEach = function Array$forEach(array, method, instance) {
    /// <summary locid="M:J#Array.forEach" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="method" type="Function"></param>
    /// <param name="instance" optional="true" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "method", type: Function},
        {name: "instance", mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    for (var i = 0, l = array.length; i < l; i++) {
        var elt = array[i];
        if (typeof(elt) !== 'undefined') method.call(instance, elt, i, array);
    }
}

Array.indexOf = function Array$indexOf(array, item, start) {
    /// <summary locid="M:J#Array.indexOf" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="item" optional="true" mayBeNull="true"></param>
    /// <param name="start" optional="true" mayBeNull="true"></param>
    /// <returns type="Number"></returns>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "item", mayBeNull: true, optional: true},
        {name: "start", mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    return indexOf(array, item, start);
}

Array.insert = function Array$insert(array, index, item) {
    /// <summary locid="M:J#Array.insert" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="index" mayBeNull="true"></param>
    /// <param name="item" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "index", mayBeNull: true},
        {name: "item", mayBeNull: true}
    ]);
    if (e) throw e;
    array.splice(index, 0, item);
}

Array.parse = function Array$parse(value) {
    /// <summary locid="M:J#Array.parse" />
    /// <param name="value" type="String" mayBeNull="true"></param>
    /// <returns type="Array" elementMayBeNull="true"></returns>
    var e = Function._validateParams(arguments, [
        {name: "value", type: String, mayBeNull: true}
    ]);
    if (e) throw e;
    if (!value) return [];
    var v = window.eval("(" + value + ")");
    if (!Array.isInstanceOfType(v)) throw Error.argument('value', Sys.Res.arrayParseBadFormat);
    return v;
}

Array.remove = function Array$remove(array, item) {
    /// <summary locid="M:J#Array.remove" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="item" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "item", mayBeNull: true}
    ]);
    if (e) throw e;
    var index = indexOf(array, item);
    if (index >= 0) {
        array.splice(index, 1);
    }
    return (index >= 0);
}

Array.removeAt = function Array$removeAt(array, index) {
    /// <summary locid="M:J#Array.removeAt" />
    /// <param name="array" type="Array" elementMayBeNull="true"></param>
    /// <param name="index" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "array", type: Array, elementMayBeNull: true},
        {name: "index", mayBeNull: true}
    ]);
    if (e) throw e;
    array.splice(index, 1);
}

var indexOf = Sys._indexOf = function Sys$_indexOf(array, item, start) {
    if (typeof(item) === "undefined") return -1;
    var length = array.length;
    if (length !== 0) {
                start = start - 0;
                if (isNaN(start)) {
            start = 0;
        }
        else {
                                    if (isFinite(start)) {
                                start = start - (start % 1);
            }
                        if (start < 0) {
                start = Math.max(0, length + start);
            }
        }

                for (var i = start; i < length; i++) {
            if ((typeof(array[i]) !== "undefined") && (array[i] === item)) {
                return i;
            }
        }
    }
    return -1;
}

Type._registerScript("MicrosoftAjaxCore.js");

 
Sys.IDisposable = function Sys$IDisposable() {
    throw Error.notImplemented();
}

    function Sys$IDisposable$dispose() {
        throw Error.notImplemented();
    }
Sys.IDisposable.prototype = {
    dispose: Sys$IDisposable$dispose
}
Sys.IDisposable.registerInterface('Sys.IDisposable');
 
Sys.StringBuilder = function Sys$StringBuilder(initialText) {
    /// <summary locid="M:J#Sys.StringBuilder.#ctor" />
    /// <param name="initialText" optional="true" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "initialText", mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    this._parts = (typeof(initialText) !== 'undefined' && initialText !== null && initialText !== '') ?
        [initialText.toString()] : [];
    this._value = {};
    this._len = 0;
}


    function Sys$StringBuilder$append(text) {
        /// <summary locid="M:J#Sys.StringBuilder.append" />
        /// <param name="text" mayBeNull="true"></param>
        /// <returns type="Sys.StringBuilder"></returns>
        var e = Function._validateParams(arguments, [
            {name: "text", mayBeNull: true}
        ]);
        if (e) throw e;
        this._parts.push(text);
        return this;
    }

    function Sys$StringBuilder$appendLine(text) {
        /// <summary locid="M:J#Sys.StringBuilder.appendLine" />
        /// <param name="text" optional="true" mayBeNull="true"></param>
        /// <returns type="Sys.StringBuilder"></returns>
        var e = Function._validateParams(arguments, [
            {name: "text", mayBeNull: true, optional: true}
        ]);
        if (e) throw e;
        this._parts.push(
            ((typeof(text) === 'undefined') || (text === null) || (text === '')) ?
            '\r\n' : (text + '\r\n'));
        return this;
    }

    function Sys$StringBuilder$clear() {
        /// <summary locid="M:J#Sys.StringBuilder.clear" />
        if (arguments.length !== 0) throw Error.parameterCount();
        this._parts = [];
        this._value = {};
        this._len = 0;
    }

    function Sys$StringBuilder$isEmpty() {
        /// <summary locid="M:J#Sys.StringBuilder.isEmpty" />
        /// <returns type="Boolean"></returns>
        if (arguments.length !== 0) throw Error.parameterCount();
        if (this._parts.length === 0) return true;
        return this.toString() === '';
    }



    function Sys$StringBuilder$toString(separator) {
        /// <summary locid="M:J#Sys.StringBuilder.toString" />
        /// <param name="separator" type="String" optional="true" mayBeNull="true"></param>
        /// <returns type="String"></returns>
        var e = Function._validateParams(arguments, [
            {name: "separator", type: String, mayBeNull: true, optional: true}
        ]);
        if (e) throw e;
        separator = separator || '';
        var parts = this._parts;
        if (this._len !== parts.length) {
            this._value = {};
            this._len = parts.length;
        }
        var val = this._value;
        if (typeof(val[separator]) === 'undefined') {
                        if (separator !== '') {
                for (var i = 0; i < parts.length;) {
                    if ((typeof(parts[i]) === 'undefined') || (parts[i] === '') || (parts[i] === null)) {
                        parts.splice(i, 1);
                    }
                    else {
                        i++;
                    }
                }
            }
            val[separator] = this._parts.join(separator);
        }
        return val[separator];
    }
Sys.StringBuilder.prototype = {
    append: Sys$StringBuilder$append,
    appendLine: Sys$StringBuilder$appendLine,
    clear: Sys$StringBuilder$clear,
    isEmpty: Sys$StringBuilder$isEmpty,
            toString: Sys$StringBuilder$toString
}
Sys.StringBuilder.registerClass('Sys.StringBuilder');


var agent = navigator.userAgent,
    browser = Sys.Browser = {
        InternetExplorer: {},
        Firefox: {},
        Safari: {},
        Opera: {},
        agent: null,
        hasDebuggerStatement: false,
        name: navigator.appName,
        version: parseFloat(navigator.appVersion),
        documentMode: 0 };

if (agent.indexOf(' MSIE ') > -1) {
    browser.agent = browser.InternetExplorer;
    browser.version = parseFloat(agent.match(/MSIE (\d+\.\d+)/)[1]);
    if ((browser.version > 7) && (document.documentMode > 6)) {
        browser.documentMode = document.documentMode;    
    }
    browser.hasDebuggerStatement = true;
}
else if (agent.indexOf(' Firefox/') > -1) {
    browser.agent = browser.Firefox;
    browser.version = parseFloat(agent.match(/ Firefox\/(\d+\.\d+)/)[1]);
    browser.name = 'Firefox';
    browser.hasDebuggerStatement = true;
}
else if (agent.indexOf(' AppleWebKit/') > -1) {
    browser.agent = browser.Safari;
    browser.version = parseFloat(agent.match(/ AppleWebKit\/(\d+(\.\d+)?)/)[1]);
    browser.name = 'Safari';
}
else if (agent.indexOf('Opera/') > -1) {
    browser.agent = browser.Opera;
}


var isBrowser = Sys._isBrowser;


 
Sys.EventArgs = function Sys$EventArgs() {
    /// <summary locid="M:J#Sys.EventArgs.#ctor" />
    if (arguments.length !== 0) throw Error.parameterCount();
}
Sys.EventArgs.registerClass('Sys.EventArgs');

Sys.EventArgs.Empty = new Sys.EventArgs();
 
Sys.CancelEventArgs = function Sys$CancelEventArgs() {
    /// <summary locid="M:J#Sys.CancelEventArgs.#ctor" />
    if (arguments.length !== 0) throw Error.parameterCount();
    Sys.CancelEventArgs.initializeBase(this);

    this._cancel = false;
}


    function Sys$CancelEventArgs$get_cancel() {
        /// <value type="Boolean" locid="P:J#Sys.CancelEventArgs.cancel"></value>
        if (arguments.length !== 0) throw Error.parameterCount();
        return this._cancel;
    }
    function Sys$CancelEventArgs$set_cancel(value) {
        var e = Function._validateParams(arguments, [{name: "value", type: Boolean}]);
        if (e) throw e;
        this._cancel = value;
    }
Sys.CancelEventArgs.prototype = {
    get_cancel: Sys$CancelEventArgs$get_cancel,
    set_cancel: Sys$CancelEventArgs$set_cancel
}

Sys.CancelEventArgs.registerClass('Sys.CancelEventArgs', Sys.EventArgs);
 
Sys.EventHandlerList = function Sys$EventHandlerList() {
    /// <summary locid="M:J#Sys.EventHandlerList.#ctor" />
    if (arguments.length !== 0) throw Error.parameterCount();
    this._list = {};
}


    function Sys$EventHandlerList$_addHandler(id, handler) {
        Array.add(this._getEvent(id, true), handler);
    }
    function Sys$EventHandlerList$addHandler(id, handler) {
        /// <summary locid="M:J#Sys.EventHandlerList.addHandler" />
        /// <param name="id" type="String"></param>
        /// <param name="handler" type="Function"></param>
        var e = Function._validateParams(arguments, [
            {name: "id", type: String},
            {name: "handler", type: Function}
        ]);
        if (e) throw e;
        this._addHandler(id, handler);
    }
    function Sys$EventHandlerList$_removeHandler(id, handler) {
        var evt = this._getEvent(id);
        if (!evt) return;
        Array.remove(evt, handler);
    }
    function Sys$EventHandlerList$_removeHandlers(id) {
        if (!id) {
            this._list = {};
        }
        else {
            var evt = this._getEvent(id);
            if (!evt) return;
            evt.length = 0;
        }
    }
    function Sys$EventHandlerList$removeHandler(id, handler) {
        /// <summary locid="M:J#Sys.EventHandlerList.removeHandler" />
        /// <param name="id" type="String"></param>
        /// <param name="handler" type="Function"></param>
        var e = Function._validateParams(arguments, [
            {name: "id", type: String},
            {name: "handler", type: Function}
        ]);
        if (e) throw e;
        this._removeHandler(id, handler);
    }
    function Sys$EventHandlerList$getHandler(id) {
        /// <summary locid="M:J#Sys.EventHandlerList.getHandler" />
        /// <param name="id" type="String"></param>
        /// <returns type="Function"></returns>
        var e = Function._validateParams(arguments, [
            {name: "id", type: String}
        ]);
        if (e) throw e;
        var evt = this._getEvent(id);
        if (!evt || (evt.length === 0)) return null;
        evt = Array.clone(evt);
        return function(source, args) {
            for (var i = 0, l = evt.length; i < l; i++) {
                evt[i](source, args);
            }
        };
    }
    function Sys$EventHandlerList$_getEvent(id, create) {
        if (!this._list[id]) {
            if (!create) return null;
            this._list[id] = [];
        }
        return this._list[id];
    }
Sys.EventHandlerList.prototype = {
    _addHandler: Sys$EventHandlerList$_addHandler,
    addHandler: Sys$EventHandlerList$addHandler,
    _removeHandler: Sys$EventHandlerList$_removeHandler,
    _removeHandlers: Sys$EventHandlerList$_removeHandlers,
    removeHandler: Sys$EventHandlerList$removeHandler,
    getHandler: Sys$EventHandlerList$getHandler,
    _getEvent: Sys$EventHandlerList$_getEvent
}
Sys.EventHandlerList.registerClass('Sys.EventHandlerList');

Type.registerNamespace('Sys.UI');

 
Sys._Debug = function Sys$_Debug() {
    /// <summary locid="M:J#Sys.Debug.#ctor" />
    /// <field name="isDebug" type="Boolean" locid="F:J#Sys.Debug.isDebug"></field>
    if (arguments.length !== 0) throw Error.parameterCount();
}


    function Sys$_Debug$_appendConsole(text) {
                if ((typeof(Debug) !== 'undefined') && Debug.writeln) {
            Debug.writeln(text);
        }
                if (window.console && window.console.log) {
            window.console.log(text);
        }
                if (window.opera) {
            window.opera.postError(text);
        }
                if (window.debugService) {
            window.debugService.trace(text);
        }
    }

    function Sys$_Debug$_appendTrace(text) {
        var traceElement = Sys.get('#TraceConsole');
        if (traceElement && (traceElement.tagName.toUpperCase() === 'TEXTAREA')) {
            traceElement.value += text + '\n';
        }
    }

    function Sys$_Debug$assert(condition, message, displayCaller) {
        /// <summary locid="M:J#Sys.Debug.assert" />
        /// <param name="condition" type="Boolean"></param>
        /// <param name="message" type="String" optional="true" mayBeNull="true"></param>
        /// <param name="displayCaller" type="Boolean" optional="true"></param>
        var e = Function._validateParams(arguments, [
            {name: "condition", type: Boolean},
            {name: "message", type: String, mayBeNull: true, optional: true},
            {name: "displayCaller", type: Boolean, optional: true}
        ]);
        if (e) throw e;
        if (!condition) {
            message = (displayCaller && this.assert.caller) ?
                String.format(Sys.Res.assertFailedCaller, message, this.assert.caller) :
                String.format(Sys.Res.assertFailed, message);

            if (confirm(String.format(Sys.Res.breakIntoDebugger, message))) {
                this.fail(message);
            }
        }
    }

    function Sys$_Debug$clearTrace() {
        /// <summary locid="M:J#Sys.Debug.clearTrace" />
        if (arguments.length !== 0) throw Error.parameterCount();
        var traceElement = Sys.get('#TraceConsole');
        if (traceElement && (traceElement.tagName.toUpperCase() === 'TEXTAREA')) {
            traceElement.value = '';
        }
    }

    function Sys$_Debug$fail(message) {
        /// <summary locid="M:J#Sys.Debug.fail" />
        /// <param name="message" type="String" mayBeNull="true"></param>
        var e = Function._validateParams(arguments, [
            {name: "message", type: String, mayBeNull: true}
        ]);
        if (e) throw e;
        this._appendConsole(message);

                if (Sys.Browser.hasDebuggerStatement) {
            window.eval('debugger');
        }
    }

    function Sys$_Debug$trace(text) {
        /// <summary locid="M:J#Sys.Debug.trace" />
        /// <param name="text"></param>
        var e = Function._validateParams(arguments, [
            {name: "text"}
        ]);
        if (e) throw e;
        this._appendConsole(text);
        this._appendTrace(text);
    }

    function Sys$_Debug$traceDump(object, name) {
        /// <summary locid="M:J#Sys.Debug.traceDump" />
        /// <param name="object" mayBeNull="true"></param>
        /// <param name="name" type="String" mayBeNull="true" optional="true"></param>
        var e = Function._validateParams(arguments, [
            {name: "object", mayBeNull: true},
            {name: "name", type: String, mayBeNull: true, optional: true}
        ]);
        if (e) throw e;
        var text = this._traceDump(object, name, true);
    }

    function Sys$_Debug$_traceDump(object, name, recursive, indentationPadding, loopArray) {
        name = name? name : 'traceDump';
        indentationPadding = indentationPadding? indentationPadding : '';
        if (object === null) {
            this.trace(indentationPadding + name + ': null');
            return;
        }
        switch(typeof(object)) {
            case 'undefined':
                this.trace(indentationPadding + name + ': Undefined');
                break;
            case 'number': case 'string': case 'boolean':
                this.trace(indentationPadding + name + ': ' + object);
                break;
            default:
                if (Date.isInstanceOfType(object) || RegExp.isInstanceOfType(object)) {
                    this.trace(indentationPadding + name + ': ' + object.toString());
                    break;
                }
                if (!loopArray) {
                    loopArray = [];
                }
                else if (Array.contains(loopArray, object)) {
                    this.trace(indentationPadding + name + ': ...');
                    return;
                }
                Array.add(loopArray, object);

                                                                if ((object == window) || (object === document) ||
                    (window.HTMLElement && (object instanceof HTMLElement)) ||
                    (typeof(object.nodeName) === 'string')) {
                    var tag = object.tagName? object.tagName : 'DomElement';
                    if (object.id) {
                        tag += ' - ' + object.id;
                    }
                    this.trace(indentationPadding + name + ' {' +  tag + '}');
                }
                                else {
                    var typeName = Object.getTypeName(object);
                    this.trace(indentationPadding + name + (typeof(typeName) === 'string' ? ' {' + typeName + '}' : ''));
                    if ((indentationPadding === '') || recursive) {
                        indentationPadding += "    ";
                        var i, length, properties, p, v;
                        if (Array.isInstanceOfType(object)) {
                            length = object.length;
                            for (i = 0; i < length; i++) {
                                this._traceDump(object[i], '[' + i + ']', recursive, indentationPadding, loopArray);
                            }
                        }
                        else {
                            for (p in object) {
                                v = object[p];
                                if (!Function.isInstanceOfType(v)) {
                                    this._traceDump(v, p, recursive, indentationPadding, loopArray);
                                }
                            }
                        }
                    }
                }
                Array.remove(loopArray, object);
        }
    }
Sys._Debug.prototype = {
    _appendConsole: Sys$_Debug$_appendConsole,
    _appendTrace: Sys$_Debug$_appendTrace,
    assert: Sys$_Debug$assert,
    clearTrace: Sys$_Debug$clearTrace,
    fail: Sys$_Debug$fail,
    trace: Sys$_Debug$trace,
    traceDump: Sys$_Debug$traceDump,
    _traceDump: Sys$_Debug$_traceDump
}
Sys._Debug.registerClass('Sys._Debug');

Sys.Debug = new Sys._Debug();
    Sys.Debug.isDebug = true;
 
function Sys$Enum$parse(value, ignoreCase) {
    /// <summary locid="M:J#Sys.Enum.parse" />
    /// <param name="value" type="String"></param>
    /// <param name="ignoreCase" type="Boolean" optional="true"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "value", type: String},
        {name: "ignoreCase", type: Boolean, optional: true}
    ]);
    if (e) throw e;
    var values, parsed, val;
    if (ignoreCase) {
        values = this.__lowerCaseValues;
        if (!values) {
            this.__lowerCaseValues = values = {};
            var prototype = this.prototype;
            for (var name in prototype) {
                values[name.toLowerCase()] = prototype[name];
            }
        }
    }
    else {
        values = this.prototype;
    }
    if (!this.__flags) {
        val = (ignoreCase ? value.toLowerCase() : value);
        parsed = values[val.trim()];
        if (typeof(parsed) !== 'number') throw Error.argument('value', String.format(Sys.Res.enumInvalidValue, value, this.__typeName));
        return parsed;
    }
    else {
        var parts = (ignoreCase ? value.toLowerCase() : value).split(',');
        var v = 0;

        for (var i = parts.length - 1; i >= 0; i--) {
            var part = parts[i].trim();
            parsed = values[part];
            if (typeof(parsed) !== 'number') throw Error.argument('value', String.format(Sys.Res.enumInvalidValue, value.split(',')[i].trim(), this.__typeName));
            v |= parsed;
        }
        return v;
    }
}

function Sys$Enum$toString(value) {
    /// <summary locid="M:J#Sys.Enum.toString" />
    /// <param name="value" optional="true" mayBeNull="true"></param>
    /// <returns type="String"></returns>
    var e = Function._validateParams(arguments, [
        {name: "value", mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
            if ((typeof(value) === 'undefined') || (value === null)) return this.__string;
    if ((typeof(value) != 'number') || ((value % 1) !== 0)) throw Error.argumentType('value', Object.getType(value), this);
    var values = this.prototype;
    var i;
    if (!this.__flags || (value === 0)) {
        for (i in values) {
            if (values[i] === value) {
                return i;
            }
        }
    }
    else {
        var sorted = this.__sortedValues;
        if (!sorted) {
            sorted = [];
            for (i in values) {
                sorted[sorted.length] = {key: i, value: values[i]};
            }
            sorted.sort(function(a, b) {
                return a.value - b.value;
            });
            this.__sortedValues = sorted;
        }
        var parts = [];
        var v = value;
        for (i = sorted.length - 1; i >= 0; i--) {
            var kvp = sorted[i];
            var vali = kvp.value;
            if (vali === 0) continue;
            if ((vali & value) === vali) {
                parts[parts.length] = kvp.key;
                v -= vali;
                if (v === 0) break;
            }
        }
        if (parts.length && v === 0) return parts.reverse().join(', ');
    }
    throw Error.argumentOutOfRange('value', value, String.format(Sys.Res.enumInvalidValue, value, this.__typeName));
}

Type.prototype.registerEnum = function Type$registerEnum(name, flags) {
    /// <summary locid="M:J#Sys.UI.LineType.#ctor" />
    /// <param name="name" type="String"></param>
    /// <param name="flags" type="Boolean" optional="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "name", type: String},
        {name: "flags", type: Boolean, optional: true}
    ]);
    if (e) throw e;
    if (!Type.__fullyQualifiedIdentifierRegExp.test(name)) throw Error.argument('name', Sys.Res.notATypeName);
        var parsedName;
    try {
        parsedName = window.eval(name);
    }
    catch(e) {
        throw Error.argument('name', Sys.Res.argumentTypeName);
    }
    if (parsedName !== this) throw Error.argument('name', Sys.Res.badTypeName);
    if (Sys.__registeredTypes[name]) throw Error.invalidOperation(String.format(Sys.Res.typeRegisteredTwice, name));
    for (var j in this.prototype) {
        var val = this.prototype[j];
        if (!Type.__identifierRegExp.test(j)) throw Error.invalidOperation(String.format(Sys.Res.enumInvalidValueName, j));
        if (typeof(val) !== 'number' || (val % 1) !== 0) throw Error.invalidOperation(Sys.Res.enumValueNotInteger);
        if (typeof(this[j]) !== 'undefined') throw Error.invalidOperation(String.format(Sys.Res.enumReservedName, j));
    }
    Sys.__upperCaseTypes[name.toUpperCase()] = this;

    for (var i in this.prototype) {
        this[i] = this.prototype[i];
    }
    this.__typeName = name;
    this.parse = Sys$Enum$parse;
    this.__string = this.toString();
    this.toString = Sys$Enum$toString;
    this.__flags = flags;
    this.__enum = true;
    Sys.__registeredTypes[name] = true;
}

Type.isEnum = function Type$isEnum(type) {
    /// <summary locid="M:J#Type.isEnum" />
    /// <param name="type" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "type", mayBeNull: true}
    ]);
    if (e) throw e;
    if ((typeof(type) === 'undefined') || (type === null)) return false;
    return !!type.__enum;
}

Type.isFlags = function Type$isFlags(type) {
    /// <summary locid="M:J#Type.isFlags" />
    /// <param name="type" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "type", mayBeNull: true}
    ]);
    if (e) throw e;
    if ((typeof(type) === 'undefined') || (type === null)) return false;
    return !!type.__flags;
}

Sys.CollectionChange = function Sys$CollectionChange(action, newItems, newStartingIndex, oldItems, oldStartingIndex) {
    /// <summary locid="M:J#Sys.CollectionChange.#ctor" />
    /// <param name="action" type="Sys.NotifyCollectionChangedAction"></param>
    /// <param name="newItems" optional="true" mayBeNull="true"></param>
    /// <param name="newStartingIndex" type="Number" integer="true" optional="true" mayBeNull="true"></param>
    /// <param name="oldItems" optional="true" mayBeNull="true"></param>
    /// <param name="oldStartingIndex" type="Number" integer="true" optional="true" mayBeNull="true"></param>
    /// <field name="action" type="Sys.NotifyCollectionChangedAction" locid="F:J#Sys.CollectionChange.action"></field>
    /// <field name="newItems" type="Array" mayBeNull="true" elementMayBeNull="true" locid="F:J#Sys.CollectionChange.newItems"></field>
    /// <field name="newStartingIndex" type="Number" integer="true" locid="F:J#Sys.CollectionChange.newStartingIndex"></field>
    /// <field name="oldItems" type="Array" mayBeNull="true" elementMayBeNull="true" locid="F:J#Sys.CollectionChange.oldItems"></field>
    /// <field name="oldStartingIndex" type="Number" integer="true" locid="F:J#Sys.CollectionChange.oldStartingIndex"></field>
    var e = Function._validateParams(arguments, [
        {name: "action", type: Sys.NotifyCollectionChangedAction},
        {name: "newItems", mayBeNull: true, optional: true},
        {name: "newStartingIndex", type: Number, mayBeNull: true, integer: true, optional: true},
        {name: "oldItems", mayBeNull: true, optional: true},
        {name: "oldStartingIndex", type: Number, mayBeNull: true, integer: true, optional: true}
    ]);
    if (e) throw e;
    this.action = action;
    if (newItems) {
        if (!(newItems instanceof Array)) {
            newItems = [newItems];
        }
    }
    this.newItems = newItems || null;
    if (typeof newStartingIndex !== "number") {
        newStartingIndex = -1;
    }
    this.newStartingIndex = newStartingIndex;
    if (oldItems) {
        if (!(oldItems instanceof Array)) {
            oldItems = [oldItems];
        }
    }
    this.oldItems = oldItems || null;
    if (typeof oldStartingIndex !== "number") {
        oldStartingIndex = -1;
    }
    this.oldStartingIndex = oldStartingIndex;
}
Sys.CollectionChange.registerClass("Sys.CollectionChange");
Sys.NotifyCollectionChangedAction = function Sys$NotifyCollectionChangedAction() {
    /// <summary locid="M:J#Sys.NotifyCollectionChangedAction.#ctor" />
    /// <field name="add" type="Number" integer="true" static="true" locid="F:J#Sys.NotifyCollectionChangedAction.add"></field>
    /// <field name="remove" type="Number" integer="true" static="true" locid="F:J#Sys.NotifyCollectionChangedAction.remove"></field>
    /// <field name="reset" type="Number" integer="true" static="true" locid="F:J#Sys.NotifyCollectionChangedAction.reset"></field>
    if (arguments.length !== 0) throw Error.parameterCount();
    throw Error.notImplemented();
}




Sys.NotifyCollectionChangedAction.prototype = {
    add: 0,
    remove: 1,
    reset: 2
}
Sys.NotifyCollectionChangedAction.registerEnum('Sys.NotifyCollectionChangedAction');
Sys.NotifyCollectionChangedEventArgs = function Sys$NotifyCollectionChangedEventArgs(changes) {
    /// <summary locid="M:J#Sys.NotifyCollectionChangedEventArgs.#ctor" />
    /// <param name="changes" type="Array" elementType="Sys.CollectionChange"></param>
    var e = Function._validateParams(arguments, [
        {name: "changes", type: Array, elementType: Sys.CollectionChange}
    ]);
    if (e) throw e;
    this._changes = changes;
    Sys.NotifyCollectionChangedEventArgs.initializeBase(this);
}

    function Sys$NotifyCollectionChangedEventArgs$get_changes() {
        /// <value type="Array" elementType="Sys.CollectionChange" locid="P:J#Sys.NotifyCollectionChangedEventArgs.changes"></value>
        if (arguments.length !== 0) throw Error.parameterCount();
        return this._changes || [];
    }
Sys.NotifyCollectionChangedEventArgs.prototype = {
    get_changes: Sys$NotifyCollectionChangedEventArgs$get_changes
}
Sys.NotifyCollectionChangedEventArgs.registerClass("Sys.NotifyCollectionChangedEventArgs", Sys.EventArgs);

 
Sys.INotifyPropertyChange = function Sys$INotifyPropertyChange() {
    /// <summary locid="M:J#Sys.INotifyPropertyChange.#ctor" />
    if (arguments.length !== 0) throw Error.parameterCount();
    throw Error.notImplemented();
}

    function Sys$INotifyPropertyChange$add_propertyChanged(handler) {
    /// <summary locid="E:J#Sys.INotifyPropertyChange.propertyChanged" />
    var e = Function._validateParams(arguments, [{name: "handler", type: Function}]);
    if (e) throw e;
        throw Error.notImplemented();
    }
    function Sys$INotifyPropertyChange$remove_propertyChanged(handler) {
    var e = Function._validateParams(arguments, [{name: "handler", type: Function}]);
    if (e) throw e;
        throw Error.notImplemented();
    }
Sys.INotifyPropertyChange.prototype = {
    add_propertyChanged: Sys$INotifyPropertyChange$add_propertyChanged,
    remove_propertyChanged: Sys$INotifyPropertyChange$remove_propertyChanged
}
Sys.INotifyPropertyChange.registerInterface('Sys.INotifyPropertyChange');
 
Sys.PropertyChangedEventArgs = function Sys$PropertyChangedEventArgs(propertyName) {
    /// <summary locid="M:J#Sys.PropertyChangedEventArgs.#ctor" />
    /// <param name="propertyName" type="String"></param>
    var e = Function._validateParams(arguments, [
        {name: "propertyName", type: String}
    ]);
    if (e) throw e;
    Sys.PropertyChangedEventArgs.initializeBase(this);
    this._propertyName = propertyName;
}
 
    function Sys$PropertyChangedEventArgs$get_propertyName() {
        /// <value type="String" locid="P:J#Sys.PropertyChangedEventArgs.propertyName"></value>
        if (arguments.length !== 0) throw Error.parameterCount();
        return this._propertyName;
    }
Sys.PropertyChangedEventArgs.prototype = {
    get_propertyName: Sys$PropertyChangedEventArgs$get_propertyName
}
Sys.PropertyChangedEventArgs.registerClass('Sys.PropertyChangedEventArgs', Sys.EventArgs);
Sys.Observer = function Sys$Observer() {
    throw Error.invalidOperation();
}
Sys.Observer.registerClass("Sys.Observer");

Sys.Observer.makeObservable = function Sys$Observer$makeObservable(target) {
    /// <summary locid="M:J#Sys.Observer.makeObservable" />
    /// <param name="target" mayBeNull="false"></param>
    /// <returns></returns>
    var e = Function._validateParams(arguments, [
        {name: "target"}
    ]);
    if (e) throw e;
    var isArray = target instanceof Array,
        o = Sys.Observer;
    Sys.Observer._ensureObservable(target);
    if (target.setValue === o._observeMethods.setValue) return target;
    o._addMethods(target, o._observeMethods);
    if (isArray) {
        o._addMethods(target, o._arrayMethods);
    }
    return target;
}
Sys.Observer._ensureObservable = function Sys$Observer$_ensureObservable(target) {
    var type = typeof target;
    if ((type === "string") || (type === "number") || (type === "boolean") || (type === "date")) {
        throw Error.invalidOperation(String.format(Sys.Res.notObservable, type));
    }
}
Sys.Observer._addMethods = function Sys$Observer$_addMethods(target, methods) {
    for (var m in methods) {
        if (target[m] && (target[m] !== methods[m])) {
            throw Error.invalidOperation(String.format(Sys.Res.observableConflict, m));
        }
        target[m] = methods[m];
    }
}
Sys.Observer._addEventHandler = function Sys$Observer$_addEventHandler(target, eventName, handler) {
    Sys.Observer._getContext(target, true).events._addHandler(eventName, handler);
}
Sys.Observer.addEventHandler = function Sys$Observer$addEventHandler(target, eventName, handler) {
    /// <summary locid="M:J#Sys.Observer.addEventHandler" />
    /// <param name="target"></param>
    /// <param name="eventName" type="String"></param>
    /// <param name="handler" type="Function"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"},
        {name: "eventName", type: String},
        {name: "handler", type: Function}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    Sys.Observer._addEventHandler(target, eventName, handler);
}
Sys.Observer._removeEventHandler = function Sys$Observer$_removeEventHandler(target, eventName, handler) {
    Sys.Observer._getContext(target, true).events._removeHandler(eventName, handler);
}
Sys.Observer.removeEventHandler = function Sys$Observer$removeEventHandler(target, eventName, handler) {
    /// <summary locid="M:J#Sys.Observer.removeEventHandler" />
    /// <param name="target"></param>
    /// <param name="eventName" type="String"></param>
    /// <param name="handler" type="Function"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"},
        {name: "eventName", type: String},
        {name: "handler", type: Function}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    Sys.Observer._removeEventHandler(target, eventName, handler);
}
Sys.Observer.clearEventHandlers = function Sys$Observer$clearEventHandlers(target, eventName) {
    /// <summary locid="M:J#Sys.Observer.clearEventHandlers" />
    /// <param name="target"></param>
    /// <param name="eventName" type="String" mayBeNull="true" optional="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"},
        {name: "eventName", type: String, mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    Sys.Observer._getContext(target, true).events._removeHandlers(eventName);
}
Sys.Observer.raiseEvent = function Sys$Observer$raiseEvent(target, eventName, eventArgs) {
    /// <summary locid="M:J#Sys.Observer.raiseEvent" />
    /// <param name="target"></param>
    /// <param name="eventName" type="String"></param>
    /// <param name="eventArgs" optional="true" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"},
        {name: "eventName", type: String},
        {name: "eventArgs", mayBeNull: true, optional: true}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    var ctx = Sys.Observer._getContext(target);
    if (!ctx) return;
    var handler = ctx.events.getHandler(eventName);
    if (handler) {
        handler(target, eventArgs || Sys.EventArgs.Empty);
    }
}
Sys.Observer.addPropertyChanged = function Sys$Observer$addPropertyChanged(target, handler) {
    /// <summary locid="M:J#Sys.Observer.addPropertyChanged" />
    /// <param name="target" mayBeNull="false"></param>
    /// <param name="handler" type="Function"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"},
        {name: "handler", type: Function}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    Sys.Observer._addEventHandler(target, "propertyChanged", handler);
}
Sys.Observer.removePropertyChanged = function Sys$Observer$removePropertyChanged(target, handler) {
    /// <summary locid="M:J#Sys.Observer.removePropertyChanged" />
    /// <param name="target" mayBeNull="false"></param>
    /// <param name="handler" type="Function"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"},
        {name: "handler", type: Function}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    Sys.Observer._removeEventHandler(target, "propertyChanged", handler);
}
Sys.Observer.beginUpdate = function Sys$Observer$beginUpdate(target) {
    /// <summary locid="M:J#Sys.Observer.beginUpdate" />
    /// <param name="target" mayBeNull="false"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    Sys.Observer._getContext(target, true).updating = true;
}
Sys.Observer.endUpdate = function Sys$Observer$endUpdate(target) {
    /// <summary locid="M:J#Sys.Observer.endUpdate" />
    /// <param name="target" mayBeNull="false"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    var ctx = Sys.Observer._getContext(target);
    if (!ctx || !ctx.updating) return;
    ctx.updating = false;
    var dirty = ctx.dirty;
    ctx.dirty = false;
    if (dirty) {
        if (target instanceof Array) {
            var changes = ctx.changes;
            ctx.changes = null;
            Sys.Observer.raiseCollectionChanged(target, changes);
        }
        Sys.Observer.raisePropertyChanged(target, "");
    }
}
Sys.Observer.isUpdating = function Sys$Observer$isUpdating(target) {
    /// <summary locid="M:J#Sys.Observer.isUpdating" />
    /// <param name="target" mayBeNull="false"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "target"}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    var ctx = Sys.Observer._getContext(target);
    return ctx ? ctx.updating : false;
}
Sys.Observer._setValue = function Sys$Observer$_setValue(target, propertyName, value) {
    var getter, setter, mainTarget = target, path = propertyName.split('.');
    for (var i = 0, l = (path.length - 1); i < l ; i++) {
        var name = path[i];
        getter = target["get_" + name]; 
        if (typeof (getter) === "function") {
            target = getter.call(target);
        }
        else {
            target = target[name];
        }
        var type = typeof (target);
        if ((target === null) || (type === "undefined")) {
            throw Error.invalidOperation(String.format(Sys.Res.nullReferenceInPath, propertyName));
        }
    }    
    var currentValue, lastPath = path[l];
    getter = target["get_" + lastPath];
    setter = target["set_" + lastPath];
    if (typeof(getter) === 'function') {
        currentValue = getter.call(target);
    }
    else {
        currentValue = target[lastPath];
    }
    if (typeof(setter) === 'function') {
        setter.call(target, value);
    }
    else {
        target[lastPath] = value;
    }
    if (currentValue !== value) {
        var ctx = Sys.Observer._getContext(mainTarget);
        if (ctx && ctx.updating) {
            ctx.dirty = true;
            return;
        };
        Sys.Observer.raisePropertyChanged(mainTarget, path[0]);
    }
}
Sys.Observer.setValue = function Sys$Observer$setValue(target, propertyName, value) {
    /// <summary locid="M:J#Sys.Observer.setValue" />
    /// <param name="target" mayBeNull="false"></param>
    /// <param name="propertyName" type="String"></param>
    /// <param name="value" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target"},
        {name: "propertyName", type: String},
        {name: "value", mayBeNull: true}
    ]);
    if (e) throw e;
    Sys.Observer._ensureObservable(target);
    Sys.Observer._setValue(target, propertyName, value);
}
Sys.Observer.raisePropertyChanged = function Sys$Observer$raisePropertyChanged(target, propertyName) {
    /// <summary locid="M:J#Sys.Observer.raisePropertyChanged" />
    /// <param name="target" mayBeNull="false"></param>
    /// <param name="propertyName" type="String"></param>
    Sys.Observer.raiseEvent(target, "propertyChanged", new Sys.PropertyChangedEventArgs(propertyName));
}

Sys.Observer.addCollectionChanged = function Sys$Observer$addCollectionChanged(target, handler) {
    /// <summary locid="M:J#Sys.Observer.addCollectionChanged" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    /// <param name="handler" type="Function"></param>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true},
        {name: "handler", type: Function}
    ]);
    if (e) throw e;
    Sys.Observer._addEventHandler(target, "collectionChanged", handler);
}
Sys.Observer.removeCollectionChanged = function Sys$Observer$removeCollectionChanged(target, handler) {
    /// <summary locid="M:J#Sys.Observer.removeCollectionChanged" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    /// <param name="handler" type="Function"></param>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true},
        {name: "handler", type: Function}
    ]);
    if (e) throw e;
    Sys.Observer._removeEventHandler(target, "collectionChanged", handler);
}
Sys.Observer._collectionChange = function Sys$Observer$_collectionChange(target, change) {
    var ctx = Sys.Observer._getContext(target);
    if (ctx && ctx.updating) {
        ctx.dirty = true;
        var changes = ctx.changes;
        if (!changes) {
            ctx.changes = changes = [change];
        }
        else {
            changes.push(change);
        }
    }
    else {
        Sys.Observer.raiseCollectionChanged(target, [change]);
        Sys.Observer.raisePropertyChanged(target, 'length');
    }
}
Sys.Observer.add = function Sys$Observer$add(target, item) {
    /// <summary locid="M:J#Sys.Observer.add" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    /// <param name="item" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true},
        {name: "item", mayBeNull: true}
    ]);
    if (e) throw e;
    var change = new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.add, [item], target.length);
    Array.add(target, item);
    Sys.Observer._collectionChange(target, change);
}
Sys.Observer.addRange = function Sys$Observer$addRange(target, items) {
    /// <summary locid="M:J#Sys.Observer.addRange" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    /// <param name="items" type="Array" elementMayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true},
        {name: "items", type: Array, elementMayBeNull: true}
    ]);
    if (e) throw e;
    var change = new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.add, items, target.length);
    Array.addRange(target, items);
    Sys.Observer._collectionChange(target, change);
}
Sys.Observer.clear = function Sys$Observer$clear(target) {
    /// <summary locid="M:J#Sys.Observer.clear" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true}
    ]);
    if (e) throw e;
    var oldItems = Array.clone(target);
    Array.clear(target);
    Sys.Observer._collectionChange(target, new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.reset, null, -1, oldItems, 0));
}
Sys.Observer.insert = function Sys$Observer$insert(target, index, item) {
    /// <summary locid="M:J#Sys.Observer.insert" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    /// <param name="index" type="Number" integer="true"></param>
    /// <param name="item" mayBeNull="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true},
        {name: "index", type: Number, integer: true},
        {name: "item", mayBeNull: true}
    ]);
    if (e) throw e;
    Array.insert(target, index, item);
    Sys.Observer._collectionChange(target, new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.add, [item], index));
}
Sys.Observer.remove = function Sys$Observer$remove(target, item) {
    /// <summary locid="M:J#Sys.Observer.remove" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    /// <param name="item" mayBeNull="true"></param>
    /// <returns type="Boolean"></returns>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true},
        {name: "item", mayBeNull: true}
    ]);
    if (e) throw e;
    var index = Array.indexOf(target, item);
    if (index !== -1) {
        Array.remove(target, item);
        Sys.Observer._collectionChange(target, new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.remove, null, -1, [item], index));
        return true;
    }
    return false;
}
Sys.Observer.removeAt = function Sys$Observer$removeAt(target, index) {
    /// <summary locid="M:J#Sys.Observer.removeAt" />
    /// <param name="target" type="Array" elementMayBeNull="true"></param>
    /// <param name="index" type="Number" integer="true"></param>
    var e = Function._validateParams(arguments, [
        {name: "target", type: Array, elementMayBeNull: true},
        {name: "index", type: Number, integer: true}
    ]);
    if (e) throw e;
    if ((index > -1) && (index < target.length)) {
        var item = target[index];
        Array.removeAt(target, index);
        Sys.Observer._collectionChange(target, new Sys.CollectionChange(Sys.NotifyCollectionChangedAction.remove, null, -1, [item], index));
    }
}
Sys.Observer.raiseCollectionChanged = function Sys$Observer$raiseCollectionChanged(target, changes) {
    /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
    /// <param name="target"></param>
    /// <param name="changes" type="Array" elementType="Sys.CollectionChange"></param>
    Sys.Observer.raiseEvent(target, "collectionChanged", new Sys.NotifyCollectionChangedEventArgs(changes));
}

Sys.Observer._observeMethods = {
    add_propertyChanged: function(handler) {
        Sys.Observer._addEventHandler(this, "propertyChanged", handler);
    },
    remove_propertyChanged: function(handler) {
        Sys.Observer._removeEventHandler(this, "propertyChanged", handler);
    },
    addEventHandler: function(eventName, handler) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="eventName" type="String"></param>
        /// <param name="handler" type="Function"></param>
        var e = Function._validateParams(arguments, [
            {name: "eventName", type: String},
            {name: "handler", type: Function}
        ]);
        if (e) throw e;
        Sys.Observer._addEventHandler(this, eventName, handler);
    },
    removeEventHandler: function(eventName, handler) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="eventName" type="String"></param>
        /// <param name="handler" type="Function"></param>
        var e = Function._validateParams(arguments, [
            {name: "eventName", type: String},
            {name: "handler", type: Function}
        ]);
        if (e) throw e;
        Sys.Observer._removeEventHandler(this, eventName, handler);
    },
    clearEventHandlers: function(eventName) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="target"></param>
        /// <param name="eventName" type="String" mayBeNull="true" optional="true"></param>
        var e = Function._validateParams(arguments, [
            {name: "target"},
            {name: "eventName", type: String, mayBeNull: true, optional: true}
        ]);
        if (e) throw e;
        Sys.Observer._getContext(this, true).events._removeHandlers(eventName);
    },
    get_isUpdating: function() {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <returns type="Boolean"></returns>
        return Sys.Observer.isUpdating(this);
    },
    beginUpdate: function() {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        Sys.Observer.beginUpdate(this);
    },
    endUpdate: function() {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        Sys.Observer.endUpdate(this);
    },
    setValue: function(name, value) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="name" type="String"></param>
        /// <param name="value" mayBeNull="true"></param>
        var e = Function._validateParams(arguments, [
            {name: "name", type: String},
            {name: "value", mayBeNull: true}
        ]);
        if (e) throw e;
        Sys.Observer._setValue(this, name, value);
    },
    raiseEvent: function(eventName, eventArgs) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="eventName" type="String"></param>
        /// <param name="eventArgs" optional="true" mayBeNull="true"></param>
        Sys.Observer.raiseEvent(this, eventName, eventArgs||null);
    },
    raisePropertyChanged: function(name) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="name" type="String"></param>
        Sys.Observer.raiseEvent(this, "propertyChanged", new Sys.PropertyChangedEventArgs(name));
    }
}
Sys.Observer._arrayMethods = {
    add_collectionChanged: function(handler) {
        Sys.Observer._addEventHandler(this, "collectionChanged", handler);
    },
    remove_collectionChanged: function(handler) {
        Sys.Observer._removeEventHandler(this, "collectionChanged", handler);
    },
    add: function(item) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="item" mayBeNull="true"></param>
        Sys.Observer.add(this, item);
    },
    addRange: function(items) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="items" type="Array" elementMayBeNull="true"></param>
        Sys.Observer.addRange(this, items);
    },
    clear: function() {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        Sys.Observer.clear(this);
    },
    insert: function(index, item) { 
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="index" type="Number" integer="true"></param>
        /// <param name="item" mayBeNull="true"></param>
        Sys.Observer.insert(this, index, item);
    },
    remove: function(item) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="item" mayBeNull="true"></param>
        /// <returns type="Boolean"></returns>
        return Sys.Observer.remove(this, item);
    },
    removeAt: function(index) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="index" type="Number" integer="true"></param>
        Sys.Observer.removeAt(this, index);
    },
    raiseCollectionChanged: function(changes) {
        /// <summary locid="M:J#Sys.Observer.raiseCollectionChanged" />
        /// <param name="changes" type="Array" elementType="Sys.CollectionChange"></param>
        Sys.Observer.raiseEvent(this, "collectionChanged", new Sys.NotifyCollectionChangedEventArgs(changes));
    }
}
Sys.Observer._getContext = function Sys$Observer$_getContext(obj, create) {
    var ctx = obj._observerContext;
    if (ctx) return ctx();
    if (create) {
        return (obj._observerContext = Sys.Observer._createContext())();
    }
    return null;
}
Sys.Observer._createContext = function Sys$Observer$_createContext() {
                            var ctx = {
        events: new Sys.EventHandlerList()
    };
    return function() {
        return ctx;
    }
}

Type.registerNamespace("Sys.Services");
var ns = Sys.Services;
var service = "Service",
    role = "Role",
    auth = "Authentication",
    profile = "Profile";
function setPath(path) {
    this._path = path;
}
ns[auth+service] = {
    set_path: setPath,
    _setAuthenticated: function(auth) {
        this._auth = auth;
    }
};
ns["_" + auth + service] = {};

ns[profile + service] = { set_path: setPath };
ns["_" + profile + service] = {};
ns.ProfileGroup = function ns$ProfileGroup(properties) {
    this._propertygroup = properties;
}

ns[role + service] = { set_path: setPath };
ns["_" + role + service] = {};



}

if (window.Sys && Sys.loader) {
	Sys.loader.registerScript("Core", null, execute);
}
else {
	execute();
}

})();

Type.registerNamespace('Sys');

Sys.Res={
'invokeCalledTwice':'Cannot call invoke more than once.',
'argumentTypeName':'Value is not the name of an existing type.',
'cantBeCalledAfterDispose':'Can\'t be called after dispose.',
'webServiceFailed':'The server method \'{0}\' failed with the following error: {1}',
'componentCantSetIdAfterAddedToApp':'The id property of a component can\'t be set after it\'s been added to the Application object.',
'behaviorDuplicateName':'A behavior with name \'{0}\' already exists or it is the name of an existing property on the target element.',
'notATypeName':'Value is not a valid type name.',
'elementNotFound':'An element with id \'{0}\' could not be found.',
'stateMustBeStringDictionary':'The state object can only have null and string fields.',
'invalidExecutorType':'Could not create a valid Sys.Net.WebRequestExecutor from: {0}.',
'boolTrueOrFalse':'Value must be \'true\' or \'false\'.',
'cannotCallBeforeResponse':'Cannot call {0} when responseAvailable is false.',
'scriptLoadFailedNoHead':'ScriptLoader requires pages to contain a <head> element.',
'stringFormatInvalid':'The format string is invalid.',
'referenceNotFound':'Component \'{0}\' was not found.',
'enumReservedName':'\'{0}\' is a reserved name that can\'t be used as an enum value name.',
'circularParentChain':'The chain of control parents can\'t have circular references.',
'namespaceContainsNonObject':'Object {0} already exists and is not an object.',
'undefinedEvent':'\'{0}\' is not an event.',
'invalidTimeout':'Value must be greater than or equal to zero.',
'cannotAbortBeforeStart':'Cannot abort when executor has not started.',
'observableConflict':'Object already contains a member with the name \'{0}\'.',
'invalidHttpVerb':'httpVerb cannot be set to an empty or null string.',
'nullWebRequest':'Cannot call executeRequest with a null webRequest.',
'historyCannotEnableHistory':'Cannot set enableHistory after initialization.',
'eventHandlerInvalid':'Handler was not added through the Sys.UI.DomEvent.addHandler method.',
'scriptLoadFailedDebug':'The script \'{0}\' failed to load. Check for:\r\n Inaccessible path.\r\n Script errors. (IE) Enable \'Display a notification about every script error\' under advanced settings.',
'propertyNotWritable':'\'{0}\' is not a writable property.',
'enumInvalidValueName':'\'{0}\' is not a valid name for an enum value.',
'cannotCallOnceStarted':'Cannot call {0} once started.',
'controlAlreadyDefined':'A control is already associated with the element.',
'addHandlerCantBeUsedForError':'Can\'t add a handler for the error event using this method. Please set the window.onerror property instead.',
'badBaseUrl1':'Base URL does not contain ://.',
'badBaseUrl2':'Base URL does not contain another /.',
'badBaseUrl3':'Cannot find last / in base URL.',
'setExecutorAfterActive':'Cannot set executor after it has become active.',
'cantAddNonFunctionhandler':'Can\'t add a handler that is not a function.',
'invalidNameSpace':'Value is not a valid namespace identifier.',
'notAnInterface':'Value is not a valid interface.',
'eventHandlerNotFunction':'Handler must be a function.',
'propertyNotAnArray':'\'{0}\' is not an Array property.',
'namespaceContainsClass':'Object {0} already exists as a class, enum, or interface.',
'typeRegisteredTwice':'Type {0} has already been registered. The type may be defined multiple times or the script file that defines it may have already been loaded. A possible cause is a change of settings during a partial update.',
'cantSetNameAfterInit':'The name property can\'t be set on this object after initialization.',
'historyMissingFrame':'For the history feature to work in IE, the page must have an iFrame element with id \'__historyFrame\' pointed to a page that gets its title from the \'title\' query string parameter and calls Sys.Application._onIFrameLoad() on the parent window. This can be done by setting EnableHistory to true on ScriptManager.',
'appDuplicateComponent':'Two components with the same id \'{0}\' can\'t be added to the application.',
'historyCannotAddHistoryPointWithHistoryDisabled':'A history point can only be added if enableHistory is set to true.',
'expectedElementOrId':'Value must be a DOM element or DOM element id.',
'selectorNotFound':'An element with selector \'{0}\' could not be found.',
'cannotCallOutsideHandler':'Cannot call {0} outside of a completed event handler.',
'methodNotFound':'No method found with name \'{0}\'.',
'arrayParseBadFormat':'Value must be a valid string representation for an array. It must start with a \'[\' and end with a \']\'.',
'cannotSerializeObjectWithCycle':'Cannot serialize object with cyclic reference within child properties.',
'stateFieldNameInvalid':'State field names must not contain any \'=\' characters.',
'stringFormatBraceMismatch':'The format string contains an unmatched opening or closing brace.',
'enumValueNotInteger':'An enumeration definition can only contain integer values.',
'propertyNullOrUndefined':'Cannot set the properties of \'{0}\' because it returned a null value.',
'expectedDomElementOrSelector':'\'{0}\' must be a DOM element or DOM element selector.',
'argumentDomNode':'Value must be a DOM element or a text node.',
'componentCantSetIdTwice':'The id property of a component can\'t be set more than once.',
'createComponentOnDom':'Value must be null for Components that are not Controls or Behaviors.',
'createNotComponent':'{0} does not derive from Sys.Component.',
'createNoDom':'Value must not be null for Controls and Behaviors.',
'cantAddWithoutId':'Can\'t add a component that doesn\'t have an id.',
'urlTooLong':'The history state must be small enough to not make the url larger than {0} characters.',
'notObservable':'Instances of type \'{0}\' cannot be observed.',
'badTypeName':'Value is not the name of the type being registered or the name is a reserved word.',
'argumentInteger':'Value must be an integer.',
'argumentType':'Object cannot be converted to the required type.',
'argumentNull':'Value cannot be null.',
'scriptAlreadyLoaded':'The script \'{0}\' has been referenced multiple times. If referencing Microsoft AJAX scripts explicitly, set the MicrosoftAjaxMode property of the ScriptManager to Explicit.',
'scriptDependencyNotFound':'The script \'{0}\' failed to load because it is dependent on script \'{1}\'.',
'formatBadFormatSpecifier':'Format specifier was invalid.',
'requiredScriptReferenceNotIncluded':'\'{0}\' requires that you have included a script reference to \'{1}\'.',
'webServiceFailedNoMsg':'The server method \'{0}\' failed.',
'argumentDomElement':'Value must be a DOM element.',
'actualValue':'Actual value was {0}.',
'enumInvalidValue':'\'{0}\' is not a valid value for enum {1}.',
'scriptLoadFailed':'The script \'{0}\' could not be loaded.',
'parameterCount':'Parameter count mismatch.',
'cannotDeserializeEmptyString':'Cannot deserialize empty string.',
'formatInvalidString':'Input string was not in a correct format.',
'argument':'Value does not fall within the expected range.',
'cannotDeserializeInvalidJson':'Cannot deserialize. The data does not correspond to valid JSON.',
'cannotSerializeNonFiniteNumbers':'Cannot serialize non finite numbers.',
'argumentUndefined':'Value cannot be undefined.',
'webServiceInvalidReturnType':'The server method \'{0}\' returned an invalid type. Expected type: {1}',
'servicePathNotSet':'The path to the web service has not been set.',
'argumentTypeWithTypes':'Object of type \'{0}\' cannot be converted to type \'{1}\'.',
'paramName':'Parameter name: {0}',
'nullReferenceInPath':'Null reference while evaluating data path: \'{0}\'.',
'format':'One of the identified items was in an invalid format.',
'assertFailedCaller':'Assertion Failed: {0}\r\nat {1}',
'argumentOutOfRange':'Specified argument was out of the range of valid values.',
'webServiceTimedOut':'The server method \'{0}\' timed out.',
'notImplemented':'The method or operation is not implemented.',
'assertFailed':'Assertion Failed: {0}',
'invalidOperation':'Operation is not valid due to the current state of the object.',
'breakIntoDebugger':'{0}\r\n\r\nBreak into debugger?'
};
