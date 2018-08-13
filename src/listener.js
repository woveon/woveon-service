const express    = require('express');
const bodyParser = require('body-parser');
const path       = require('path');
const Handlebars = require('Handlebars');


/**
 * Created a class so I can do 'instanceof WovReturn'
 */
class WovReturn {

  /**
   * Create the object, just a container for data.
   *
   * @param {object} _data - success, code, data, msg
   */
  constructor(_data) {
    this.success = _data.success;
    this.code    = _data.code;
    this.data    = _data.data;
    this.msg     = _data.msg;
    if (this.msg == null ) delete this.msg;
  }
};


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

    this.docs        = {};
    this.views       = {};
    this.templateNode = null;
    this.verbs = ['get', 'post', 'put', 'delete'];
  };


  /**
   * Latch on to an existing express app.
   */
  async initWithApp(_app) {
    this.externalapp = true;
    if (this.app) {await this.close();}
    this.app = _app;
    this.logger.verbose('  ... listener inited with external app, assuming is listening');
  }


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

    this.logger.info('listen :: resolveDocs');
    try {
      this._resolveDocs();
    } catch (e) {
      console.log(e);
      console.trace();
      throw new Error('failed to resolve Docs');
    }
    this.logger.info('2listen :: resolveDocs');

    if ( this.externalapp == true ) {this.islistening = true; return Promise.resolve();}

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
   * @return {Error/retError} - null on success or Error/retError depending on _retError
   */
  checkBodyAttribute(_args, _attr, _val, _retRawError= false) {
    let retval = new Error('Unknown'); // start in error state
    let attrs = _attr;
    let emsg  = '';
    if ( ! Array.isArray(attrs) )  attrs = [_attr];

    for (let i=0; i<attrs.length; i++) {
      if ( _args[attrs[i]] === undefined ) {
        emsg+= ` ${attrs[i]}`;
      }
    }

    // console.log('checkBodyAtribure "', emsg, '"');
    if ( emsg == '' ) {
      retval = null;
    } else {
      retval = new Error('Missing attribute:'+emsg);
      if ( _retRawError == false ) {
        retval = this.retError({args : _args, attr : _attr}, retval.message);
      }
    }

    return retval;
  }


  /**
   * Route succeeded.
   * @param {object}  _data - returned object
   * @return {object} - res object for sender
   */
  retSuccess(_data) {
    return new WovReturn({
      success : true,
      code    : 200,
      data    : _data,
    });
  }


  /**
   * Route had error in performing its function. NOTE: not a system level error
   * @param {object}  _data - returned object
   * @param {string}   _msg - message describing the failure
   * @return {object} - res object for sender
   */
  retError(_data, _msg='General Error') {
    return new WovReturn({
      success : false,
      code    : 200,
      data    : _data,
      msg     : _msg,
    });
  }


  /**
   * Route had system failure.
   * @param {object}  _data - returned object
   * @param {integer} _code - http response code
   * @param {string}   _msg - message describing the failure
   * @return {object} - res object for sender
   */
  retFail(_data, _code=400, _msg='Failure') {
    return new WovReturn({
      success : false,
      code    : _code,
      data    : _data,
      msg     : _msg,
    });
  }


  /**
   * Helper function for listening, to standardize returns.
   *
   * This returns an object { success : <bool>, data : ... }. Success just means the call completed. It
   * could have completed in failure, but taht will be shown in the data attribute.
   *
   * NOTE: Not responding on error with error codes?
   * @param {string} _route - full route
   * @param {*} _method - a function that returns WovReturn, or an object/value, with success assumed
   * @param {string} _mfilename - name of method's file
   * @param {*} _args
   * @param {*} _res
   * @param {object} _options - further instructions to this handler
   */
  async responseHandler(_route, _method, _mfilename, _args, _res, _options = {}) {
    this.logger.info('asdfadsfadf: ', _route);
    this.logger.verbose(`...listener heard route: ${_route} ${_method}`);
    let fn = this.logger.trimpath(_mfilename, this.logger.options.trimTo); // _mfilename.split(this.logger.options.trimTo+'/')[1] || _mfilename;
    this.logger.aspect('listener.incoming', `Handling : '${_route}' with: '${fn}::${_method.name}' :`, _args);
    let result = {success : false};

    // call method and return result
    try {
      if ( typeof _method === 'function' ) {
        result = await _method(_args, _res);
      } else {
        this.logger.info('jus data', _method);
        result = this.retSuccess(_method);
      }

      if ( result == null || (! result instanceof WovReturn) ) {
        this.logger.throwError(
          'Method did not return WovReturn object. Call retSucces, retFail or retError\n'+
          '  result  : ', JSON.stringify(result, null, '  '), '\n'+
          '  @route  : ', _route, '\n'+
          '  @method : ', _method, '\n'+
          '  @file   : ', _mfilename);
      }

      // perform any additional actions, based upon _options
      if ( _options.addRoute == true ) {
        this.logger.info('adding route : ', _route);
        result.data.route = _route;
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
   * This 'protects' a route you pass in, selected from root, and any variables you
   * return in _method are then passed to your regular leaf function.
   *
   *   ex. /user/:sessionid/widgets/:widgetid  - use onRoute('/user/:sessionid') to
   *       make calls to databases to see if session is valid, then return userid
   *       so the leaf method can lookup and see if user can access that widget.
   *
   * NOTE: vals stored in _req.wov.
   */
  async onRoute(_route, _method) {
    this.logger.aspect('listener.route', `onRoute : ${_route}`);
    this.app.use(_route, async function(_req, _res, next) {
      let args = Object.assign(_req.query, _req.params, _req.body, _req.files, _req.wov);
      let result = await _method(args, _res);

      if ( result instanceof WovReturn ) {
        _res.status(result.code);
        delete result.code;
        if (! _res.headersSent) {_res.json(result);}
        return next(result);
      } else if ( result instanceof Error ) {
        this.logger.throwError(result);
      } else {
        // add in params
        _req.wov = Object.assign({}, _req.wov, result);
      }
      return next();
    }.bind(this));
  }


  /**
   * RESTFUL GET route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   * @param {Docmethod} _docMethod - documentation of this method
   */
  async onGet(_route, _method, _mfilename, _docMethod = null) {
    if ( _mfilename == null ) {this.logger.throwError('Need to append "__filename" to listener function.');}
    let rr = this.root + _route;
    this.onDoc(rr, _docMethod, 'get');

    if ( this.islistening ) {this.logger.throwError(`calling Listener.onGet "${rr}" when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onGet   : ${rr}`);

    this.app.get(rr, (req, res) => {
      this.responseHandler(rr, _method, _mfilename, Object.assign(req.query, req.params, req.wov), res);
    });
  }


  /**
   * RESTFUL POST route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   * @param {Docmethod} _docMethod - documentation of this method
   */
  async onPost(_route, _method, _mfilename, _docMethod = null ) {
    if ( _mfilename == null ) {this.logger.throwError('Need to append "__filename" to listener function.');}
    let rr = this.root + _route;
    this.onDoc(rr, _docMethod, 'post');

    if ( this.islistening ) {this.logger.throwError(`calling Listener.onPost ${rr} when already listening.`);}
    if ( this.app == null ) {this.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onPost  : ${rr}`);
    this.app.post(rr, (req, res) => {
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files, req.wov), res );
    });
  };


  /**
   * RESTFUL PUT route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   * @param {Docmethod} _docMethod - documentation of this method
   */
  async onPut(_route, _method, _mfilename, _docMethod = null) {
    if ( _mfilename == null ) {this.logger.throwError('Need to append "__filename" to listener function.');}
    let rr = this.root + _route;
    this.onDoc(rr, _docMethod, 'put');

    if ( this.islistening ) {this.logger.throwError(`calling Listener.onPut ${rr} when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onPut   : ${rr} ${_mfilename}`);
    this.app.put(rr, (req, res) =>
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files, req.wov), res));
  }

  /**
   * RESTFUL DELETE route managed with method.
   * @param {string} _route - partial route, appended to this.root
   * @param {function} _method - method to call
   * @param {string} _mfilename - name of method's file
   * @param {Docmethod} _docMethod - documentation of this method
   */
  async onDelete(_route, _method, _mfilename, _docMethod = null) {
    if ( _mfilename == null ) {this.logger.throwError('Need to append "__filename" to listener function.');}
    let rr = this.root + _route;
    this.onDoc(rr, _docMethod, 'delete');

    if ( this.islistening ) {this.logger.throwError(`calling Listener.onDelete ${rr} when already listening.`);}
    if ( this.app == null ) {this.logger.throwError('failed to call init() on this listener.');}
    this.logger.aspect('listener.route', `onDelete: ${rr} ${_mfilename}`);
    this.app.delete(rr, (req, res) =>
      this.responseHandler(rr, _method, _mfilename,
        Object.assign(req.query, req.params, req.body, req.files, req.wov), res));
  }


  /**
   * Take the DocPath objects in this.docs and turn in to html to be served.
   */
  _resolveDocs() {
    if ( this.islistening ) {this.logger.throwError(`calling Listener.onDoc "${rr}" when already listening.`);}
    if ( this.app == null ) {this.logger.info('here'); this.logger.throwError('failed to call init() on this listener.');}

    let cur = this.docs;
    let innerhtml = this._resolveDocNode(cur, ''); // create a page for each
    // this.logger.info('innerhtml2: ', innerhtml);
    this._renderDocOverview(innerhtml);            // create the overview
  }


  /**
   * @param {object} _cur - a node of this.docs
   * @param {string} _curpath - current route leading to this _cur node
   * @return {string} - endpoints
   */
  _resolveDocNode(_cur, _curpath) {
    let retval = '';
    let endpointTemplate = `
<div>
  <div>{{#if hasPage}}<a href='{{docroute}}'>{{/if}}{{route}} - {{#each vlist}}{{this}} {{/each}}{{#if hasPage}}</a>{{/if}}
  {{#if summary}}
  <div style='margin-left: 15px'><i>{{summary}}</i></div>
  {{/if}}
</div>
`;
    let compiledTemplate = Handlebars.compile(endpointTemplate);

    this.logger.info(`_resolveDocNode: ${_curpath}`);

    // build the end node path with all the verbs
    if ( _cur.hasOwnProperty('base') ) {
      let node = _cur['base'];
      let dataOverview = {
        route    : this.root+_curpath,
        docroute : this.root+'/doc'+_curpath,
      };
      if (node == null) {
        node = new DocPath({
          route   : _curpath,
          summary : '',
          desc    : '',
          methods : {},
          params  : [],
        }).options;
      } else {
        dataOverview.hasPage = true; // has has path page, then link
      }
      if ( node.summary ) dataOverview.summary = node.summary;

      let vlist = [];
      for (let vi in this.verbs ) {
        if ( _cur.hasOwnProperty(this.verbs[vi]) ) {
          let verb = this.verbs[vi];
          vlist.push(verb);
          this.logger.info(' -- has proerpty ', verb, ' ',  _cur.hasOwnProperty(verb) );

          if ( node.methods[verb] != null ) {
            if ( _cur[verb] != null ) {
              this.logger.warn(`Two definitions: Conflict ${_curpath} - ${verb}.`);
              node.methods[verb] = _cur[verb];
              dataOverview.hasPage = true; // has verb path page, then link
            } else {
              // do nothing. _cur[verb] is null, just holding place, letting us know a route existed
              // this.logger.info(` -- ${_curpath} : no doc for route ${verb}`);
            }
          } else {
            if ( _cur[verb] != null ) {
              // this.logger.info(` -- ${_curpath} : adding ${verb}`);
              node.methods[verb] = _cur[verb];
              dataOverview.hasPage = true; // has verb path page, then link
            } else {
              // this.logger.info(` -- ${_curpath} : creating ${verb}`);
              node.methods[verb] = new DocMethod({
                summary   : null,
                desc      : null,
                docs      : [],
                params    : [],
                responses : {},
              }).options;
              // dataOverview.hasPage = true; // has verb path page, then link
            }
          }
        }
      }

      // add  line to the overview page
      dataOverview.vlist = vlist;
      let r = compiledTemplate(dataOverview);
      // this.logger.info(' - ', r);
      retval += r;

      this.logger.info(`${_curpath} PATH: `, node);
      this._renderEndpoint(_curpath, node);
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
          } else {
            this.logger.info(` what is this??? `, k, r);
            console.trace();
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
    let rawTemplateBody= `
<html>
<head>
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
</head>
<body>


<div class='container'>
  <h1>{{name}} - Documentation</h1>
  {{{innerhtml}}}
</div>

  <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
</body>
</html>
 `;

    // compile handlebars template (and cache it)
    let templateBody   = Handlebars.compile(rawTemplateBody);

    let bodyhtml = templateBody({innerhtml : _innerhtml, name : this.name});
    // this.logger.info('innerhtml = ', _innerhtml);
    // this.logger.info('bodyhtml = ', bodyhtml);
    this.app.get(this.root + '/doc', async (req, res) => {res.send(bodyhtml);});
  }

  /**
   * This documents an endpoint, to return when the endpoint is reached.
   *
   * @param {string} _route - path to get to endpoint
   * @param {object} _node - node containg data of the endpoing, all methods
   */
  _renderEndpoint(_route, _node) {
    let rr = this.root + '/doc' + _route;

    // create static html
    this.logger.aspect('listener.route', `onDoc   : ${rr} - GET`);

    // Templates for Handlebars
    let hPath = `
<html>
<head>
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
</head>
<body>

<div class='container'>
  <div><a href='${this.root}/doc' class='btn btn-primary'>back</a></div>

  <h1>{{route}}</h1>

  <blockquote>{{summary}}</blockquote>

  <p><strong>Description</strong>: {{desc}}</p>

  {{#if docs}}
  <div class='wov-docs'>
  {{#each docs}}
    <dt>Document: <a href="{{link}}" target="_blank">{{title}}</a></dt>
    <dd>{{description}}</dd>
  {{/each}}
  </div> <!-- end wov-docs -->
  {{/if}}

  {{#if params}}
  <div class='container-params'>
  {{#each params}}
    <dt>Param: {{name}}{{#if in}} - in {{in}}{{/if}}{{#if required}}<strong> (required)</strong><br />{{/if}}</dt>
    <dd>{{desc}}</dd>
  {{/each}}
  </div>
  {{/if}}

  <div class='container container-methods'>
    {{#each methods}}
    <div>

      <h2 style='text-transform: uppercase;'>{{@key}}</h2>
      <p><i>{{summary}}</i></p>
      {{#if desc}}<p><strong>Description</strong>: {{desc}}</p>{{/if}}

      {{#if docs}}
      <div class='wov-docs'>
      {{#each docs}}
        <dt>Document: <a href="{{link}}" target="_blank">{{title}}</a></dt>
        <dd>{{description}}</dd>
      {{/each}}
      </div> <!-- end wov-docs -->
      {{/if}}

      {{#if params}}
      <div class='wov-params'>
      {{#each params}}
        <dt>Parameter: {{name}}{{#if in}} - in {{in}}{{/if}}{{#if required}}<strong> (required)</strong><br />{{/if}}</dt>
        <dd>{{desc}}</dd>
      {{/each}}
      </div> <!-- ends wov-params -->
      {{/if}}

      {{#if responses}}
      <div>
      {{#each responses}}
        <div><strong>{{@key}} Response</strong>: {{desc}}</div>
      {{/each}}
      </div>
      {{/if}}

    </div> <!-- ends method -->
    {{/each}}
  </div> <!-- ends container-methods -->

  <script src="https://code.jquery.com/jquery-3.2.1.slim.min.js" integrity="sha384-KJ3o2DKtIkvYIK3UENzmM7KCkRr/rE9/Qpg6aAZGJwFDMVNA/GpGFF93hXpG5KkN" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>

</body>
</html>
`;

    // compile handlebars template (and cache it)
    if ( this.templateNode == null ) this.templateNode   = Handlebars.compile(hPath);

    let nodehtml = this.templateNode(_node);
    this.app.get(rr, async (req, res) => {res.send(nodehtml);});
  }
  /*
    // get data
    / *
    let d = null;
    if (typeof _doc === 'function') {
      d = await _doc(Object.assign(req.query, req.params, req.wov));
    } else d = {data : _doc};
    * /
    _doc.route = rr;

    // callback for data object
    this.app.report(rr, (req, res) => {
      let dd = d;
      this.logger.info('hit callback: ', rr);
      this.responseHandler(rr, dd, _mfilename,
        Object.assign(req.query, req.params, req.wov), res, {addRoute : true});
    });


      this._addDocRoute(rr, null, v);

      // normal response
      res.status(200);
      res.send(v);
      res.end();
    });
  }
  */


  /**
   * Break up the _route into objects, and store the _docdata at that point in this.docs.
   * If _docdata is null, then at least we know that the route exists, tho undocumented.
   *
   * @param {string} _route - rest path
   * @param {object} _docdata -  follows teh DocPath or DocMethod schema, based upon _httpverb
   * @param {string} _httpverb - http verb, or null for Path documentation
   */
  onDoc(_route, _docdata, _httpverb = null) {
    this.logger.info('onDoc ', _route,  _httpverb, ': ', _docdata);

    if ( !(_httpverb == null || this.verbs.indexOf(_httpverb) != -1) ) {
      this.logger.throwError(`Unknown http verb '${_httpverb}'.`);
      process.exit(1);
    }

    let paths = _route.split('/');
    let cur = this.docs;

    console.log('paths: ', paths, '  from ', _route);

    for (let i=1; i<paths.length; i++) {
      let p = paths[i];
      // console.log(`  p: '${p}'    cur: ${Object.keys(cur)}`);
      if ( ! (p in cur) ) {
        // console.log(`  --- add '${p}'`);
        cur[p] = {};
      }
      cur = cur[p];
      // console.log('  cur now ', cur);
    }


    if ( _httpverb == null ) {
      console.log('base :', _route);
      if ( _docdata != null ) _docdata.route = _route;
      cur['base'] = _docdata;
    } else {
      console.log(_httpverb+' :', _route);
      cur[_httpverb] = _docdata;
      if ( cur['base'] == undefined ) cur['base'] = null;
    }

    console.log('thedocs: ', JSON.stringify(this.docs, null, '  '));
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
    this.options = Object.assign({}, base, _options);
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
   * @param {object} _options} -
   */
  constructor(_options) {
    let base = {
      summary   : null,
      desc      : null,
      docs      : [],
      params    : [],
      responses : {},
    };
    this.options = Object.assign({}, base, _options);
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
    this.options = Object.assign({}, base, _options);
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
    this.options = Object.assign({}, base, _options);
  }
};


/**
 * Documentaiton of a response.
 *
 */
class DocResp {

  /**
   * @param {object} _options} -
   */
  constructor(_options) {
    let base = {
      desc : null,
    };
    this.options = Object.assign({}, base, _options);
  }
};


module.exports.WovReturn = WovReturn;
module.exports.DocPath   = DocPath;
module.exports.DocMethod = DocMethod;
module.exports.DocParam  = DocParam;
module.exports.DocResp   = DocResp;

