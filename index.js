var http = require('http');
var util = require('util');
var ecstatic = require('ecstatic')(__dirname + '/public');
var shoe = require('shoe');
var dnode = require('dnode');
var uuid = require('node-uuid');
var levelup = require('levelup');

var db = levelup('./monitors');
var clients = {};
var remotes = {};

var server = http.createServer(ecstatic);
server.listen(8080);

var sock = shoe(function(stream){
  var metadata = {}, id;

  var createId = function(cb){
    var id = uuid.v4();
    var md = {
      'created_at': Date.now()
    };
    db.put(id, JSON.stringify(md), function(err){
      cb({
        id: id,
        metadata: md
      });
    });
  };

  var identifier = function(){
    return metadata.name ? id + " (" + metadata.name + ")" : id;
  };

  var d = dnode({
    sessionSet: function(k, v){
      metadata[k] = v;
      db.put(id, JSON.stringify(metadata));
      console.log("%s : SET %s TO %s", identifier(), k, v);
    },
    sessionGet: function(k, cb){
      cb(metadata[k]);
    },
    getClients: function(cb){
      cb(clients);
    },
    sendClient: function(client, method, args, cb){
      if (client === "*") {
        client = Object.keys(remotes);
      } else {
        if (remotes[client]) {
          client = [client];
        }
      }

      if (!util.isArray(args)) {
        if (typeof args === 'function') {
          cb = args;
        }
        args = [];
      }

      client.forEach(function(v){
        var remote = remotes[v];
        var argsClone = args.slice(0);
        if (cb) {
          argsClone.push(function(){
            cb.apply(this, Array.prototype.concat.apply([v], arguments));
          });        
        }
        remote[method].apply(remote, argsClone);
      });
    },
    register: function(s, cb){
      var md = {}, cid;
      var finalize = function(cId, cMeta){
        id = cId;
        if (typeof cMeta === "string") {
          cMeta = JSON.parse(cMeta);
        }
        metadata = cMeta;
        console.log("%s : %s", identifier(), "CONNECTED");
        clients[id] = metadata;
        d.emit("registered", id);
        cb(id, metadata);
      };
      var callback = function(err, md){
        if (err) {
          createId(function(cid){
            finalize(cid.id, cid.metadata);
          });
        } else {
          finalize(s, md);
        }
      };
      if (s) {
        db.get(s, callback);
      } else {
        callback(true);
      }
    }
  });
  d.on('remote', function(remote){
    d.on("registered", function(id){
      remotes[id] = remote;
    });
  });
  d.pipe(stream).pipe(d);
  stream.on('close', function(){
    if (id && clients[id]) {
      delete clients[id];
      delete remotes[id];
      console.log("%s : %s", identifier(), "DISCONNECTED");
    }
  });
});

sock.install(server, '/command');
