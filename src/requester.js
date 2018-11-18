const fetch = require('node-fetch');
const WovReturn = require('./wovreturn');

module.exports = class Requester {

  /**
   * Attaches logger to this.
   * @param {Logger} _logger -
   * @param {url} _baseurl - If set, then all urls used to this requester are
   *                         considered paths and appended to this _baseurl.
   * @param {boo} _defaultContent - default, assumes json content
   */
  constructor(_logger, _baseurl = null, _defaultContent = 'application/json') {  // alt: text/html
    this.logger = _logger;
    this.logger.verbose(`init requester with baseurl ${_baseurl}`);
//    try { this.logger.throwError('where is this'); } catch(e) { console.log(e); }
    this._baseurl = _baseurl;

    // json by default, otherwise empty
    this.headerbase = {'Content-Type' : _defaultContent};

    // this.logger.info('...init Requester');
  };


  /**
   * does nothing unless overridden, but I like to call close to be clear
   **/
  close() { this._baseurl = null; this.logger = null; }


  /**
   * The main function that performs the request.
   * @param {string} _url -
   * @param {string} _method - http methods
   * @param {object} _headers - http headers
   * @param {object} _body - data
   * @param {bool} _rawresult - should this return the data or the result object
   * @return {object} - the result of the request, with http status and url appended
   */
  async request(_url, _method, _headers, _body, _rawresult = false, _throwOnError = false) {
    let retval = null;
    let fetchfail = false;
    this.logger.verbose(` url '${_url}'  baseurl '${this._baseurl}'  method '${_method}'`);
    let fullurl = (this._baseurl ? this._baseurl+_url: _url);
    this.logger.aspect('requester', `requester '${_method}' '${fullurl}' '${JSON.stringify(_body)}'`);
    let r = null;

    let fetchoptions = {
      method  : _method,
      headers : Object.assign({}, this.headerbase, _headers), // passed in override
    };
    if ( _body != null ) fetchoptions.body = (_body ? JSON.stringify(_body) : '');

    // this.logger.info('fetchOptions ', fetchoptions);
    this.logger.aspect('thread', `>>>transfer to ${fullurl}`);
    r = await fetch(fullurl, fetchoptions)
      .catch( (err) => {
        this.logger.aspect('thread', `<<<return to error from ${fullurl}`);
        this.logger.error(err);
        if ( _throwOnError ) { throw err; }
        else fetchfail = err.message;
      });
    this.logger.aspect('thread', `<<<return from ${fullurl}`);

    if ( fetchfail !== false ) {
      retval = WovReturn.retError(fetchfail);
      // retval = {success : false, status : 400, data : fetchfail};
    }
    else {
      if ( _rawresult) retval = r;
      else {
        try {
          this.logger.aspect('req.redirect', 'r returned ', r);

          // handle types of data: only json and html so far
          if ( this.headerbase['Content-Type'] == 'application/json' ) {
            retval = await r.json();
            // this.logger.info('json returned ', retval);
            if ( WovReturn.isValidWovReturn(retval) ) {
              // this.logger.info('just adding meta to json');
              WovReturn.addMeta(retval, {url : r.url});
              this.logger.info('code ', retval);
              retval.code = r.status; // adding back in
            }
            else if ( r.status == 200 ) {
              // this.logger.info('success');
              retval = WovReturn.retSuccess(retval, {url : r.url});
            }
            else {
              // this.logger.info('error ', r.status);
              retval = WovReturn.retError(retval);
              WovReturn.addMeta(retval, {url : r.url, status : r.status});
            }
            // this.logger.info('result is ', retval);
          }
          else if ( this.headerbase['Content-Type'] == 'text/html' ) {
            let html = await r.text();
            this.logger.aspect('req.redirect', 'text returned ', html);
            if      ( r.status == 200 ) { retval = WovReturn.retSuccess(html,  {url : r.url}); }
            else if ( r.status == 302 ) { retval = WovReturn.retRedirect(html, {url : r.url}); }
            else if ( r.status == 400 ) { 

              // --- check if json is returned for error returns
              try { let json = JSON.parse(html); retval = WovReturn.retError(json, null,    {url : r.url}); }
              catch (e) { retval = WovReturn.retError(html, null,    {url : r.url}); }

            }
            else { retval = WovReturn.retFail(html, r.status, 'unhandled http code', {url : r.url}); }
          }
          else { this.logger.error(`Unknown content type of '${this.headerbase['Content-Type']}'`); }
        }
        catch (e) {
          this.logger.error(e);
          // if ( _throwOnError ) {throw e;} else fetchfail = e.message;
          // just return the raw result
          retval = r;
        }
      }
    }
    return retval;
  }


  /**
   * RESTFUL Get
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
   * @return {promise}
   */
  async delete(url, headers, body, _rawresult = false) {
    // let fullurl = (this._baseurl ? this._baseurl+url: url);
    return this.request(url, 'delete', headers, body, _rawresult);
  }

};
