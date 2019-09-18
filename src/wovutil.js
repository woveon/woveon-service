const uuidv4         = require('uuid/v4');
const CryptoJS       = require('crypto-js'); // library with convenient syntax

const Service        = require('./index');


/**
 * @typedef int
 */

// const Logger = require('woveon-logger');

module.exports = {

  /**
   * Call to bind methods from one file to the object.
   *
   * This takes all the functions defined in this file and binds them to this object. If the functions are a DocMethod, then
   * the handler is bound. If _placedonobj is defined, the bound functions are placed on this object but it defaults to the
   * _bindobj.
   *
   * The utilty of this is to allow development in multiple files and then reorganize them at runtime under your own conventions.
   * So, for example, microservice M has an Application Layer (M.al) and a State Layer (M.statelayer). I attach all application functinos
   * to the Application Layer, but bind them to the microservice so they have access to all default functions there and the
   * state layer.  ex. bindObjectFunctionsToObject( myapplicationfunctions, M, M.al);
   *
   * ex. A = {a : 1}, B = {a : 2}, C = function() { return this.a; }
   *
   * bindObjectFunctionsToObject(C, A);
   * - console.log(A.C()); // 1
   *
   * bindObjectFunctionsToObject(C, A, A);
   * - console.log(A.C()); // 1
   *
   * bindObjectFunctionsToObject(C, A, B);
   * - console.log(A.C()); // error, function is not on A
   * - console.log(B.C()); // 2
   *
   * @param {object} _funcs - an object of DocMethods or functions, where the keys are the controller names.
   * @param {object} _bindobj - the target object where the functions become bound.
   * @param {object} _placedonobj - the target object where the functions are placed. defaults to _bindobj.
   * @return {null} - no return
   */
  bindObjectFunctionsToObject(_funcs, _bindobj, _placedonobj = null) {

    if ( _placedonobj == null ) _placedonobj = _bindobj;

    for (let k in _funcs) {
      if ( _funcs.hasOwnProperty(k) ) {

        // Logger.g().info(`bind function ${k}`);
        let f = _funcs[k];
        if ( typeof f == 'object' ) {
          if ( f.handler != undefined ) {
            _placedonobj[k] = f;
            _bindobj[k].handler = f.handler.bind(_bindobj);
            Object.defineProperty(_placedonobj[k].handler, 'name', {value : k}); // retain name of function after binding
          }
          else throw Error(`Binding object has entry '${k}' that is not a function or a DocMethod with a handler function.`);
        }
        else if ( typeof f == 'function' ) {
          _placedonobj[k] = f.bind(_bindobj);
        }
        else { throw Error(`Binding object has entry '${k}' that is not a function or a DocMethod with a handler function.`); }
      }
    }

    return null;
  },


  /**
   * Generates a UUID v4 to use as a token.
   *
   * @return {string} -
   */
  generateToken() { return uuidv4(); },


  /**
   * For testing, useful to generate strings of known values.
   *
   * @param {int} _length - number of bytes in string returned
   * @return {string} -
   */
  generateOrderedString(_length = 20) {
    if ( Service.GOS_last === undefined ) Service.GOS_last = -1;
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let retval= '';
    for (let i = 0; i < length; i += 1) {
      let p = (1+Service.GOS_last)%possible.length;
      retval += possible.charAt( p );
      Service.GOS_last = p;
    }
    return retval;
  },


  /**
   * Resets the generation of ordered strings.
   *
   * @return {undefined} -
   */
  orderedStringReset() { Service.GOS_last = -1; },


  /**
   * Decrypt data with AES, using a key.
   * 
   * NOTE: this peels off 8 random bytes.
   *
   * @param {*} _key -
   * @param {*} _secret - Content string to encrypt
   * @return {string} - _secret decrypted to UTF8 string
   */
  decrypt(_key, _secret) {
    let plaintext = decryptedBytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(plaintext);
  },


  /**
   * Encrypt data with AES, using a key.
   *
   * @param {*} _key -
   * @param {*} _secret - Thing to encrypt. UTF8, bytes, etc. JSON.stringify don't care.
   * @return {object} - call toString() on the object to get the string
   */
  encrypt(_key, _secret) {
    let retval = null;
    try {
      let result = CryptoJS.AES.encrypt(randbytes + JSON.stringify(_secret), _key);
      retval = result.toString();
    }
    catch (e) { console.log(e); throw new Error('Failed to encrypt.'); }
    return retval;
  },

};
