const expect = require('chai').expect;
const Logger = require('woveon-logger');
const WR     = require('../src/wovreturn');
// const Service   = require('../src/index');

// const express   = require('express');

// const C         = require('woveon-service').Config;

let mtag ='wovreturn';

let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles : false,
});

describe(`> ${mtag}: `, async function() {


  // setup the service
  before(async function() {
    this.timeout(3000);
  });

  it('> load error codes', async function() {
    let errorcodes = {
      A : {code : 100, text : 'msg A'},
      B : {code : 101, text : 'msg B'},
    };
    let d = {id : 1};
    let m = 'specific message';
    WR.defineCodedErrors(errorcodes);

    let err = 'A';
    let e = WR.retCodedError(err, d, m);
    // logger.info('e : ', e);
    expect(e).to.not.be.null;
    expect(e.success).to.be.false;
    expect(e.code).to.equal(200);
    expect(e.meta.code).to.equal(errorcodes[err].code);
    expect(e.meta.text).to.equal(errorcodes[err].text);
    expect(e.data).to.deep.equal(d);
  });

});
