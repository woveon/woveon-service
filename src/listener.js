const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const Handlebars = require('handlebars');
const Logger     = require('woveon-logger');
const fs         = require('fs');
const cors       = require('cors');

const WovReturn    = require('./wovreturn');
const DocTemplates = require('./doctemplates');


// NOTE: JSON needs {{{JSON X}}}, since it outputs html
Handlebars.registerHelper('JSON', function(context) { return `<pre style="font-size: 8px"><code>${JSON.stringify(context, null, 2)}</code></pre>`; });
Handlebars.registerHelper('upper', function(context) { return context.toUpperCase(); });
Handlebars.registerHelper('docParam', function(context, _ispost) {
  let retval = null;
  let t = _ispost || 'Param';

  // Logger.g().info('docParam: ', context, _ispost);
  if ( typeof context == 'string' ) {
    retval=
      `<dt>${t}: ${context} <span> (required)</span></dt>`;
  }
  else { // DocParam
    retval=
      `<dt>${t}: ${context.name}`+
      `${ (context.in)?` - in ${context.in}`:''}`+
      `${ (context.required)?` <span> (required)</span>`:''}`+
      `</dt>`;
    if ( context.desc ) retval += `<dd>${context.desc}</dd>`;
  }
  return retval;
});

/**
 * @typedef Promise
 */

/**
 * Class that manages RESTFUL listening via ExpressJS.
 */
