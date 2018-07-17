const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');


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
   */
  constructor(_port, _logger, _staticdir = null, _root='') {
    this.port        = _port;
    this.server      = null; // set on listen
    this.logger      = _logger;
    this.staticdir   = _staticdir; // this is a relative path, appended to process.cwd()+'/'
    this.app         = null;
    this.islistening = false;
    this.root        = _root;
  };

  /**
   * Create and config the listening app.
   */
  async init() {

    if (this.app) {await this.close();}


    this.logger.verbose('  ... listener init');
    this.app = express();

    // serve static content if set
    if ( this.staticdir != null ) {
      let fullstaticdir = path.join(process.cwd()+'/'+this.staticdir);
      this.logger.verbose(`  ... serving static content on ${fullstaticdir}.`);
      this.app.use('/static', express.static(fullstaticdir));
    }

    this.app.use(bodyParser.json({limit : '50mb'}));
    this.app.use(bodyParser.urlencoded({extended : true, limit : '50mb'}));

    this.logger.verbose('  ... listener configure routes');
    let that = this;
    this.app.all('*', function(req, res, next) {
      // I think this works because shifted to function
      that.logger.aspect('listener', `*** Incoming (port ${that.port}): `+
        `'${req.originalUrl}' '${req.method}' from: '${req.ip}'`);

      // that.logger.verbose(req.params,req.query,req.body);
      if (Object.keys(req.params > 0).length) {that.logger.aspect('listener', '  : params : ', req.params);}
      if (Object.keys(req.query).length)      {that.logger.aspect('listener', '  :  query : ', req.query);}
      if (Object.keys(req.body).length)       {that.logger.aspect('listener', '  :   body : ', req.body);}
      if (req.files)                          {that.logger.aspect('listener', '  :  query : ', req.files);}

      res.header('Access-Control-Allow-Origin', req.headers.origin);
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Credentials', 'true');
      next();
    });
  };


  /**
   * Start up the app listening. Between init() and listen(), plugins can extend this Listener.
   * @return {promise}
   */
  async listen() {

    // this.logger.info('Listener called listen()'); console.trace();

    return new Promise((resolve, reject) => {

      // cap with a final error listener
      this.islistening = true;
      this.app.all('*', (req, res) => {
        this.logger.warn(`Failed to match '${req.method}' '${req.originalUrl}' ${this.port}`);
        res.status(404).json({success : false, data : null});
      });

      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        // this.service.port = this.server.address().port;
        this.address = this.server.address().address;
        this.logger.info(`  ... listener listening on port: ${this.port} `);
        resolve();
      })
        .on('error', (err) => {
          this.logger.info('3');
          this.logger.error(`Listener failed starting on port : ${this.port}`);
          reject(err);
        });
    });
  };


  /**
   * If this was listenining, close down.
   */
  async close() {
    if ( this.server ) {
      await this.server.close();
      this.server = null;
    }
  };


  /**
   * This checks that the passed in args have the _attr... val skipped for now.
   *
   * @param {object} _args -
   * @param {object} _attr -
   * @param {object} _val - unused at the moment
   * @return {Error} - Error or null
   */
  checkBodyAttribute(_args, _attr, _val) {
    let retval = new Error('Unknown'); // start in error state
    let attrs = _attr;
    let emsg  = '';
    if ( ! Array.isArray(attrs) )  attrs = [_attr];

    for (let i=0; i<attrs.length; i++) {
      if ( _args[attrs[i]] === undefined ) {
        emsg+= ` ${attrs[i]}`;
      }
    }

    console.log('checkBodyAtribure "', emsg, '"');
    if ( emsg == '' ) {
      retval = null;
    } else {
      retval = new Error('missing attributes:'+emsg);
      // let retobj = this.retError(new Error('missing attributes:'+emsg), 'Missing Attribute');
      // let code = retobj.code;
      // delete retobj.code;
      // _res.status(code).json(retobj).end();
    }

    return retval;
  }


  /**
   * Route succeeded.
   * @param {object}  _data - returned object
   * @return {object} - res object for sender
   */
  retSuccess(_data) {
    return {
      success : true,
      code    : 200,
      data    : _data,
    };
  }


  /**
   * Route had error in performing its function. NOTE: not a system level error
   * @param {object}  _data - returned object
   * @param {string}   _msg - message describing the failure
   * @return {object} - res object for sender
   */
  retError(_data, _msg='General Error') {
    return {
      success : false,
      code    : 200,
      data    : _data,
      msg     : _msg,
    };
  }


  /**
   * Route had system failure.
   * @param {object}  _data - returned object
   * @param {integer} _code - http response code
   * @param {string}   _msg - message describing the failure
   * @return {object} - res object for sender
   */
  retFail(_data, _code=400, _msg='Failure') {
    return {
      success : false,
      code    : _code,
      data    : _data,
      msg     : _msg,
    };
  }


  /**
   * Helper function for listening, to standardize returns.
   *
   * This returns an object { success : <bool>, data : ... }. Success just means the call completed. It
   * could have completed in failure, but taht will be shown in the data attribute.
   *
   * NOTE: Not responding on error with error codes?
   * @param {string} _route - full route
   * @param {*} _method
   * @param {string} _mfilename - name of method's file
   * @param {*} _args
   * @param {*} _res
   */
  async responseHandler(_route, _method, _mfilename, _args, _res) {
    this.logger.verbose(`...listener heard route: ${_route} ${_method}`);
    let fn = this.logger.trimpath(_mfilename, this.logger.options.trimTo); // _mfilename.split(this.logger.options.trimTo+'/')[1] || _mfilename;
    this.logger.h1('listener.incoming').aspect('listener.incoming', `Handling : '${_route}' with: '${fn}::${_method.name}' :`, _args);
    let result = {success : false};

    // call method and return result
    try {
      result = await _method(_args, _res);
      if ( !( result &&
              result.success !== undefined &&
              result.code !== undefined  &&
              result.data !== undefined ) ) {
        this.logger.throwError('Yo, method did not return proper object...'+
                          'call retSucces, retFail or retError\nmethod: ', _method, '\n : in', _mfilename);
      }

      this.logger.aspect('listener.result', '  ... result: ', result);
      _res.status(result.code);
      delete result.code;
      if (! _res.headersSent) {_res.json(result);}
        // --- Check if response has been sent
        //     (or redirect(which requires a 302 status code))

    } catch (error) {
      console.log(error);
      this.logger.warn(error);
      if ( process.env.WOV_STAGE != 'prod' ) result.error   = `${error}`;
      this.logger.warn(result);
      _res.status(400).json(result);
    }
  }


  /**
   * RESTFUL GET route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   */
  async onGet(_route, _method, _mfilename) {
    let rr = this.root + _route;
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onGet "${rr}" when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onGet   : ${rr}`);
    this.app.get(rr, (req, res) => {
      this.responseHandler(rr, _method, _mfilename, Object.assign(req.query, req.params), res);
    });
  }


  /**
   * RESTFUL POST route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   */
  async onPost(_route, _method, _mfilename ) {
    let rr = this.root + _route;
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onPost ${rr} when already listening.`);}
    if ( this.app == null ) {this.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onPost  : ${rr}`);
    this.app.post(rr, (req, res) => {
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files), res );
    });
  };


  /**
   * RESTFUL PUT route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   */
  async onPut(_route, _method, _mfilename) {
    let rr = this.root + _route;
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onPut ${rr} when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onPut   : ${rr} ${_mfilename}`);
    this.app.put(rr, (req, res) =>
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files), res));
  }

  /**
   * RESTFUL DELETE route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   */
  async onDelete(_route, _method, _mfilename) {
    let rr = this.root + _route;
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onDelete ${rr} when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onDelete: ${rr} ${_mfilename}`);
    this.app.delete(rr, (req, res) =>
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files), res));
  }

};
