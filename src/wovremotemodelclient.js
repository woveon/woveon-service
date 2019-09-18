
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
  constructor(_l, _rservs, _msrequesters) {
    super(_l);
    this.l = _l;
    this._rservs = _rservs;
  };

  /**
   * Eventually will do async calls to test initial config and connections.
   *
   * Connects to State Layer : WoveonService.statelayer.rserv_X.
   *
   * @param {WovStateLayer} _sl -
   * @return {undefined} -
   */
  async init(_sl) {
    this.statelayer = _sl;
    this._rservs.forEach( function(rs) {
      rs.init(this.l, this);

      // attach X RemoteService to WovServiceClient
      // WoveonService.statelayer.rserv.X
      // WoveonService.statelayer.rserv.rserv_X
      this[rs.name] = rs;
      this[`rserv_${rs.name.toLowerCase()}`] = rs;
      // this.statelayer[`rserv_${rs.name}`] = rs;
      this.statelayer[`${rs.name}`] = rs;
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
