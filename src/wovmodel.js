
/**
 * This is a base class of every "thing" which has a model in our system.
 * It connects to the database through a wovmodelclient.
 */
module.exports = class WovModel {

  /**
   */
  constructor(_data) {
    this.data = _data;
  }

  /**
   * @param {WovModelClient} _wovmodelclient -
   * @param {object}         _schema         - ?Do I have a need for this yet?
   * @param {string}         _tablename      - The name of the database table this accesses. Defaults to class name lowercase.
   */
  static init(_logger, _wovmodelclient, _schema = null) {
    this.l = _logger;
    this.cl= _wovmodelclient;
    if ( this.tablename == null ) throw Error('WovModel requires model to set static tablename .');
    this.schema = _schema;
    this.l.aspect('wovmodelinit', `...init model '${this.name}', table '${this.tablename}', schema : `, this.schema);
  }

  /**
   * @param {integer} _id
   * @return {instance of User}
   */
  static async readByID(_id) {
    console.log('readByID : this: ', this, this.tablename);
    let data = await this.cl._selectByID(_id, this.tablename);
    return new this(data);
  }

  /**
   * @param {integer} _id
   */
  static async deleteByID(_id) {
    let q = `DELETE FROM ${this.name} WHERE id=$1::integer`;
    let d = [_id];
    return this.cl._runSingularQuery(q, d, `deleteOne${this.name}`);
  }

  /**
   * @param {object} _data
   */
  static async createOne(_data) { this.l.throwError(`Need to implement 'createOne' for ${this.name}.`); }

  /**
   * @param {integer} _id
   * @param {object} _data
   */
  static async updateOne(_id, _data) { this.l.throwError(`Need to implement 'updateOne' for ${this.name}.`); }

};
