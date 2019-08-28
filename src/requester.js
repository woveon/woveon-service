const fetch = require('node-fetch');
const WovReturn = require('./wovreturn');
const Config = require('./config.js');

/**
 * @typedef Requester
 * @typedef Promise
 * @typedef Logger
 */

module.exports = class Requester {

  /**
   * Attaches logger to this.
   *
   * @param {Logger} _logger -
   * @param {string} _baseurl - If set, then all urls used to this requester are considered paths and appended to this _baseurl.
   * @param {boolean} _defaultContent - default, assumes json content
   */
  constructor(_logger, _baseurl = null, _defaultContent = 'application/json') {  // alt: text/html
    this.logger = _logger;
    this.logger.verbose(`init requester with baseurl ${_baseurl}`);
//    try { this.logger.throwError('where is this'); } catch(e) { console.log(e); }
    this._baseurl = _baseurl;
    this._onetimebaseurl= null;  // a one-time use url

    // json by default, otherwise empty
    this.headerbase = {'Content-Type' : _defaultContent};


    // this.logger.info('...init Requester');
  };


  /**
   * This does nothing unless overridden, but I like to call close to be clear.
   *
   * @return {undefined}
   **/
  close() { this._baseurl = null; this.logger = null; }


  /**
   * The main function that performs the request.
   *
   * @param {string} _url    - if baseurl is set, this is only the route. otherwise it is the full url, unless _onetimebaseurl is set
   * @param {string} _method - http methods
   * @param {object} _headers - http headers
   * @param {object} _body - data
   * @param {boolean} _rawresult - should this return the data or the result object
   * @param {boolean} _throwOnError -
   * @return {object} - the result of the request, with http status and url appended
   */
  async request(_url, _method, _headers, _body, _rawresult = false, _throwOnError = false) {
    let retval = null;
    let fetchfail = false;
    this.logger.verbose(` url '${_url}'  baseurl '${this._baseurl}'  method '${_method}'`);
    let fullurl = (this._onetimebaseurl ? this._onetimebaseurl+_url : (this._baseurl ? this._baseurl+_url: _url));
    this._onetimebaseurl = null;
    this.logger.aspect('requester', `requester '${_method}' '${fullurl}' '${JSON.stringify(_body)}'`);
    let r = null;

    let fetchoptions = {
      method  : _method,
      headers : Object.assign({}, this.headerbase, _headers), // passed in override
    };
    if ( _body != null ) fetchoptions.body = (_body ? JSON.stringify(_body) : '');

    // this.logger.info('fetchOptions ', fetchoptions);
    this.logger.aspect('requester.full', `url: ${fullurl} : `, fetchoptions);
    this.logger.aspect('thread', `>>>transfer to ${fullurl}`);
    r = await fetch(fullurl, fetchoptions)
      .catch( (err) => {
        this.logger.aspect('thread', `<<<return to error from ${fullurl}`);
        // this.logger.error(err);
        if ( _throwOnError ) { throw err; }
        else fetchfail = err.message;
      });
    this.logger.aspect('thread', `<<<return from ${fullurl}`);

    if ( fetchfail !== false ) {
      this.logger.aspect('requester.result', `  ... url: ${fullurl} : `, fetchfail);
      retval = WovReturn.retError(fetchfail);
      // retval = {success : false, status : 400, data : fetchfail};
    }
    else {
      this.logger.aspect('requester.result', `  ... url: ${fullurl} : `, r.ok, r.status);
      if ( _rawresult) retval = r;
      else {
        try {
          let contentmismatch = false;
          this.logger.aspect('ws.req.fail', 'r: ', r.ok);
          this.logger.aspect('ws.req.fail', 'r: ', r.status);
          this.logger.aspect('ws.req.fail', 'r: ', r.statusText);
          this.logger.aspect('ws.req.fail', 'r: ', r.headers.raw());
          this.logger.aspect('ws.req.fail', 'r: ', r.headers.get('content-type'));

          if ( r.ok == true ) {

            // ??? does this get skipped?
            if ( ! r.headers.get('content-type').startsWith(this.headerbase['Content-Type']) ) {
              this.logger.warn(`Content type mismatch: expected(${this.headerbase['Content-Type']}) received(${r.headers.get('content-type')})`);
              contentmismatch = true;
              if ( r.headers.get('content-type').startsWith('text/html') ) {
                retval = await r.text();
                this.logger.aspect('requester.resultfull', `  ... url: ${fullurl} : html: `, retval);
              }
              else if ( r.headers.get('content-type').startsWith('application/json') ) {
                retval = await r.json();
                this.logger.aspect('requester.resultfull', `  ... url: ${fullurl} : json: `, retval);
              }
              else {
                this.logger.throwError(`requester reply "${fullurl}": Unknown content-type : "${r.headers.get('content-type')}"`);
              }

            }

            // handle types of data: only json and html so far
            if ( this.headerbase['Content-Type'] == 'application/json' ) {
              if ( retval == null ) retval = await r.json();
              // this.logger.info('json returned ', retval);
              if ( WovReturn.isValidWovReturn(retval) ) {
                // this.logger.info('just adding meta to json');
                WovReturn.addMeta(retval, {url : r.url, contentmismatch});
                // this.logger.info('code ', retval);
                retval.code = r.status; // adding back in
              }
              else if ( r.status == 200 ) {
                // this.logger.info('success');
                retval = WovReturn.retSuccess(retval, {url : r.url});
                WovReturn.addMeta(retval, {contentmismatch});
              }
              else {
                // this.logger.info('error ', r.status);
                retval = WovReturn.retError(retval);
                WovReturn.addMeta(retval, {url : r.url, status : r.status});
                WovReturn.addMeta(retval, {contentmismatch});
              }
              // this.logger.info('result is ', retval);
            }
            else if ( this.headerbase['Content-Type'] == 'text/html' ) {
              let html = retval;
              if ( html == null ) html = await r.text();
              this.logger.aspect('req.redirect', 'text returned ', html);
              if      ( r.status == 200 ) { retval = WovReturn.retSuccess(html,  {url : r.url}); }
              else if ( r.status == 302 ) { retval = WovReturn.retRedirect(html, {url : r.url}); }
              else if ( r.status == 400 ) {

                // --- check if json is returned for error returns
                try { let json = JSON.parse(html); retval = WovReturn.retError(json, null,    {url : r.url}); }
                catch (e) { retval = WovReturn.retError(html, null,    {url : r.url}); }

              }
              else { retval = WovReturn.retFail(html, r.status, 'unhandled http code', {url : r.url}); }
              WovReturn.addMeta(retval, {contentmismatch});
            }
            else { this.logger.error(`Unknown content type of '${this.headerbase['Content-Type']}'`); }
          }
          else {
            retval = WovReturn.retFail(r.statusText);
          }
        }
        catch (e) {
          this.logger.error(e);
          this.logger.aspect('req.redirect', 'r: ', r.ok);
          this.logger.aspect('req.redirect', 'r: ', r.status);
          this.logger.aspect('req.redirect', 'r: ', r.statusText);
          this.logger.aspect('req.redirect', 'r: ', r.headers.raw());
          this.logger.aspect('req.redirect', 'r: ', r.headers.get('content-type'));
          // if ( _throwOnError ) {throw e;} else fetchfail = e.message;
          // just return the raw result
          retval = r;
        }
      }
    }
    this.logger.aspect('requester.resultfull', `  ... url: ${fullurl} : `, retval);
    return retval;
  }


  /**
   * RESTFUL Get
   *
   * @param {*} url -
   * @param {*} headers -
   * @param {*} _rawresult - should this retunull, null, rn the data or the result object
   * @return {promise}
   */
  async get(url, headers, _rawresult = false) {
    // let fullurl = (this._baseurl ? this._baseurl+url: url);
    return this.request(url, 'get', headers, null, _rawresult);
  }


  /**
   * RESTFUL Post
   * @param {*} url -
   * @param {*} headers -
   * @param {*} body
   * @param {*} _rawresult - should this return the data or the result object
   * @return {promise}
   */
  async post(url, headers, body, _rawresult = false) {
    // let fullurl = (this._baseurl ? this._baseurl+url: url);
    return this.request(url, 'post', headers, body, _rawresult);
  }


  /**
   * RESTFUL Put
   * @param {*} url -
   * @param {*} headers -
   * @param {*} body -
   * @param {*} _rawresult - should this return the data or the result object
   * @return {promise}
   */
  async put(url, headers, body, _rawresult = false) {
    // let fullurl = (this._baseurl ? this._baseurl+url: url);
    return this.request(url, 'put', headers, body, _rawresult);
  }


  /**
   * RESTFUL Delete
   * @param {*} url -
   * @param {*} headers -
   * @param {*} body -
   * @param {*} _rawresult - should this return the data or the result object
   * @return {Promise} -
   */
  async delete(url, headers, body, _rawresult = false) {
    // let fullurl = (this._baseurl ? this._baseurl+url: url);
    return this.request(url, 'delete', headers, body, _rawresult);
  }


  /**
   * Alters the base URL for next call to a request by setting the this._onetimebaseurl.
   *
   * @param {string} _msname - name of the microservice to send to
   * @return {Requester} - returns this so you can chain calls
   */
  toMSOnce(_msname) { this._onetimebaseurl = Requester.genMSUrl(_msname); return this; }

  /**
   * Alters the base URL for calls to a request by setting the this._baseurl.
   *
   * @param {string} _msname - name of the microservice to send to
   * @return {Requester} - returns this so you can chain calls
   */
  toMS(_msname) { let cur = this._baseurl; this._baseurl = Requester.genMSUrl(_msname) + cur; return this; }

  /**
   * Uses the WOV_www_api_url unless it is localhost, then it appends the port number of the MS running locally.
   *
   * @param {string} _msname - name of the microservice to send to
   * @return {string} - url ex. http://localhost:4024 or https://api-dev.mydomain.com
   */
  static genMSUrl(_msname) {
    let urlbase = Config.get('WOV_www_api_url');
    let urlscheme = Config.get('WOV_www_api_urlscheme');
    let retval = `${urlscheme}://${urlbase}`;
    if ( urlbase == 'localhost' ) retval += `:${Config.get(`WOV_${_msname}_port`)}`;
    retval += `/${_msname}/${Config.get(`WOV_${_msname}_ver`)}`;
    return retval;
  }

};

