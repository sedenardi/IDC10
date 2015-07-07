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

var idcArray = [];
var objWrite = new stream.Writable({
  objectMode: true,
  write: function(chunk, encoding, next) {
    idcArray.push(chunk);
    next();
  }
});

var buildTreeRel = function() {
  var idcMap = new Map();
  idcArray.forEach(function(v) {
    idcMap.set(v.code,v);
  });
  
  var rollUpChildren = function() {
    var parentSet = new Set();
    for (var v of idcMap.values()) {
      var pKey1 = v.code.slice(0,v.code.length-1);
      if (!idcMap.has(pKey1)) pKey1 = pKey1.replace(/X+$/,'');
      if (idcMap.has(pKey1)) {
        parentSet.add(pKey1);
      }
    }
    var toDelete = [];
    for (var v of idcMap.values()) {
      var pKey2 = v.code.slice(0,v.code.length-1);
      if (!idcMap.has(pKey2)) pKey2 = pKey2.replace(/X+$/,'');
      if (!parentSet.has(v.code) && idcMap.has(pKey2)) {
        if (!idcMap.get(pKey2).children)
          idcMap.get(pKey2).children = [];
        idcMap.get(pKey2).children.push(v);
        toDelete.push(v.code);
      }
    }
    toDelete.forEach(function(v) {
      idcMap.delete(v);
    });
    return toDelete.length;
  };
  
  do {
    res = rollUpChildren();
  } while (res > 0);

  var treeArray = [];
  for (var value of idcMap.values())
    treeArray.push(value);

  return treeArray;
};

var buildTreeSeq = function() {
  idcArray = idcArray.sort(function(a,b) {
    return a.code.localeCompare(b.code);
  });
  var treeArray = [];

  var populateLevel = function(index, array, currentLevel) {
    if (currentLevel === 0) {
      array.push(idcArray[index]);
    } else {
      currentLevel--;
      if (!array[array.length-1].children)
        array[array.length-1].children = [];
      populateLevel(index, array[array.length-1].children, currentLevel);
    }
  };

  var treeLevel = 0,
      treeLengths = { 0: 0 };
  populateLevel(0, treeArray, treeLevel);
  for (var i = 1; i < idcArray.length; i++) {
    var distance = idcArray[i].code.length - 3;
    if (idcArray[i].code.length > idcArray[i-1].code.length) {
      treeLevel++;
      treeLengths[distance] = treeLevel;
    } else if (idcArray[i].code.length < idcArray[i-1].code.length) {
      treeLevel = treeLengths[distance];
    }
    populateLevel(i, treeArray, treeLevel);
  }
  return treeArray;
};

objWrite.on('finish', function() {
  /*var tree = buildTreeRel();*/
  var tree = buildTreeSeq();
  fs.writeFileSync('tree.json',JSON.stringify(tree,null,2));
});

fs.createReadStream('icd10cm_order_2016.txt').pipe(transform).pipe(objWrite);