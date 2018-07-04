const fetch = require('node-fetch');

module.exports = class Requester {

  /**
   * Attaches logger to this.
   * @param {Logger} _logger -
   * @param {url} _baseurl - If set, then all urls used to this requester are
   *                         considered paths and appended to this _baseurl.
   * @param {boo} _defaultContent - default, assumes json content
   */
  constructor(_logger, _baseurl = null, _defaultContent = 'application/json') {
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
  close() {this._baseurl = null; this.logger = null;}

  /**
   * The main function that performs the request.
   * @param {string} _url -
   * @param {string} _method - http methods
   * @param {object} _headers - http headers
   * @param {object} _body - data
   * @param {bool} _rawresult - should this return the data or the result object
   * @return {promise} - a Promise that returns the result.
   */
  async request(_url, _method, _headers, _body, _rawresult = false) {
    let retval = null;
    this.logger.verbose(` url '${_url}'  baseurl '${this._baseurl}'`);
    let fullurl = (this._baseurl ? this._baseurl+_url: _url);
    this.logger.aspect('requester', `requester '${_method}' '${fullurl}' '${JSON.stringify(_body)}'`);
    let r = null;

    r = await fetch(fullurl, {
      method  : _method,
      headers : Object.assign(this.headerbase, _headers),
      body    : _body ? JSON.stringify(_body) : '',
    })
    .catch( (err) => {this.logger.error(err); throw err;});

    if ( _rawresult) retval = r;
    else {retval = await r.json(); retval.status = r.status;}
    return retval;
  }


  /**
   * RESTFUL Get
   * @param {*} url -
   * @param {*} headers -
   * @param {*} _rawresult - should this return the data or the result object
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