module.exports = class Listener {

  /**
   * Constructor.
   * @param {integer} _port - port to listen on
   * @param {*} _logger -
   * @param {*} _staticdir - static content to display, if not null
   * @param {string} _root - Route root... ex. '/api/v1'
   * @param {string} _name - Name of this listener (or its parent microservice)
   */
  constructor(_port, _logger, _staticdir = null, _root='', _name = null) {
    this.port        = _port;
    this.server      = null; // set on listen
    this.logger      = _logger;
    this.staticdir   = _staticdir; // this is a relative path, appended to process.cwd()+'/'
    this.app         = null;
    this.islistening = false;
    this.root        = _root;
    this.openroute   = null;
    this.externalapp = false;
    this.name        = _name;

    this._routers     = []; // listing of Express routers that build the endpoints/routes of listener: [[subroute, router, array],...]

    if ( _port == null || typeof _port == 'object' ) {
      this.logger.info(` args: ${typeof _port}  ${Array.from(arguments)}`);
      console.trace();
      this.logger.throwError('You are not sending correct params to Listener');
    }

    this.docs        = {};
    this.views       = {};
    this.templateNode = null;
    this.verbs = ['get', 'post', 'put', 'delete', 'protect'];
  };


  /**
   * Latch on to an existing express app.
   * @param {ExpressJs} _app - extend this existing app with this listener
   */
  async initWithApp(_app) {
    this.externalapp = true;
    if (this.app) { await this.close(); }
    this.app = _app;
    this.logger.verbose('  ... listener inited with external app, assuming is listening');
  }


  /**
   * Create and config the listening app.
   */
  async init() {

    if (this.app) { await this.close(); }


    this.logger.verbose('  ... listener init');
    this.app = express();

    // serve static content if set
    if ( this.staticdir != null ) {
      let fullstaticdir = path.join(process.cwd()+'/'+this.staticdir);

      // test that directory exists
      let failedpath = true;
      if ( fs.existsSync(fullstaticdir) ) {
        let sy = fs.statSync(fullstaticdir);
        if ( sy.isDirectory() ) failedpath = false;
      }
      if ( failedpath == true ) {
        this.logger.throwError(`Failed to set path for static content: "${fullstaticdir}". Did you start node in the correct directory? Maybe go back a directory and run it?`);
      }

      this.logger.info(`  ... serving static content on '${fullstaticdir}'.`);
      this.app.use('/static', express.static(fullstaticdir));
      // this.app.use('/static', express.static(fullstaticdir));
    }

    this.app.use(bodyParser.json({limit : '50mb'}));
    this.app.use(bodyParser.urlencoded({extended : true, limit : '50mb'}));

    this.logger.verbose('  ... listener configure routes');
    let that = this;

    // set CORS to enable all CORS requests
    this.app.use(cors());

    // debugging for each call
    this.app.all('*', function(req, res, next) {
      // I think this works because shifted to function
      that.logger.aspect('listener', `*** Incoming (port ${that.port}): `+
        `'${req.originalUrl}' '${req.method}' from: '${req.ip}'`);

      // that.logger.verbose(req.params,req.query,req.body);
      if (Object.keys(req.params > 0).length) { that.logger.aspect('listener', '  : params : ', req.params); }
      if (Object.keys(req.query).length)      { that.logger.aspect('listener', '  :  query : ', req.query);  }
      if (Object.keys(req.body).length)       { that.logger.aspect('listener', '  :   body : ', req.body);   }
      if (req.files)                          { that.logger.aspect('listener', '  :  files : ', req.files);  }

      /*
      that.logger.info('...setting Access-Control-Allow-Origin to *.');
      res.header('Access-Control-Allow-Origin', req.headers.origin); // req.get('origin')); // req.headers.origin
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Credentials', 'true');
      */
      next();
    });
  };


  /**
   * Start up the app listening.
   *
   * Between init() and listen(), plugins can extend this Listener.
   *
   * @return {Promise} -
   */
  async listen() {


    try { this._resolveDocs(); }
    catch (e) {
      console.log(e);
      console.trace();
      throw new Error('failed to resolve Docs');
    }

    if ( this.externalapp == true ) { this.islistening = true; return Promise.resolve(); }

    return new Promise((resolve, reject) => {

      // cap with a final error listener
      this.islistening = true;
      this.app.all('*', (_req, _res) => {
        let args = Object.assign({}, _req.query, _req.body, _req.files, _req.wov);
        this.logger.aspect('listener.incoming', `Handling : '${_req.originalUrl}' with: 'no method'`);
        this.logger.warn(`No route '${_req.originalUrl} ${_req.method}' `+
                         `from : ${_req.headers.host} ${_req.headers['user-agent']} with : `, args);
        let str = `Failed to match endpoint '${_req.method}' '${_req.originalUrl}' ${this.port}`;
        this.sendWovReturnResponse(_res, WovReturn.retError(str), 'no method');
      });

      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        // this.service.port = this.server.address().port;
        this.address = this.server.address().address;
        this.logger.info(`  ... listener listening on port: ${this.port} `);
        resolve();
      })
        .on('error', (err) => {
          this.logger.error(`Listener failed starting on port : ${this.port}`);
          reject(err);
        });
    });
  };


  /**
   * If this was listenining, close down.
   */
  async close() {
    if ( this.server ) { await this.server.close(); this.server = null; }
    else { this.logger.warn('listener with no server (never inited)'); console.trace(); }
  };


  /**
   * This checks that the passed in args have the _attr... val skipped for now.
   *
   * @param {object} _args -
   * @param {object} _attr -
   * @param {object} _val - unused at the moment
   * @param {boolean} _retRawError - on error: if true, returns Error, false
   *   (default) it returns a WovReturn object.
   * @return {Error/retError} - null on success or Error/retError depending on _retError
   */
  checkBodyAttribute(_args, _attr, _val, _retRawError= false) {
    this.logger.logDeprecated('should just call WovReturn.checkBodyAttribute directly.');
    console.trace();
    return WovReturn.checkProperties(_args, _attr, _val, _retRawError);
  }


  /**
   * Route succeeded.
   * @param {object}  _data - returned object
   * @return {WovReturn} -
   */
  /*
  retSuccess(_data) {
    this.logger.logDeprecated('should just call WovReturn.retSuccess directly.');
    console.trace();
    return WovReturn.retSuccess(_data);
  }
  */


  /**
   * Redirect to path.
   * @param {string} _path - the redirect URL
   * @return {WovReturn} -
   */
  /*
  retRedirect(_path) {
    this.logger.logDeprecated('should just call WovReturn.retRedirect directly.');
    console.trace();
    return WovReturn.retRedirect(_path);
  }
  */


  /**
   * Route had error in performing its function. NOTE: not a system level error
   * @param {object}  _data - returned object
   * @param {string}   _msg - message describing the failure
   * @return {object} - res object for sender
   */
  /*
  retError(_data, _msg='General Error') {
    this.logger.logDeprecated('should just call WovReturn.retError directly.');
    console.trace();
    return WovReturn.retError(_data, _msg);
  }
  */


  /**
   * Route had system failure.
   * @param {object}  _data - returned object
   * @param {integer} _code - http response code
   * @param {string}   _msg - message describing the failure
   * @return {object} - res object for sender
   */
  /*
  retFail(_data, _code=400, _msg='Failure') {
    this.logger.logDeprecated('should just call WovReturn.retFail directly.');
    console.trace();
    return WovReturn.retFail(_data, _code, _msg);
  }
  */


  /**
   * Helper function for listening, to standardize returns.
   *
   * This returns an object { success : <bool>, data : ... }. Success just means the call completed. It
   * could have completed in failure, but taht will be shown in the data attribute.
   *
   * NOTE: Not responding on error with error codes?
   * @param {string} _route - full route
   * @param {*} _method - a function that returns WovReturn, or an object/value, with success assumed
   * @param {Array<string>, Array<DocParam>, Object} _paramDefs - definition of the parms to check : array are required, object has true/false values
   * @param {string} _mfilename - name of method's file
   * @param {*} _args
   * @param {*} _res
   * @param {object} _options - further instructions to this handler
   */
  async responseHandler(_route, _method, _paramDefs, _mfilename, _args, _res, _options = {}) {
    this.logger.verbose(`...listener heard route: ${_route}`);
    let fn = this.logger.trimpath(_mfilename, this.logger.options.trimTo); // _mfilename.split(this.logger.options.trimTo+'/')[1] || _mfilename;
    this.logger.aspect('listener.incomingfull', `Handling : '${_route}' with: '${fn}::${_method.name}' :`, _args);
    this.logger.aspect('listener.incoming', `Handling : '${_route}' with: '${fn}::${_method.name}'`);
    this.logger.aspect('thread', `>>>arriving at ${fn}::${_method.name} in ${_mfilename}`);

    let retval = WovReturn.checkProperties(_args, _paramDefs);

    if ( retval == null ) { if ( (typeof _method) != 'function' ) { retval = this.retSuccess(_method); } }

    // call method and catch Errors thrown
    if ( retval == null ) {

      try { retval = await _method(_args, _res); }
      catch (error) {
        this.logger.warn(error);
        retval = WovReturn.retError(error, error.msg);
        if ( process.env.WOV_STAGE != 'prod' ) {
          retval.error = error.msg;
          retval.data  = {}; // error.data;
        }
        this.logger.warn(retval);
      }
    }

    // check for WovReturn (or object representing it)
    // this.logger.info('retval: ', retval, retval instanceof WovReturn );
    if ( retval == null ) {
      retval = new Error(
        'Method returned null, not WovReturn object.\n'+
        '  retval  : ', JSON.stringify(retval, null, '  '), '\n'+
        '  @route  : ', _route, '\n'+
        '  @method : ', _method, '\n'+
        '  @file   : ', _mfilename);
      this.sendWovReturnResponse(_res, WovReturn.retFail(retval, 500), _method.name);
    }
    else if (! WovReturn.isValidWovReturn(retval) ) {
      retval = new Error(
        `Method did not return WovReturn object, but "${JSON.stringify(retval, null, 2)}"\n`+
        '  retval  : ', JSON.stringify(retval, null, '  '), '\n'+
        '  @route  : ', _route, '\n'+
        '  @method : ', _method, '\n'+
        '  @file   : ', _mfilename);
      this.sendWovReturnResponse(_res, WovReturn.retFail(retval, 500), _method.name);
    }

    else {

      // perform any additional actions, based upon _options
      if ( _options.addRoute == true ) { retval.data.route = _route; }

      // Redirect if it's a redirect
      if ( retval.code == 302 ) {
        // this.logger.info('redirect: ', retval, _res);
        this.logger.aspect('listener.result listener.redirect', `  ... redirect(${retval.code}): `, retval);
        this.logger.aspect('thread', `>>>redirect to ${fn}::${_method.name}`, retval);
        _res.redirect(302, retval.data);
      }

      // all WovReturns
      else { this.sendWovReturnResponse(_res, retval, _method.name); }
    }
  }


  /**
   * Common function called by onProtect and responseHandler to return data to the client.
   * @param {Response} _res -
   * @param {WovReturn} _wr - object to be sent to client
   * @param {string} _methodname - name of the handling method
   */
  async sendWovReturnResponse(_res, _wr, _methodname) {

    if ( _wr.code != 200 ) { this.logger.warn(_wr); this.logger.throwError(); }

    // don't return useful Error objects and messages in production (but they are logged)
    if ( process.env.WOV_STAGE == 'prod' && retval.error !== undefined ) { retval.error = null; retval.msg = 'error'; }

    this.logger.aspect('listener.result', `  ... returning(${_wr.code}): `, _wr);
    this.logger.aspect('thread', `<<<leaving from ${_methodname}`, _wr);

    // send with code
    if (! _res.headersSent) { await _res.status(_wr.code).json(_wr); }
    else this.logger.throwError('ALREADY SENT?!?! How?');
  }


  /**
   * This 'protects' a route you pass in, selected from root, and any variables you
   * return in _method's WovReturn.data are then included in req.wov, a compiling
   * object of values, eventually passed to your regular leaf handling function.
   *
   *   ex. /user/:sessionid/widgets/:widgetid  - use onProtect('/user/:sessionid') to
   *       make calls to databases to see if session is valid, then return userid
   *       so the leaf method can lookup and see if user can access that widget.
   *
   * NOTE: vals stored in _req.wov.
   * @param {url} _route -
   * @param {function} _methodOrDocMethod - method to call or DocMethod
   * @param {string} _mfilename - method's file
   */
  async onProtect(_route, _methodOrDocMethod, _mfilename) {
    let result = this.onXCommon('protect', _route, _methodOrDocMethod, _mfilename);

    if ( result.docmethod.params == null ) this.logger.throwError('onProtect has no params');
    if ( result.docmethod.paramspost == null ) this.logger.throwError('onProtect has no paramspost');

    // add middlewear on the route
    this.app.use(result.fullroute, async function(_req, _res, next) {
      let args = Object.assign({}, _req.query, _req.params, _req.body, _req.files, _req.wov);

      this.logger.aspect('listener.protect', `Protecting : '${_route}' with: '${JSON.stringify(args, null, 2)}'`);

      // check that required attributes exist
      let retval = WovReturn.checkProperties(args, result.docmethod.params, null, {retRawError : true, checkStrict : false});

      // call method if all ok so far
      if ( retval == null ) {
        try { retval = await result.method(args, _res); }
        catch (e) { retval = e; }
      }

      // handle return types: failed: access denied, failed:null, failed:unknown object, good: all else
      if ( retval instanceof Error ) {
        this.sendWovReturnResponse(_res, WovReturn.retFail(retval.message, 401), result.method.name);
      }
      else if ( retval == null ) {
        retval = new Error('onProtect method returned null, not a WovReturn object');
        this.sendWovReturnResponse(_res, WovReturn.retFail(retval.message, 500), result.method.name);
      }
      else if (! WovReturn.isValidWovReturn(retval) ) {
        retval = new Error(`onProtect method returned object not of WovReturn form but of: "${JSON.stringify(retval, null, 2)}".`);
        this.sendWovReturnResponse(_res, WovReturn.retFail(retval.message, 500), result.method.name);
      }
      else if ( retval.success == false ) {
        this.sendWovReturnResponse(_res, retval, result.method.name);
      }
      else {

        // add in params from onProtect method's retval to the req.wov values
        if ( (typeof retval.data ) == 'object' ) {
          this.logger.aspect('listener.protect.data', 'PROTECT: adding to wov:', Object.keys(retval.data));
          if ( _req.wov == null ) _req.wov = {};
          // this.logger.aspect('listener.protect.data', 'PROTECT: adding to wov:', _req.wov, retval.data);
          Object.assign(_req.wov, retval.data);
          // this.logger.aspect('listener.protect.data', 'PROTECT: added  to wov:', _req.wov, retval.data);
        }

        // check post attributes match to method definition
        let argspost = Object.assign({}, _req.query, _req.params, _req.body, _req.files, _req.wov);
        this.logger.aspect('listener.protect', `Protecting : (post) '${_route}' with: '${JSON.stringify(argspost, null, 2)}'`);
        let resultpost = WovReturn.checkProperties(argspost, result.docmethod.paramspost, null, {retRawError : true, checkStrict : false});
        if ( resultpost != null ) {
          this.logger.warn('Failed post arguments: ', resultpost.message);
          retval = new Error(`onProtect: "${resultpost.message}".`);
          this.sendWovReturnResponse(_res, WovReturn.retFail(retval.message, 500), result.method.name);
        }

        // success and continue
        else next();
      }
    }.bind(this));
  }


  /*
  async onMidpoint(_preroute, _method, _postroute, _method, _mfilename, _docMethod = null) {
  }
  */

  /**
   * Find the express router that matches subroutes in the routes with _route.
   *
   * @return {object} - the routers entry of last match, with subroute that remains : {entry : array, subroute : string}
   *
   * ex. /A/:a/B if matched /A/:a, would return {entry: [], subroute: '/B'} if this.routes had [['/A/:a', router, []].
   */
  /*
  _matchRoute(_route, _curroutes) {
    let retval = null;
    let curroutes = _curroutes;
    if ( curroutes == null ) curroutes = this._routers;

    // walk down routers at this level
    for (let i=0; (i<curroutes.length) && ( retval == null); i++) {
      let r = curroutes[parseInt(i)];
      this.logger.info(`  ... check ${r[0]}`);
      if ( _route.startsWith(r[0]) ) {
        this.logger.info('matched start of route : ', _route, r[0]);
        let subroute = _route.substring(r[0].length);
        retval = this._matchRoute(subroute, r[2]);
      }
    }

    if ( retval == null ) retval = {entry : curroutes, subroute : _route};

    return retval;
  }
  */


  /** called at listen time.
   * Puts all the express.Routers in this._routers into app
   */
  /*
  async connectSubrouteEntries(_subroute = null, _entry = null) {
    let entry = _entry || this._routers;
    let curroute = _subroute || '';

    this.logger.info(`connectSubrouteEntries @(${curroute}): `, entry);

    for (let i=0; i<entry.length; i++) {
      let e = entry[parseInt(i)];
      this.logger.info(`  - add entry (this.app.use(${curroute}${e[0]}, e[1]): `, e);
      this.app.use(`${curroute}${e[0]}`, e[1]);
      if ( e[2].length != 0 ) this.connectSubrouteEntries(`${curroute}${e[0]}`, e[2]);
    }
  }
  */


  /**
   * Returns the raw name (i.e. remove 'get', 'set', or 'bound').
   * @param {Function} _f -
   * @return {string}
   */
  _getFunctionRawName(_f) {
    let retval = '';
    if ( _f != null && _f.name != null ) {
      let n = _f.name.split(' ');
      retval = n[n.length-1];
    }
    return retval;
  }

  /**
   * Call for all onX https verbs. Common functionality across them.
   */
  onXCommon(_verb, _route, _methodOrDocMethod, _mfilename) {
    let retval = {
      fullroute : this.root + _route,
      docmethod : null,
      method    : null,
    };

    // Check state of system and called params
    if ( _mfilename == null ) { this.logger.throwError('Need to append "__filename" to listener function.'); }
    if ( this.islistening )   { this.logger.throwError(`calling Listener.onX "${retval.fullroute}" when already listening.`); }
    if ( this.app == null )   { this.logger.throwError(`failed to call init() on this listener before onX route ${retval.fullroute}.`); }

    if ( typeof _methodOrDocMethod == 'object' ) {
      // this.logger.info('onXCommon1: ', _methodOrDocMethod);
      retval.docmethod = _methodOrDocMethod;
      retval.method    = retval.docmethod.handler;

    }
    else  if ( typeof _methodOrDocMethod == 'function' ) {
      retval.docmethod = new DocMethod({
        summary   : null,
        desc      : null,
        verb      : _verb,
        route     : _route,
        docs      : [],      // DocDoc
        params    : [],      // DocParam
        responses : [],      // DocResp
      });
      retval.method = _methodOrDocMethod;
    }
    else { throw Error(`Unknown "_methodOrDocMethod" passed to "on${_verb.charAt(0).toUpperCase()+_verb.slice(1)}" route "${_route}"`); }

    // Self documentation
    if ( retval.docmethod.filename == null ) retval.docmethod.filename = _mfilename;
    if ( retval.docmethod.funcname == null ) retval.docmethod.funcname = this._getFunctionRawName(retval.method);
    if ( retval.docmethod.verb     == null ) retval.docmethod.verb     = _verb;
    if ( retval.docmethod.route    == null ) retval.docmethod.route    = _route;
    this.onDoc(retval.fullroute, retval.docmethod, _verb);

    // this.logger.info('onXCommon : ', retval.docmethod);

    this.logger.aspect('listener.route listener.protect', `${_verb.toUpperCase().padEnd(7)} : `+
                                         `${this._getFunctionRawName(retval.method).padEnd(20, ' ')} : ${retval.fullroute}`);

    return retval;
  }

  /**
   * RESTFUL GET route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _methodOrDocMethod - method to call or DocMethod
   * @param {string} _mfilename - name of method's file
   */
  async onGet(_route, _methodOrDocMethod, _mfilename) {
    let result = this.onXCommon('get', _route, _methodOrDocMethod, _mfilename);

    this.app.get(result.fullroute, (req, res) => {
      this.responseHandler(result.fullroute, result.method, result.docmethod.params, _mfilename,
                           Object.assign({}, req.query, req.params, req.body, req.files, req.wov), res);
    });
  }


  /**
   * RESTFUL POST route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _methodOrDocMethod - method to call or DocMethod
   * @param {string} _mfilename - name of method's file
   */
  async onPost(_route, _methodOrDocMethod, _mfilename) {
    /*
    if ( _mfilename == null ) { this.logger.throwError('Need to append "__filename" to listener function.'); }
    let rr = this.root + _route;

    // Self documentation
    if ( _docMethod == null ) {
      _docMethod = new DocMethod({
        summary   : null,
        desc      : null,
        docs      : [],      // DocDoc
        params    : [],      // DocParam
        responses : [],      // DocResp
      });
    }
    if ( _docMethod.filename == null ) _docMethod.filename = _mfilename;
    if ( _docMethod.funcname == null ) _docMethod.funcname = this._getFunctionRawName(_method);
    this.onDoc(rr, _docMethod, 'post');

    if ( this.islistening ) { this.logger.throwError(`calling Listener.onPost ${rr} when already listening.`); }
    if ( this.app == null ) { this.throwError('failed to call init() on this listener.'); }
    this.logger.aspect('listener.route', `POST  : ${this._getFunctionRawName(_method).padEnd(20, ' ')} : ${rr}`);
    this.app.post(rr, (req, res) => {
      this.logger.info(' parmas: ', req.params);
      this.logger.info('  query: ', req.query);
      this.logger.info('   body: ', req.body);
      this.logger.info('    wov: ', req.wov);
      let args = Object.assign({}, req.query, req.params, req.body, req.files, req.wov);
      this.logger.info(' resulting args: ', args);
      this.responseHandler(rr, _method, _mfilename, args, res);
    });
    */
    let result = this.onXCommon('post', _route, _methodOrDocMethod, _mfilename);
    this.app.post(result.fullroute, (req, res) => {
      this.responseHandler(result.fullroute, result.method, result.docmethod.params, _mfilename,
                           Object.assign({}, req.query, req.params, req.body, req.files, req.wov), res);
    });
  };


  /**
   * RESTFUL PUT route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _methodOrDocMethod - method to call or DocMethod
   * @param {string} _mfilename - name of method's file
   */
  async onPut(_route, _methodOrDocMethod, _mfilename) {
    /*
    if ( _mfilename == null ) { this.logger.throwError('Need to append "__filename" to listener function.'); }
    let rr = this.root + _route;

    // Self documentation
    if ( _docMethod == null ) {
      _docMethod = new DocMethod({
        summary   : null,
        desc      : null,
        docs      : [],      // DocDoc
        params    : [],      // DocParam
        responses : [],      // DocResp
      });
    }
    if ( _docMethod.filename == null ) _docMethod.filename = _mfilename;
    if ( _docMethod.funcname == null ) _docMethod.funcname = this._getFunctionRawName(_method);
    this.onDoc(rr, _docMethod, 'put');

    if ( this.islistening ) { this.logger.throwError(`calling Listener.onPut ${rr} when already listening.`); }
    if ( this.app == null ) { this.logger.throwError('failed to call init() on this listener.'); }
    this.logger.aspect('listener.route', `PUT   : ${this._getFunctionRawName(_method).padEnd(20, ' ')} : ${rr}`);
    this.app.put(rr, (req, res) =>
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files, req.wov), res));
    */

    let result = this.onXCommon('put', _route, _methodOrDocMethod, _mfilename);
    this.app.put(result.fullroute, (req, res) => {
      this.responseHandler(result.fullroute, result.method, result.docmethod.params, _mfilename,
                           Object.assign({}, req.query, req.params, req.body, req.files, req.wov), res);
    });
  }

  /**
   * RESTFUL DELETE route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _methodOrDocMethod - method to call or DocMethod
   * @param {string} _mfilename - name of method's file
   */
  async onDelete(_route, _methodOrDocMethod, _mfilename) {
    /*
    if ( _mfilename == null ) { this.logger.throwError('Need to append "__filename" to listener function.'); }
    let rr = this.root + _route;

    // Self documentation
    if ( _docMethod == null ) {
      _docMethod = new DocMethod({
        summary   : null,
        desc      : null,
        docs      : [],      // DocDoc
        params    : [],      // DocParam
        responses : [],      // DocResp
      });
    }
    if ( _docMethod.filename == null ) _docMethod.filename = _mfilename;
    if ( _docMethod.funcname == null ) _docMethod.funcname = this._getFunctionRawName(_method);
    this.onDoc(rr, _docMethod, 'delete');

    if ( this.islistening ) { this.logger.throwError(`calling Listener.onDelete ${rr} when already listening.`); }
    if ( this.app == null ) { this.logger.throwError('failed to call init() on this listener.'); }
    this.logger.aspect('listener.route', `DELETE: ${this._getFunctionRawName(_method).padEnd(20, ' ')} : ${rr}`);
    this.app.delete(rr, (req, res) =>
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files, req.wov), res));
    */
    let result = this.onXCommon('delete', _route, _methodOrDocMethod, _mfilename);
    this.app.delete(result.fullroute, (req, res) => {
      this.responseHandler(result.fullroute, result.method, result.docmethod.params, _mfilename,
                           Object.assign({}, req.query, req.params, req.body, req.files, req.wov), res);
    });
  }


  /**
   * Take the DocPath objects in this.docs and turn in to html to be served.
   */
  _resolveDocs() {
    if ( this.islistening ) { this.logger.throwError(`calling Listener.onDoc when already listening.`); }
    if ( this.app == null ) { this.logger.throwError('failed to call init() on this listener.'); }

    let cur = this.docs;
    let innerhtml = this._resolveDocNode(cur, ''); // create a page for each
    this._renderDocOverview(innerhtml);            // create the overview
  }


  /**
   * @param {object} _cur - a node of this.docs
   * @param {string} _curpath - current route leading to this _cur node
   * @return {string} - endpoints
   */
  _resolveDocNode(_cur, _curpath) {
    let retval = '';

    // this template is for the listing of routes... quick info
    let endpointTemplate = DocTemplates.page_endpoint;
    let compiledTemplate = Handlebars.compile(endpointTemplate);

    // build the end node path with all the verbs
    if ( _cur.hasOwnProperty('base') ) {
      let node = _cur['base'];
      let dataOverview = {
        route    : _curpath,
        docroute : this.root + '/doc' + _curpath,
        // route    : this.root+_curpath,
        // docroute : this.root+'/doc'+_curpath,
      };
      if (node == null) {
        node = new DocPath({
          route   : _curpath,
          summary : '',
          desc    : '',
          methods : {},
          params  : [],
        });
      }
      else {
        if ( node.methods == null ) node.methods = {};
        if ( node.params  == null ) node.params  = [];
        dataOverview.hasPage = true;
      } // has has path page, then link

      if ( node.summary ) dataOverview.summary = node.summary;

      let vlist = [];
      for (let vi in this.verbs ) {
        if ( _cur.hasOwnProperty(this.verbs[vi]) ) {
          let verb = this.verbs[vi];
          vlist.push(verb);
          // this.logger.info(' -- has proerpty ', verb, ' ',  _cur.hasOwnProperty(verb) );
          // this.logger.info('getting verb: ', verb, ' of node : ', node);


          if ( node.methods[verb] != null ) {
            if ( _cur[verb] != null ) {
              this.logger.warn(`Two definitions: Conflict ${_curpath} - ${verb}.`);
              node.methods[verb] = _cur[verb];
              dataOverview.hasPage = true; // has verb path page, then link
            }
            else {
              // do nothing. _cur[verb] is null, just holding place, letting us know a route existed
              // this.logger.info(` -- ${_curpath} : no doc for route ${verb}`);
            }
          }
          else {
            if ( _cur[verb] != null ) {
              // this.logger.info(` -- ${_curpath} : adding ${verb}`);
              node.methods[verb] = _cur[verb];
              dataOverview.hasPage = true; // has verb path page, then link
            }
            else {
              this.logger.info(` -- ${_curpath} : creating ${verb}`);
              node.methods[verb] = new DocMethod({
                summary   : null,
                route     : _curpath,
                desc      : null,
                filename  : null,
                funcname  : null,
                verb      : verb,
                docs      : [],
                params    : [],
                responses : [],
              });
              // dataOverview.hasPage = true; // has verb path page, then link
            }
          }
        }
      }
      dataOverview.node = node;

      // add  line to the overview page
      dataOverview.vlist = vlist;
      let r = compiledTemplate(dataOverview);
      // this.logger.info(' - ', r);
      retval += r;

      // this.logger.info(`${_curpath} PATH: `, node);
      this._renderEndpoint(_curpath, Object.assign({}, {root : this.root}, node));
    }

    // continue searching for endnodes
    for (let k in _cur) {
      if ( _cur.hasOwnProperty(k) ) {
        // this.logger.info(` --- trying k: ${k}`);
        let r = _cur[k];

        // console.log('  ', verbs.indexOf(k) != -1);
        // console.log('  ', k=='base'? 'T':'F');

        if ( !(this.verbs.indexOf(k) != -1 || k == 'base') ) {
          if ( typeof r == 'object' ) {
            let rr = this._resolveDocNode(r, _curpath + '/' + k);
//            this.logger.info(' -- ', rr);
            retval += rr;
          }
          else {
            // this.logger.info(` what is this??? `, k, r);
            // console.trace();
          }
        }
      }
    }

    return retval;
  }


  /**
   * Renders a list of endpoints and links to detailed documentation on an endpoint.
   * @param {string} _innerhtml - html of all the endpoints previously rendered
   */
  _renderDocOverview(_innerhtml) {
    let rawTemplateBody= DocTemplates.page_wrapper;

    // compile handlebars template (and cache it)
    let templateBody   = Handlebars.compile(rawTemplateBody);

    let bodyhtml = templateBody({innerhtml : _innerhtml, name : this.name, root: this.root});
    // this.logger.info('innerhtml = ', _innerhtml);
    // this.logger.info('bodyhtml = ', bodyhtml);
    this.app.get(this.root + '/doc', async (req, res) => { res.send(bodyhtml); });
  }

  /**
   * This documents an endpoint, to return when the endpoint is reached.
   *
   * @param {string} _route - path to get to endpoint
   * @param {object} _node - node containg data of the endpoing, all methods
   * @return {null} -
   */
  _renderEndpoint(_route, _node) {
    let rr = this.root + '/doc' + _route;

    // create static html
    this.logger.aspect('listener.route', `DOC   : ${JSON.stringify(rr, null, 2)} - GET`);

    // Templates for Handlebars
    let hPath = DocTemplates.page_landing;

    // compile handlebars template (and cache it)
    if ( this.templateNode == null ) this.templateNode   = Handlebars.compile(hPath);

    let nodehtml = this.templateNode(_node);
    this.app.get(rr, async (req, res) => { res.send(nodehtml); });

    return null;
  }


  /**
   * Break up the _route into objects, and store the _docdata at that point in this.docs.
   * If _docdata is null, then at least we know that the route exists, tho undocumented.
   *
   * @param {string} _route - rest path
   * @param {object} _docdata -  follows the DocPath or DocMethod schema, based upon _httpverb
   * @param {string} _httpverb - http verb, or null for Path documentation
   */
  onDoc(_route, _docdata, _httpverb = null) {
    // this.logger.aspect('listener.route', 'onDoc ', _route,  _httpverb, ': ', _docdata);
    //

    if ( this.funcs == null ) this.funcs = {};
    if ( _docdata.verb == null ) {
      this.logger.error(_docdata);
      throw Error('onDoc _docdata requires verb to be set');
    }
    else if ( _docdata.verb != 'protect' ) {
      // this.logger.info('adding func: ', _docdata.funcname, _route, _docdata.verb, _docdata);
      this.funcs[_docdata.funcname] = `"${_route}", ${_docdata.verb.toUpperCase()}`;
    }


    if ( !(_httpverb == null || this.verbs.indexOf(_httpverb) != -1) ) {
      this.logger.throwError(`Unknown http verb '${_httpverb}'.`);
      process.exit(1);
    }

    let paths = _route.split('/');
    let cur = this.docs;

    for (let i=1; i<paths.length; i++) {
      let p = paths[i];
      // this.logger.info('check : ', p, cur);
      if ( p == 'put' || p == 'get' || p == 'delete' || p == 'post' || p == 'options' ) {
        this.logger.warn(`using http method ${p} as part of route`);
      }
      if ( ! (p in cur) ) {
        // this.logger.info('  adding : ', p);
        cur[p] = {};
      }
      cur = cur[p];
    }


    if ( _httpverb == null ) {
      // console.log('base :', _route);
      if ( _docdata != null ) _docdata.route = _route;
      cur['base'] = _docdata;
    }
    else {
      cur[_httpverb] = _docdata;
      if ( cur['base'] == undefined ) cur['base'] = null;
    }

    // console.log('thedocs: ', JSON.stringify(this.docs, null, '  '));
  }


};


