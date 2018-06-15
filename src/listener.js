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
   */
  constructor(_port, _logger, _staticdir = null) {
    this.port        = _port;
    this.server      = null; // set on listen
    this.logger      = _logger;
    this.staticdir   = _staticdir; // this is a relative path, appended to process.cwd()+'/'
    this.app         = null;
    this.islistening = false;
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
   * Helper function for listening, to standardize returns.
   *
   * This returns an object { success : <bool>, data : ... }. Success just means the call completed. It
   * could have completed in failure, but taht will be shown in the data attribute.
   *
   * NOTE: Not responding on error with error codes?
   * @param {*} _route
   * @param {*} _method
   * @param {string} _mfilename - name of method's file
   * @param {*} _args
   * @param {*} _res
   */
  async responseHandler(_route, _method, _mfilename, _args, _res) {
    this.logger.verbose(`...listener heard route: ${_route} ${_method}`);
    let fn = this.logger.trimpath(_mfilename, this.logger.options.trimTo); // _mfilename.split(this.logger.options.trimTo+'/')[1] || _mfilename;
    this.logger.aspect('listener-incoming', `Handling : '${_route}' with: '${fn}::${_method.name}' :`, _args);
    let result = {success : false};

    try {
      result.data    = await _method(_args, _res);
      result.success = true;
      this.logger.aspect('listener-result', '  ... result: ', result);

      // Check if response has been sent (or redirect(which requires a 302 status code))
      if (! _res.headersSent) {_res.json(result);}
    } catch (error) {
      this.logger.warn(error);
      result.error   = `${error}`;
      this.logger.warn(result);
      _res.json(result);
    }
  }


  /**
   * RESTFUL GET route managed with method.
   * @param {*} _route
   * @param {*} _method - method to call
   * @param {string} _mfilename - name of method's file
   */
  async onGet(_route, _method, _mfilename) {
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onGet ${_route} when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener', `onGet   : ${_route}`);
    this.app.get(_route, (req, res) => {
      this.responseHandler(_route, _method, _mfilename, Object.assign(req.query, req.params), res);
    });
  }


  /**
   * RESTFUL POST route managed with method.
   * @param {*} _route
   * @param {*} _method
   * @param {string} _mfilename - name of method's file
   */
  async onPost(_route, _method, _mfilename ) {
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onPost ${_route} when already listening.`);}
    if ( this.app == null ) {this.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener', `onPost  : ${_route}`);
    this.app.post(_route, (req, res) => {
      this.responseHandler(_route, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files), res );
    });
  };


  /**
   * RESTFUL PUT route managed with method.
   * @param {*} _route
   * @param {*} _method
   * @param {string} _mfilename - name of method's file
   */
  async onPut(_route, _method, _mfilename) {
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onPut ${_route} when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener', `onPut   : ${_route} ${_mfilename}`);
    this.app.put(_route, (req, res) =>
      this.responseHandler(_route, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files), res));
  }

  /**
   * RESTFUL DELETE route managed with method.
   * @param {*} _route
   * @param {*} _method
   * @param {string} _mfilename - name of method's file
   */
  async onDelete(_route, _method, _mfilename) {
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onDelete ${_route} when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener', `onDelete: ${_route} ${_mfilename}`);
    this.app.delete(_route, (req, res) =>
      this.responseHandler(_route, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files), res));
  }

};
