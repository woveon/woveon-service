const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WR        = require('../src/wovreturn');
const WS        = require('../src/index');

const express   = require('express');
const C         = require('woveon-service').Config;

/**
 */
class User extends WS.WovModel { };
class Team extends WS.WovModel { };

let mtag = 'model';

let logger = new Logger(mtag, {debug : true, showName : true, level : 'info', color : 'inverse'}, {titles : false});

describe(`>${mtag}: `, async function() {

  let model = null;
  let cl    = null;

  before( async function() {
    await C.data('db').connect()
      // .then(() => { logger.info('  ... db connected'); })
      .catch( (e) => { logger.throwError('  ... db connection error', e.stack); });

    cl = new WS.WovModelClient(logger, C.data('db'), ['users']);
  });


  it('> model creation', async function() {
    User.init(cl);
    Team.init(cl);
    logger.info('User: ', User.name, User.tablename);
    logger.info('Team: ', Team.name, Team.tablename);
    logger.info(' user: ', await User.readByID(141));
  });
});

