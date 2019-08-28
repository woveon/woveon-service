
/**
 * @typedef Logger
 * @typedef WovRemoteService
 * @typedef WovStateLayer
 */

const entity = require('./entity');

/**
 * The client stores all the WovRemoteServices.
 *
 */
module.exports = class WovRemoteClient extends entity.WovEntityClient {

  /**
   * A constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovRemoteModel>} _rservs - array of the WovRemoteModels created in the microservice.
   */
  constructor(_l, _rservs) {
    super(_l);
    this.l = _l;
    this._rservs = _rservs;
  };

  /**
   * Eventually will do async calls to test initial config and connections.
   *
   * Connects to State Layer : WoveonService.sl.rserv_X.
   *
   * @param {WovStateLayer} _sl -
   * @return {undefined} -
   */
  async init(_sl) {
    this.sl = _sl;
    this._rservs.forEach( function(rs) {
      rs.init(this.l, this);

      // attach X RemoteService to WovServiceClient
      // WoveonService.sl.rserv.X
      // WoveonService.sl.rserv.rserv_X
      this[rs.name] = rs;
      this[`rserv_${rs.name.toLowerCase()}`] = rs;
      // this.sl[`rserv_${rs.name}`] = rs;
      this.sl[`${rs.name}`] = rs;
    }.bind(this));
  };


  /**
   * Getter for the WovRemoteService.
   *
   * @param {string} _name -
   * @return {WovRemoteService} -
   */
  getRemoteService(_name) { return this._rservs[_name]; }

};
