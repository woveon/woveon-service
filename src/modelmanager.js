const glob     = require( 'glob' );
const path     = require( 'path' );
const autoBind = require('auto-bind-inheritance');


/**
 * This object reads in an archive of files on a given path. It handles hierarchy as well.
 *
 * Usage: Create your own hierchy of files, this will read them in along a dot path.
 *  ex. directory structure:
 *   foo/a.js
 *   foo/b.js
 *   foo/bar/c.js
 *  returns:  this.foo = { a : ..., b : ..., bar : { c : ... } }
 */
module.exports = class ModelManager {

  /**
   * @param {string} _basepath  - Path to model start location. ex. '/User/foo/path/to/model'
   * @param {string} _relpath - Relative path within the modelloc. ex. 'models/**\/*.js' for instance
   * @param {object} _logger    - woveon-logger object
   */
  constructor(_basepath, _relpath, _logger) {
    autoBind(this);

    this.logger    = _logger;
    this.basepath  = _basepath;
    this.relpath   = _relpath;
    this.loaddata   = {};

    this.logger.verbose('...manager loading full path', this.basepath + '/' + this.relpath);
    let basesize = this.basepath.split('/').length;
    let that = this;

    glob.sync(this.basepath+'/'+this.relpath).forEach( function( file ) {
      that.logger.info(`  ... manager loading file: ${file}`);
      that.loaddata.dirs = file.split('/');
      that.loaddata.dirs.splice(0, basesize); // remove non-hierarchy
      let filename = (that.loaddata.dirs.splice(-1, 1)[0]);
      let fnext    = filename.split('.')[1];
      let fn       = filename.split('.')[0]; // remove and get filename
      let m        = that;
      for (let i=0; i<that.loaddata.dirs.length; i++ ) {
        // that.logger.info(' e: ', e);
        let e = that.loaddata.dirs[i];
        if ( !m[e] ) m[e] = {};
        m = m[e];
      }
      m[fn] = require(path.resolve(file));

      that.loaddata.filename = fn;
      that.loaddata.fileext  = fnext;
      that.onLoad(that.loaddata, m[fn]); // that.loaddata);//fn+'.'+fnext, dirs.join('/'), m[fn]);
    });
  }


  /**
   * @param {string} _k - key
   * @param {*} _v - value
   */
  addLoadData(_k, _v) {this.loaddata[_k] = _v;}


  /**
   * Callback to override in your class.
   * @param {object} _loaddata - standard data sent to onLoad
   * @param {object} _loaded   - output of require call
   */
  onLoad(_loaddata, _loaded) {
    this.logger.info(`  ... onload : '${this.loaddata.filename}' : '${this.loaddata.dirs}' `, _loaded);
  }

};
