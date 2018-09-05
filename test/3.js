
const WovReturn = require('../src/wovreturn');
const Logger    = require('woveon-logger');
const expect    = require('chai').expect;

const mtag = '3_WovRet';
let logger = new Logger(mtag, {
  debug    : true,
  showName : true,
  level    : 'info',
  color    : 'inverse',
}, {
  titles: false,
});

let d = {'a' : 1};
let m = 'asdf';

describe(`${mtag}: WovReturn tests`, async function() {
  logger.h2().info(this.title);

  // setup the service
  before(async function() {
    this.timeout(3000);
  });


  describe(`> returns`, async function() {

    it('> retSuccess', async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.retSuccess(d);
      expect(r.success).to.equal(true);
      expect(r.code).to.equal(200);
      expect(r.data).to.deep.equal(d);
      expect(r.msg).to.equal(undefined);
    });

    it('> retError', async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.retError(d, m);
      expect(r.success).to.equal(false);
      expect(r.code).to.equal(200);
      expect(r.data).to.deep.equal(d);
      expect(r.msg).to.equal(m);
    });

    it('> retError no message', async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.retError(d);
      expect(r.success).to.equal(false);
      expect(r.code).to.equal(200);
      expect(r.data).to.deep.equal(d);
      expect(r.msg).to.equal('General Error');
    });

    it('> retFail', async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.retFail(d);
      expect(r.success).to.equal(false);
      expect(r.code).to.equal(400);
      expect(r.data).to.deep.equal(d);
      expect(r.msg).to.equal('Failure');
    });
    it('> retFail, w/code', async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.retFail(d, 404);
      expect(r.success).to.equal(false);
      expect(r.code).to.equal(404);
      expect(r.data).to.deep.equal(d);
      expect(r.msg).to.equal('Failure');
    });
    it('> retFail, w/code w/msg', async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.retFail(d, 404, m);
      expect(r.success).to.equal(false);
      expect(r.code).to.equal(404);
      expect(r.data).to.deep.equal(d);
      expect(r.msg).to.equal(m);
    });

    it('> retRedirect', async function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.retRedirect(m);
      expect(r.success).to.equal(true);
      expect(r.code).to.equal(302);
      expect(r.data).to.deep.equal(m);
      expect(r.msg).to.equal(undefined);
    });
  });


  describe.only(`> checkAttributes`, async function() {

    it('> single attr', function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.checkAttributes({'a': true}, 'a');
      // logger.info('r: ', r);
      expect(r).to.equal(null);
    });

    it('> array attr', function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.checkAttributes({'a' : true}, ['a']);
      // logger.info('r: ', r);
      expect(r).to.equal(null);
    });

    it('> object attr required, exists', function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.checkAttributes({'a' : true}, {'a' : true});
      // logger.info('r: ', r);
      expect(r).to.equal(null);
    });

    it('> object attr required, not exists', function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.checkAttributes({}, {'a' : true});
      // logger.info('r: ', r);
      expect(r.success).to.equal(false);
    });

    it('> object attr not required', function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.checkAttributes({'a' : true}, {'a' : false});
      // logger.info('r: ', r);
      expect(r).to.equal(null);
    });

    it('> object attr not required, not exists', function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.checkAttributes({}, {'a' : false});
      // logger.info('r: ', r);
      expect(r).to.equal(null);
    });

    it('> mixed requirements', function() {
      logger.h2('titles').aspect('titles', this.test.title);
      let r = WovReturn.checkAttributes(
        {'a' : true, 'b' : false, 'c' : 1},
        {'a' : false, 'b' : true, 'd' : false, 'e' : true});
      // logger.info('r: ', r);
      expect(r.success).to.equal(false);
      expect(r.data.missing[0]).to.equal('e');
      expect(r.data.unexpected[0]).to.equal('c');
    });

  });

});
