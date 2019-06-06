

const expect    = require('chai').expect;
const Logger    = require('woveon-logger');
const WR        = require('../src/wovreturn');
const WS        = require('../src/index');

const express   = require('express');
const C         = require('woveon-service').Config;


let mtag = 'midpoints';
let port = 9001;
let ver  = 'v1';
let name = 'midpoint';
let root = `/${name}/${ver}`;

let logger = new Logger(mtag, {debug : true, showName : true, level : 'info', color : 'inverse'}, {titles : false});

describe(`>${mtag} : Midpoint Routes`, async function() {

  it('> test express functionality ', async function() {
    let r = new WS.Requester(logger, `http://localhost:${port}`); // /${root}`);

    let l = new WS.Listener(port, logger, null, root, name);
    await l.init();

    let rA = express.Router();
    rA.use('/', function(_req, _res, _next) {
      logger.info('hit: /A');
      _next();
    });

    let rB = express.Router();
    rB.use('/', function(_req, _res, _next) {
      logger.info('hit: /B');
      _next();
    });

    rB.get('/:v', function(_req, _res) {
      logger.info('hit: /:v');
      _res.send(WR.retSuccess('ok'));
    });

    l.app.get('/health', function(_req, _res) { logger.info('hit: /health'); _res.send(WR.retSuccess('ok')); });

    l.app.use('/A', rA);
    l.app.use('/A/B', rB);
    // rA.use('/B', rB);
    logger.info('app: ', l.app._router.stack[l.app._router.stack.length-1]);

    await l.listen();

    await r.get('/health');
    await r.get('/A');
    await r.get('/A/B');
    await r.get('/A/B/1');
  });

  it('> test express router.route', async function() {
    let r = new WS.Requester(logger, `http://localhost:${port}`);

    let l = new WS.Listener(port, logger, null, root, name);

    await l.init();
    let fu = function(_req, _res, _next) { logger.info('u hit : ', _req.originalUrl); _next(); };
    let f = function(_req, _res) { logger.info('hit : ', _req.originalUrl); _res.send(WR.retSuccess('ok')); };

    l.app.route('/health').get(function(_req, _res) { logger.info('hit: /health'); _res.send(WR.retSuccess('ok')); });
    l.app.use('/A/:a', fu);
    // l.app.route('/A/:a/B/:b').get(f);
    l.app.route('/A/:a/B/:b').get(f);
    await l.listen();
    await r.get('/health');
    await r.get('/A/a');
    await r.get('/A/a/B/b');

    await l.close();
  });

  it.only('> basic', async function() {
    let r = new WS.Requester(logger, `http://localhost:${port}${root}`);
    let l = new WS.Listener(port, logger, null, root, name);
    let fu2 = function(_args, _res) { logger.info('u2 hit : ', _res.req.originalUrl, _args); return WR.retSuccess({aa : _args.a}); };
    // let fu  = function(_args, _res) { logger.info('u hit  : ', _res.req.originalUrl, _args); return WR.retSuccess({aa : _args.a}); };
    let f   = function(_args, _res) { logger.info('hit    : ', _res.req.originalUrl, _args); return WR.retSuccess(_args); };

    await l.init();
    l.onGet('/health', f,  __filename);

    // l.onProtect(`/A`,    fu2, {}, {aa : true});
    l.onProtect(`/A/:a`, fu2,  {}, {aa : true, ab : false});
    l.onGet(`/A/:a/:b`, f, __filename);

    let result = null;
    await l.listen();
    result = await r.get('/health');
    expect(result.success).to.be.true;
    result =await r.get('/A');
    expect(result.success).to.be.false;
    result =await r.get('/A/a');
    expect(result.success).to.be.false;
    result =await r.get('/A/a/b');
    expect(result.success).to.be.true;
    expect(result.data).to.deep.equal({a : 'a', b : 'b', aa : 'a'});
    result =await r.get('/A/1/b');
    expect(result.success).to.be.true;
    expect(result.data).to.deep.equal({a : '1', b : 'b', aa : '1'});

    await l.close();
  });

  /*
  it('> basic', async function() {

    let r = new WS.Requester(logger, `http://localhost:${port}`);
    let l = new WS.Listener(port, logger, null, root, name);
    await l.init();

    l.app.get('/health', function(_req, _res) { logger.info('hit: /health'); _res.send(WR.retSuccess('ok')); });


    let r1 = l._matchRoute('/A/:a');
    logger.info('r1 :', r1);
    expect(r1.entry.length).to.equal(0);
    expect(r1.subroute).to.equal('/A/:a');

    let f = function(_req, _res) { logger.info('hit : ', _req.originalUrl); _res.send(WR.retSuccess('ok')); };

    l.onProtect('/A/:a',      f, {reqparam : true, unreqparam : false});
    l.onProtect('/B/:b',      f, {reqparam : true, unreqparam : false});
    l.onProtect('/A/B/:ab',   f, {reqparam : true, unreqparam : false});
    l.onProtect('/A/:a/B/:b', f, {reqparam : true, unreqparam : false});

    l.connectSubrouteEntries();
    / *
    l.onProtect('/A/:a');
    expect(l.getRouter('/A')).to.not.be.null;
    expect(l.getRouter('/A/:a')).to.not.be.null;
    expect(l.getRouter('/Z/:a')).to.be.null;
    expect(l.routers[0].length).to.be.equal(1);
    expect(l.routers[0][0].length).to.be.equal(1);

    l.onGet('/A/:a/B/:b');
    l.onGet('/Z/:a/B/:b');
    * /

    await l.listen();
    await r.get('/health');
    await r.get('/A');
    await r.get('/A/:a');
    await r.get('/B/:b');
    await r.get('/C/:b');
    await r.get('/A/B');
    await r.get('/A/:a/B/:b');
    await r.get('/A/:a/B/:b/C');
  });
*/
});
