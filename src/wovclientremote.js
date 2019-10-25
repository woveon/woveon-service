
/**
 * @typedef Logger
 * @typedef WovStateLayer
 * @typedef WovModel
 * @typedef integer
 * @typedef Requester
 */

const entity    = require('./entity');
// const Requester = require('./requester');
const Logger    = require('woveon-logger');

/**
 * The client stores all the WovRemoteServices.
 *
 */
module.exports = class WovClientRemote extends entity.WovClientEntity {

  /**
   * A constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovModel>} _models - array of the WovRemoteModels created in the microservice.
   * @param {Requester} _msrequester  - the requester pointing to the LocalClient Remote Server.
   */
  constructor(_l, _models, _msrequester) { // _msrequesters
    super(_l, _models);
    this.l = _l;
    this.msr = _msrequester;
    if ( this.msr == null ) throw Error('_msrequester needs to be passed in');
    // new Requester(this.l); // ms is short for microservice that this isconnected to
  };


  /**
   * Eventually will do async calls to test initial config and connections.
   *
   * Connects to State Layer : WoveonService.statelayer.rserv_X.
   *
   * @param {WovStateLayer} _sl -
   * @return {undefined} -
   */
  async init(_sl) { entity.WovClientEntity.prototype.init.call(this, _sl); }


  // =====================================================================
  // ---------------------------------------------------------------------
  // Virtual Functions from WovEntityClient
  // ---------------------------------------------------------------------


  /**
   * Reads in the data by the id.
   *
   * @param {integer} _id -
   * @param {WovModel} _Model - the Model class
   * @param {string|null} _fields - space sparates string of fields to return. null returns all known to model.
   * @return {WovModel|Error} -
   */
  async getByID(_id, _Model, _fields) {
    let retval = null;
    let fields = _fields || _Model.getAllGraphQLFields();
    let qq = `get${_Model.name}ByID`;
    let q  = `query { ${qq}(id : ${_id}) { id ${fields}} }`;

    this.l.info('q: ', q);
    let result = await this.msr.post('/graphql', null, {query : q});
    this.l.info('result: ', JSON.stringify(result, null, 2) );


    if ( result.success == true ) {
      let d = result.data.data[qq];
      this.l.info('d is ', d);
      if ( d != null ) { d.id = parseInt(d.id); retval = new _Model(d); }
      else retval = null; // default value, but placing this code here to be explicit
    }
    else { retval = result; }

      /*
      if ( r.statusCode != 200 ) {
        retval = WR.retError({qname : _qname, qin : _din}, `Failed GraphQL call "${_qtype}:${_qname}"`);
      }
      else { retval = WR.retSuccess(r.data.data[qname]); }
      */
    return retval;
  }

  async getByIDs(_ids, _Model, _fields) {
    let retval = null;
    let fields = _fields || _Model.getAllGraphQLFields();
    let qq = `get${_Model.name}ByIDs`;
    let q  = `query { ${qq}(ids : [${_ids}]) { id ${fields}} }`;

    this.l.info('q: ', q);
    let result = await this.msr.post('/graphql', null, {query : q});
    this.l.info('result: ', JSON.stringify(result, null, 2) );


    if ( result.success == true ) {
      let dd = result.data.data[qq];
      for (let i=0; i<dd.length; i++) {
        let d = dd[i];
        this.l.info('d is ', d);
        if ( d != null ) { d.id = parseInt(d.id); result.data.data[qq][i] = new _Model(d); }
        else result.data.data[qq][i] = null; // default value, but placing this code here to be explicit
      }
      retval = result.data.data[qq];
    }
    else { retval = result; }

      /*
      if ( r.statusCode != 200 ) {
        retval = WR.retError({qname : _qname, qin : _din}, `Failed GraphQL call "${_qtype}:${_qname}"`);
      }
      else { retval = WR.retSuccess(r.data.data[qname]); }
      */
    return retval;
  }


  /**
   * Creates from data.
   *
   * @param {integer} _data -
   * @param {WovModel} _Model - the Model class
   * @param {string|null} _fields - space sparates string of fields to return. null returns all known to model.
   * @return {WovModel|Error} -
   **/
  async createOne(_data, _Model, _fields) {
    let retval = null;
    let fields = _fields || _Model.getAllGraphQLFields();
    let qq = `create${_Model.name}`;
    let q  = `mutation Create${_Model.name}($input : i${_Model.name}!) {\n`+
             `  ${qq}(_createThis${_Model.name} : $input) { id ${fields} }\n`+
             `}\n`;  // TODO : cache this

    let result = await this.msr.post('/graphql', null, {query : q, variables : {input : _data}});

    if ( result.success == true ) {
      let d = result.data.data[qq];
      if ( d != null ) { d.id = parseInt(d.id); retval = new _Model(d); }
      else retval = null; // default value, but placing this code here to be explicit
    }
    else { retval = result; }

    return retval;
  }


  /**
   * @return {WovModel|Error} -
   */
  async updateOne(_id, _data, _Model, _fields) {
    let retval = null;
    let fields = _fields || _Model.getAllGraphQLFields();
    let qq = `update${_Model.name}`;
    let q  = `mutation Update${_Model.name}($_id : ID!, $input : i${_Model.name}!) {\n`+
             `  ${qq}(_id : $_id, _updateThis${_Model.name} : $input) { id ${fields} }\n`+
             `}\n`;  // TODO : cache this

    this.l.info('updateOne call : ', q);
    this.l.info('updateOne call data : ', _data);
    let result = await this.msr.post('/graphql', null, {query : q, variables : {_id : _id, input : _data}});
    this.l.info('updateOne result: ', result);

    if ( result.success == true ) {
      let d = result.data.data[qq];
      if ( d != null ) { d.id = parseInt(d.id); retval = new _Model(d); }
      else {
        this.l.warn(result.data.errors);
        retval = Error(result.data.errors.message); // null; // default value, but placing this code here to be explicit
      }
    }
    else { retval = result; }

    this.l.info('updateOne retval: ', JSON.stringify(retval));
    return retval;
  }


  /**
   * @return {boolean} - true on success, false on failure
   */
  async saveOne(_model) {
    let retval = false;
    let updata = {};

    // build data to update from dirty data of model
    Object.keys(_model._dirty).forEach(function(_key) {
      if ( _model._dirty.hasOwnProperty(_key) ) { updata[_key] = _model.get(_key); }
    });

    let result = await this.updateOne(_model.get('id'), updata, _model.constructor, 'id');
    this.l.info('saveOne retval: ', JSON.stringify(result));
    this.l.info('model : ', _model.get());

    // reset dirty if success
    if ( (result instanceof Error) == false ) { _model._dirty = {}; retval = true; }

    return retval;
  }


  // ---------------------------------------------------------------------
  // end Virtual Functions from WovEntityClient
  // ---------------------------------------------------------------------
  // =====================================================================

};
