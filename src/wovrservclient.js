
/**
 * @typedef Logger
 * @typedef WovRemoteService
 */

/**
 * The client stores all the WovRemoteServices.
 *
 */
module.exports = class WovRemoteServiceClient {

  /**
   * A constructor.
   *
   * @param {Logger} _l -
   * @param {Array} _rserv - array of the WovRemoteServices created in the microservice.
   */
  constructor(_l, _rserv) {
    this.l = _l;

    this._rserv = {};
    _rserv.forEach( function(rs) {
      rs.init(this.l, this);
      this[rs.name] = rs;
      this[`rserv_${rs.name.toLowerCase()}`] = rs;
    }.bind(this));
  };

  /**
   * Eventually will do async calls to test initial config and connections.
   *
   * @return {undefined} -
   */
  async init() {
  };


  /**
   * Getter for the WovRemoteService.
   *
   * @param {string} _name -
   * @return {WovRemoteService} -
   */
  getRemoteService(_name) { return this._rservices[_name]; }

};
