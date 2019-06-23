
const Logger = require('woveon-logger');

/**
 * Created a class so I can do 'instanceof WovReturn'
 */
module.exports = class WovReturn {

  /**
   * Create the object, just a container for data.
   *
   * @param {object} _data - success, code, data, msg
   */
  constructor(_data, _meta = null) {
    this.success = _data.success;  // success/fail is based on function, not connection
    this.code    = _data.code;     // http codes for connection success/fail
    this.data    = _data.data;
    this.msg     = _data.msg;
    if (this.msg == null ) delete this.msg;

    if ( _data.error ) this.error = _data.error;
    if ( _meta != null ) this.meta = _meta; // if has it
  }


  /**
   * Utility function to push to string.
   * (i.e. data usually not shown with typical toString function).
   * @return {string} - json stringified view of this
   */
  ts() { return JSON.stringify(this, null, '  '); }


  /**
   * Utility function to see if the object follows the WovReturn format (not an 'instanceof' check).
   * Checks by looking for code, data and success.
   * Useful for return value checks.
   * NOTE: 'code' can be stripped on returns, since it is put into status code
   * @param {object} _obj - checked object
   * @return {boolean} - true if should be considered a WovReturn
   */
  static isValidWovReturn(_obj) {
    if ( _obj == null ) return false;
    if ( _obj.data === undefined || _obj.success === undefined ) return false;
    return true;
  }


  /**
   * Sets meta data.
   * @param {object} _wr - wov return object
   * @param {object} _meta - merges into existing meta
   */
  static addMeta(_wr, _meta) { if ( _wr.meta === undefined ) _wr.meta = {}; Object.assign(_wr.meta, _meta); }


  /**
   * Route succeeded.
   * @param {object}  _data - returned object
   * @param {object}  _meta - metadata about the returned object (ex. for fetch, a url)
   * @return {object} - res object for sender
   */
  static retSuccess(_data, _meta = null) {
    return new WovReturn({
      success : true,
      code    : 200,
      data    : _data,
    }, _meta);
  }


  /**
   * Redirect to path.
   * @param {string} _path - the redirect URL
   * @param {object}  _meta - metadata about the returned object (ex. for fetch, a url)
   * @return {object} - res object for sender
   */
  static retRedirect(_path, _meta = null) {
    return new WovReturn({
      success : true,
      code    : 302,
      data    : _path,
    }, _meta);
  }


  /**
   * Route had error in performing its function. NOTE: not a system level error
   * @param {object}  _data - returned object
   * @param {string}   _msg - message describing the failure
   * @param {object}  _meta - metadata about the returned object (ex. for fetch, a url)
   * @return {object} - res object for sender
   */
  static retError(_data, _msg='General Error', _meta = null) {
    return new WovReturn({
      success : false,
      code    : 200,
      data    : _data,
      msg     : _msg,
    }, _meta);
  }


  /**
   * Create a file with these errors and load it. Should be of format:
   *   { ERRORCODE : { code : XXX, text : string }, ... }
   * @param {Object} _errordefs - a hash of all the errors
   */
  static defineCodedErrors(_errordefs) { WovReturn._errordefs = _errordefs; }


  /**
   * @param {string} _errcode - The identifying name of the code.
   * @param {object} _data - returned object
   * @param {string}  _msg - message describing the failure
   * @param {object}  _meta - metadata about the returned object (ex. for fetch, a url)
   * @return {object} - res object for sender
   */
  static retCodedError(_errname, _data, _msg, _meta = null) {
    if ( WovReturn._errordefs == undefined ) {
      throw new Error(`WovReturn::retCodedError: no error definitions; need to call defineCodedErrors`);
    }
    let ec = WovReturn._errordefs[_errname];
    if ( ec == null ) { throw new Error(`WovReturn::retCodedError: unknown error of '${_errname}'.`); }
    let retval = new WovReturn({
      success : false,
      code    : 200,
      data    : _data,
      error   : {code : ec.code, name : _errname, text : ec.text},
      msg     : `ERROR(${ec.code}) '${_errname}': ${ec.text}\n  ${_msg}.`,
    }, _meta);
    return retval;
  }


  /**
   * Route had system failure.
   * @param {object}  _data - returned object
   * @param {integer} _code - http response code
   * @param {string}   _msg - message describing the failure
   * @param {object}  _meta - metadata about the returned object (ex. for fetch, a url)
   * @return {object} - res object for sender
   */
  static retFail(_data, _code=400, _msg='Failure', _meta = null) {
    return new WovReturn({
      success : false,
      code    : _code,
      data    : _data,
      msg     : _msg,
    }, _meta);
  }

  /**
   * DEPRECATED
   */
  static checkAttributes(_args, _attr, _val, _options = {
      retRawError : false,  // - on true, instead returns Error object
      checkStrict : true,   // - toggles strict enforcement of only named _attr
  }) {
    Logger.g().logDeprecated('woveon-service.WovReturn.checkAttributes: use checkProperties');
    return WovReturn.checkProperties(_args, _attr, _val, _options);
  }

  /**
   * This checks that the passed in args have the _attr... val skipped for now.
   *
   * @param {object} _args - argument object to check
   * @param {object} _attr - The attributes to check. If array, all are required.
   *                         If hash, then check boolean to see if required or not.
   *                         If string, assume required.
   * @param {object} _val - unused at the moment
   * @param {boolean} _options - options to change behavior
   * @return {Error/retError} - null on success or Error/retError depending on _retError
   */
  static checkProperties(_args, _attr, _val, _options = {
      retRawError : false,  // - on true, instead returns Error object
      checkStrict : true,   // - toggles strict enforcement of only named _attr
                            //   should exist. when false, only checks _attr provided.
    } ) {

    let retval = null; // new Error('Unknown'); // start in error state
    let attrs = _attr;
    let emsg  = {missing : [], unexpected : [] };

    if ( _args == null ) {
      retval = this.retError(emsg, `ERROR: checkAttributes called with null object (_args is null).`);
    }

    if ( retval == null ) {

      // convert string/array to hash, assuming true
      if ( typeof _attr == 'string' ) { attrs = {}; attrs[_attr] = true; }
      else if ( Array.isArray(_attr) )  {
        attrs = {}; _attr.forEach((e) => {
          // console.log('setting ', e);
          attrs[e] = true;
        });
      }

      //    console.log('_args: ', _args);
      //    console.log('attrs: ', attrs);

      // check all in args are in acceptable attrs (required or not)
      if ( _options.checkStrict == true ) {
        for (let k in _args) {
          // console.log('sadf: k ', k, attrs);
          if ( attrs[k] === undefined ) { emsg.unexpected.push(k); }
        }
      }
      // check all required attrs are in args
      for (let k in attrs) {
        // console.log('check : ', k, _args[k]);
        if ( attrs[k] == true && _args[k] === undefined) {
          // console.log('err');
          emsg.missing.push(k);
        }
      }

      //    console.log('checkBodyAtribure "', emsg, '"');
      if ( emsg.missing.length == 0 && emsg.unexpected.length == 0 ) { retval = null; }
      else {
        // console.log('consoleCheckAttributes: ', JSON.stringify(emsg));
        if ( _options.retRawError == true ) { retval = new Error(JSON.stringify(emsg)); }
        else {
          emsg.args = _args;
          emsg.attrs = attrs;
          retval = this.retError(emsg, `ERROR: attribute failure`);
        }
      }
    }

    return retval;
  }

};
