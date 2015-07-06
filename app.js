var fs = require('fs'),
    stream = require('stream');

var transform = new stream.Transform({
  readableObjectMode: true,
  writableObjectMode: false,
  transform: function(chunk, encoding, next) {
    this._buf += chunk.toString();
    var lines = this._buf.split(/\r?\n/);
    this._buf = lines.pop();
    this._readLines(lines);
    next();
  },
  flush: function(done) {
    var lines = this._buf.trim().split(/\r?\n/);
    this._readLines(lines);
    done();
  }
});
transform._buf = '';
transform._readLines = function(lines) {
  for (var l = 0; l < lines.length; l++) {
    var line = lines[l];
    if (line.length) {
      var o = {
        num: line.slice(0,5),
        code: line.slice(6,13).trim(),
        valid: line.slice(14,15),
        short: line.slice(16,76).trim(),
        long: line.slice(77).trim()
      };
      this.push(o);
    }
  }
};

var idcArray = [],
    idcMap = new Map();
var objWrite = new stream.Writable({
  objectMode: true,
  write: function(chunk, encoding, next) {
    idcArray.push(chunk);
    idcMap.set(chunk.code,chunk);
    next();
  }
});

var relArray = [],
    treeObj = {};
var buildTree = function() {
  relArray = idcArray.map(function(v) {
    var pKey = v.code.slice(0,v.code.length-1);
    var p = idcMap.get(pKey);
    if (p)
      return [p.code,v.code];
    else
      return [p,v.code];
  }).filter(function(v) {
    return v[0];
  });
  console.log(relArray.length);
};

objWrite.on('finish', buildTree);

fs.createReadStream('icd10cm_order_2016.txt').pipe(transform).pipe(objWrite);