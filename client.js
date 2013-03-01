var domready = require('domready');
var reconnect = require('reconnect');
var shoe = require('shoe');
var dnode = require('dnode');

var cookie = {
  get: function (key) {
    return unescape(document.cookie.replace(new RegExp("(?:^|.*;\\s*)" + escape(key).replace(/[\-\.\+\*]/g, "\\$&") + "\\s*\\=\\s*((?:[^;](?!;))*[^;]?).*"), "$1"));
  },
  set: function (key, value) {
    if (!key || /^(?:expires|max\-age|path|domain|secure)$/i.test(key)) { return; }
    document.cookie = escape(key) + "=" + escape(value);
  }
};

domready(function(){
  var textbox = document.createElement("div");
  var iframe = document.createElement("iframe");
  textbox.style.display = "none";
  iframe.style.display = "none";
  textbox.style.height = window.innerHeight + "px";
  iframe.style.height = window.innerHeight + "px";

  window.addEventListener("resize", function(){
    textbox.style.height = window.innerHeight + "px";
    iframe.style.height = window.innerHeight + "px";    
  }, false);
  document.body.appendChild(textbox);
  document.body.appendChild(iframe);

  var uuid = cookie.get('uuid');
  var stream = shoe('/command');

  reconnect(function(stream){
    var d = dnode({
      log: function(logs, cb){
        console.log(logs);
        if (cb) { cb(true); }
      },
      reload: function(cb){
        if (cb) { cb("Reloading."); }
        window.location.reload();
      },
      iframe: function(src, cb){
        textbox.style.display = "none";
        iframe.style.display = "block";
        iframe.setAttribute("src", src);
        if (cb) { cb("Set iFrame."); }
      },
      text: function(text, cb){
        iframe.style.display = "none";
        textbox.style.display = "block";
        textbox.textContent = text;
        if (cb) { cb("Set text."); }
      },
      youtube: function(idOrLink, cb){
        iframe.style.display = "none";
        textbox.style.display = "block";
        textbox.innerHTML = "";
        Youtube.loadVideo(idOrLink, { loop: 1 });
        if (cb) { cb("Set youtube."); }
      },
      pdf: function(pdfLink, cb){
        iframe.style.display = "none";
        textbox.style.display = "block";
        textbox.innerHTML = "<div id='pdf-slideshow'></div>";

        var scribd_doc = scribd.Document.getDocFromUrl(pdfLink, "pub-30476398382781026969");
        scribd_doc.addParam('jsapi_version', 2);
        scribd_doc.addParam('mode', 'slideshow');
        scribd_doc.write('pdf-slideshow');

        window.scribd_doc = scribd_doc;

        if (cb) { cb("Set pdf."); }
      },
      pdf_page: function(page, cb){
        if (window.scribd_doc && window.scribd_doc.api) {
          window.scribd_doc.api.setPage(page);
        }
      }
    });
    d.on('remote', function(remote){
      window.remote = remote;
      remote.register(uuid, function(id, md){
        if (window.location.hash && window.location.hash.length > 1) {
          remote.sessionSet("name", window.location.hash.substr(1));
          history.replaceState({}, "", window.location.href.substring(0,window.location.href.indexOf("#")));
        }
        cookie.set('uuid', id);
      });
    });
    d.pipe(stream).pipe(d);
  }).connect('/command');

  Youtube.setContainer($(textbox));
  $(window).resize(debounce(Youtube.resizeVideo, 300));
});