/**
 */
class DocPath {

  /**
   * @param {object} _options - additional options to pass to this object
   */
  constructor(_options) {
    let base = {
      route   : '',
      summary : '',
      desc    : '',
      docs    : [],
      methods : {}, // description of each method, via DocMethod object
      params  : [], // description of each param, via DocParam object
    };
    // this.options = Object.assign({}, base, _options);
    Object.assign(this, base, _options);
   // if ( this.options.route == null || this.options.route == '' ) {throw new Error('Needs a route');}
  }

  // toString() { return this.options; }
}

/**
 * Documentation of a path's method.
 *
 */
class DocMethod {

  /**
   * Documents a method.
   *
   * @param {object} _options -
   */
  constructor(_options) {
    let base = {
      summary    : null,    // quick summary of method
      filename   : null,    // filename where function is. Will be set by onX methods.
      funcname   : null,    // name of the function being called. Will be set by onX methods.
      handler    : null,    // actual function called
      desc       : null,    // more in-depth description of method
      verb       : null,    // one of this.verbs
      route      : null,    // the route without the domain but including root
      docs       : [],      // DocDoc
      params     : [],      // DocParam
      paramspost : [],      // DocParam for after called (only on onProtect)
      responses  : [],      // DocResp, indexed by useful keys
    };
    Object.assign(this, base, _options);

    // expand params object to an array of DocParams
    if ( typeof this.params == 'object' && Array.isArray(this.params) == false) {
      let p = [];
      for (let k in this.params ) { p.push(new DocParam({name : k, required : this.params[k]})); }
      this.params = p;
    }
  }
};


/**
 * Documentation of an externally linked document.
 *
 */
class DocDoc {

  /**
   * @param {object} _options} -
   */
  constructor(_options) {
    let base = {
      title : null,
      desc  : null,
      link  : null,
    };
    Object.assign(this, base, _options);
  }
};


/**
 * Documentaiton of a parameter.
 *
 */
class DocParam {

  /**
   * @param {object} _options} -
   */
  constructor(_options) {
    let base = {
      name     : null,
      desc     : null,
      in       : null,
      required : null,
    };
    Object.assign(this, base, _options);
  }
};


/**
 * Documentation of a response.
 *
 */
class DocResp {

  /**
   * @param {object} _options} -
   */
  constructor(_options) {
    let base = {
      name       : null,
      resptype   : null,
      desc       : null,
      attributes : [],  // DocParam
      example    : null,
    };
    // this.options = Object.assign(this, base, _options);
    Object.assign(this, base, _options);
  }
};


module.exports.WovReturn = WovReturn;
module.exports.DocPath   = DocPath;
module.exports.DocMethod = DocMethod;
module.exports.DocParam  = DocParam;
module.exports.DocResp   = DocResp;
module.exports.DocDoc    = DocDoc;

