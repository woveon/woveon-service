
/**
 * @typedef Logger
 * @typedef WovRemoteModel
 * @typedef WovStateLayer
 */

const entity = require('./entity');
const Requester = require('./requester');

/**
 * The client stores all the WovRemoteServices.
 *
 */
module.exports = class WovRemoteClient extends entity.WovEntityClient {

  /**
   * A constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovRemoteModel>} _rmods - array of the WovRemoteModels created in the microservice.
   */
  constructor(_l, _rmods) { // _msrequesters
    super(_l);
    this.l = _l;
    this._rmods = _rmods;
    this.ms = new Requester(this.l); // ms is short for microservice that this isconnected to
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
    this._rmods.forEach( function(rm) {
      rm.init(this.l, this);

      // attach X RemoteService to WovServiceClient
      // WoveonService.statelayer.rserv.X
      // WoveonService.statelayer.rserv.rserv_X
      this[rm.name] = rm;
      this[`rmod_${rm.name.toLowerCase()}`] = rm;
      // this.statelayer[`rserv_${rs.name}`] = rs;
      this.statelayer[`${rm.name}`] = rm;
    }.bind(this));

  };


  /**
   * Getter for the WovRemoteModel.
   *
   * @param {string} _name -
   * @return {WovRemoteModel} -
   */
  getRemoteModel(_name) { return this._rmods[_name]; }

};
