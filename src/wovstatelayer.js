
/**
 * @typedef WovClientLocal
 * @typedef WovClientRemote
 * @typedef WovModel
 * @typedef WovRemoteServiceClient
 * @typedef WovEntityClient
 * @typedef WovEntityModel
 * @typedef WovStateLayer
 * @typedef Logger
 * @typedef Listener
 */

// const Logger               = require('woveon-logger');
const WovClientLocal   = require('./wovclientlocal');
const WovClientRemote  = require('./wovclientremote');
const Logger           = require('woveon-logger');

const {ApolloServer}    = require('apollo-server-express');
const requireFromString = require('require-from-string');


/**
 * The State Layer manages models (which manage Entity CRUD) and connects to remote services
 * to interact with remote Entities.
 */
module.exports = class WovStateLayer {

  l        = null; // the loggr object
  _clients = null; // the array of WovEntity Clients this layer has
  _models  = null; // the hash (by lowercase model name) of WovModels this state layer serves (added from clients)
  _rs      = null; // GraphQL Remote Server for all local clients


  /**
   * Constructor.
   *
   * @param {Logger} _l -
   * @param {Array<WovEntityClient>} _woventityclients -
   */
  constructor(_l, _woventityclients) {
    this.l = _l;
    this._clients = _woventityclients;
    this._models  = {};
    this._inited = false;

    // build models into this
    for (let i=0; i<this._clients.length; i++ ) {
      let c = this._clients[i];

      // add to the state layer and check for a few errors
      for (let k in c._models) {
        let m = c._models[k];
        if ( m == null ) throw Error(`Model of index 'k' is null?`);
        if ( this._models[m.name.toLowerCase()] != undefined ) {
          throw Error(`Model named '${m.name}' of index '${k}' already exists in state layer.`);
        }
        this._models[m.name.toLowerCase()] = m;
        this[m.name] = m;
      }
    }
  };


  /**
   * Simple check if this has been inited.
   *
   * @return {boolean} -
   */
  isInited() { return this._inited; }

  /**
   * Any async calls to set up the layer.
   *
   * @return {WovStateLayer} - returns itself ex. new WovStateLayer(...).init()
   */
  async init() {

    // this.l.info('WovStateLayer init called');
    for (let i=0; i<this._clients.length; i++ ) {
      let c = this._clients[i];
      // this.l.info('init client ', c);
      if ( c instanceof WovClientLocal ) {
        await c.init(this, false, true, true);
      }
      else if ( c instanceof WovClientRemote) {
        await c.init(this);
      }
      else {
        this.l.error('Unknown client to init in state layer : ', c);
      }

    }
    this._inited = true;
    return this;
  }


  /**
   * Returns the model of the given name.
   *
   * @param {string} _n - model name
   * @return {WovModel} -
   */
  getModel(_n) {
    let retval = this._models[_n.toLowerCase()];
    // Logger.g().info(`getModel ${_n} of models: `, Object.keys(this._models));
    return retval;
  }


  /**
   * Call on each client.
   *
   * @return {string} - all schemas
   */
  /*
  getGraphQLSchemas() {
    let retval = {
      queries   : '',   // query definitions ex. getX(id : ID!) : X
      mutations : '',   // mutations. ex. createX(xToCreate : iCreateX!) : X
      query_t   : '',   // query/mutation types for mutations and create/update. ex. iCreateX { foo : String! }
      schemas   : '',   //
    };

    for (let i=0; i<this._clients.length; i++) {
      let cl = this._clients[i];
      let result = cl.getGraphQLSchemas();
      this.l.info('State layer client scheam: ', result);
      retval.queries   += result.queries;
      retval.mutations += result.mutations;
      retval.query_t   += result.query_t;
      retval.schemas   += result.schemas;
    }

    return retval;
  }
  */


  /**
   * Call on each client.
   *
   * @return {object} - {modeljs:,exportsjs:}
   */
  /*
  getGraphQLResolvers() {
    let retval = {
      queryjs    : '',   // query implementations
      mutationjs : '',   // mutation implementations
      modeljs    : '',   // data relationships of models (ex. const Car = { tires : async function(...) {...}}, )
      exportsjs  : '',   // the models to export ex. "X, Y"
    };

    for (let i=0; i<this._clients.length; i++) {
      let cl     = this._clients[i];
      let result = cl.getGraphQLResolvers();
      retval.queryjs    += result.queryjs;
      retval.mutationjs += result.mutationjs;
      retval.modeljs    += result.modeljs;
      retval.exportsjs  += result.exportsjs;
    }


     this.gqlrs= new ApolloServer({
        typeDefs  : gqlschema,
        resolvers : requireFromString(gqlresolvers), // requirefromstring to turn into code
        context   : ({req}) => {
          let retval = {
            httpVersionMajor : req.httpVersionMajor,
            httpVersionMinor : req.httpVersionMinor,
            httpVersion      : req.httpVersion,
            headers          : req.headers,
            rawHeaders       : req.rawHeaders,
            originalUrl      : req.originalUrl,
            args             : Object.assign({}, req.wov, req.params, req.query, req.body),
          };
          return retval;
        },
        dataSources    : () => ({sl : this.statelayer}),  // (State Layer)
        formatError    : (error) => { Logger.g().error(JSON.stringify(error, null, 2)); return error; },
        formatResponse : (_response, {context}) => {
          Logger.g().aspect('listener.incoming', `Handled  : '${context.originalUrl}' with prot GraphQL: '${context.args.query}'`,
            _response.data);
          let retval = _response;
          return retval;
        },
      });

    return retval;
  }
      */


  /**
   * Initializes the Models Server on the given listener at path _listener.root/models/graphql.
   *
   * The Models Server is how a microservice externalizes its local models to the system for basic
   * crud operations.
   *
   * @param {Listener} _listener - listener to listen on. generally, the microservice's listener.
   * @return {undefined} -
   */
  async initModelsServer(_listener) {
    let schemas = '';
    let resolvers = '';

    // Build Config from all local clients
    for (let i=0; i<this._clients.length; i++) {
      let cl     = this._clients[i];
      if ( cl instanceof WovClientLocal ) {
        let cfg = cl.getRemotesServerConfig();
        schemas   += cfg.schemas;
        resolvers += cfg.resolvers;
      }
    }

    this.l.h3().info('schemas: ', schemas);
    this.l.h3().info('resolvers: ', resolvers);
    resolvers = requireFromString(resolvers);

    let sl = this;

    // Start GraphQL server for the Remote Server
    this._rs = new ApolloServer({
      typeDefs  : schemas,
      resolvers : resolvers, // requireFromString(resolvers), // requirefromstring to turn into code
      context   : ({req}) => {
        let retval = {
          httpVersionMajor : req.httpVersionMajor,
          httpVersionMinor : req.httpVersionMinor,
          httpVersion      : req.httpVersion,
          headers          : req.headers,
          rawHeaders       : req.rawHeaders,
          originalUrl      : req.originalUrl,
          args             : Object.assign({}, req.wov, req.params, req.query, req.body),
        };
        return retval;
      },
      dataSources : () => ({statelayer : sl}),  // (State Layer)
      formatError : function(error) {
        Logger.g().error(JSON.stringify(error, null, 2));
        return error;
      },
      formatResponse : (_response, {context}) => {
        Logger.g().info('response:', _response);
        Logger.g().aspect('listener.incoming', `Handled  : '${context.originalUrl}' with prot GraphQL: '${context.args.query}'`,
          _response.data);
        let retval = _response;
        return retval;
      },
      /*
      formatResponse : (function(_response, {context}) {
        this.l.g().aspect('listener.incoming', `Handled  : '${context.originalUrl}' with prot GraphQL: '${context.args.query}'`,
          _response.data);
        let retval = _response;
        return retval;
      }).bind(this),
      */
    });

    this._rs.applyMiddleware({app : _listener.app, path : `${_listener.root}/models/graphql`}); // , path : '/graphql'});
    this.l.info(`... loaded graphQL at route: '${this._rs.graphqlPath}'`);


  }

};
