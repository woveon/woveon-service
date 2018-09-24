const Service = require('../src/index');
const ML      = require('../src/modelloader');
const expect  = require('chai').expect;

let logger    = new Service.Logger('logger', {debug : true});

// console.log('LOGGER: ', logger.toString());

let c = null;

function setEnvs() {
  process.env.A = 'A';
  process.env.B = 'B';
  process.env.C = 'C';
  process.env.X  = null;
  process.env.sX = null;
  process.env.Y  = '';
  process.env.sY = '';
  process.env.Z  = undefined;
  process.env.sZ = undefined;
}


// catch errors of undefined env variables
setEnvs();
try {
  c = new Service.Config(logger, ['A', 'B', 'Z'], ['C', 'sZ']);
  expect(1 == 0 ).to.be.true; // should never reach this
} catch (err) {
  console.log(err.message);
  expect(err.message.includes('env variable Z is not defined,secure env variable sZ is not defined')).to.be.true;
}

// catch null
setEnvs();
c = new Service.Config(logger, ['A', 'B', 'X'], ['C', 'sX']);
expect(c.wmsg.length == 2);

// catch ''
setEnvs();
c = new Service.Config(logger, ['A', 'B', 'Y'], ['C', 'sY']);
expect(c.wmsg.length == 2);

setEnvs();
c = new Service.Config(logger, ['A', 'B'], ['C'], {blankenvvars: false});
/*
logger.info('c: ', c.toString());
logger.info('A: ', c.get('A'));
logger.info('B: ', c.get('B'));
logger.info('C: ', c.get('C'));
logger.info('C s: ', c.sget('C'));
*/

expect(process.env.A == undefined).to.be.false;
expect(process.env.B == undefined).to.be.false;
expect(process.env.C == undefined).to.be.false;
expect(process.env.Y == '').to.be.true;
expect(c.get('A')).to.equal(process.env.A);
expect(c.get('B')).to.equal(process.env.B);
expect(c.get('C')).to.equal(undefined);
expect(c.sget('A')).to.equal(undefined);
expect(c.sget('C')).to.equal(process.env.C);


setEnvs();
let cm = c.genK8SConfigMap();
expect(cm.includes('A=A')).to.be.true;
expect(cm.includes('B=B')).to.be.true;
expect(cm.includes('C=C')).to.be.false;
setEnvs();
let se = c.genK8SSecrets();
expect(se.includes('A=A')).to.be.false;
expect(se.includes('B=B')).to.be.false;
expect(se.includes('C=C')).to.be.true;

