

/**
 * Created a class so I can do 'instanceof WovReturn'
 */
module.exports = class WovReturn {

  /**
   * Create the object, just a container for data.
   *
   * @param {object} _data - success, code, data, msg
   */
  constructor(_data) {
    this.success = _data.success;  // success/fail is based on function, not connection
    this.code    = _data.code;     // http codes for connection success/fail
    this.data    = _data.data;
    this.msg     = _data.msg;
    if (this.msg == null ) delete this.msg;
  }


  /**
   * Utility function to push to string.
   * (i.e. data usually not shown with typical toString function).
   * @return {string} - json stringified view of this
   */
  ts() {return JSON.stringify(this, null, '  ');}


  /**
   * Route succeeded.
   * @param {object}  _data - returned object
   * @return {object} - res object for sender
   */
  static retSuccess(_data) {
    return new WovReturn({
      success : true,
      code    : 200,
      data    : _data,
    });
  }


  /**
   * Redirect to path.
   * @param {string} _path - the redirect URL
   * @return {object} - res object for sender
   */
  static retRedirect(_path) {
    return new WovReturn({
      success : true,
      code    : 302,
      data    : _path,
    });
  }


  /**
   * Route had error in performing its function. NOTE: not a system level error
   * @param {object}  _data - returned object
   * @param {string}   _msg - message describing the failure
   * @return {object} - res object for sender
   */
  static retError(_data, _msg='General Error') {
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
  static retFail(_data, _code=400, _msg='Failure') {
    return new WovReturn({
      success : false,
      code    : _code,
      data    : _data,
      msg     : _msg,
    });
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
  static checkAttributes(_args, _attr, _val, _options = {
      retRawError : false,  // - on true, instead returns Error object
      checkStrict : true,   // - toggles strict enforcement of only named _attr
                            //   should exist. when false, only checks _attr provided.
    } ) {

    let retval = null; // new Error('Unknown'); // start in error state
    let attrs = _attr;
    let emsg  = {missing : [], unexpected : [] };

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
      if ( _options.retRawError == false ) {
        emsg.args = _args;
        emsg.attrs = attrs;
        retval = this.retError(emsg, `ERROR: attribute failure`);
      }
      else { retval = new Error(emsg); }
    }

    return retval;
  }

};
