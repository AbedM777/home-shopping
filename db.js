// Connects the app to Firestore. The family code comes from the link (#k=...) and is kept on this device.
(function () {
  var m = location.hash.match(/k=([A-Za-z0-9]{20,})/);
  var code = m ? m[1] : null;
  try {
    if (code) localStorage.setItem("familyCode", code);
    else code = localStorage.getItem("familyCode");
  } catch (e) {}
  if (code && !m) { try { history.replaceState(null, "", location.pathname + location.search + "#k=" + code); } catch (e) {} }
  window.FAMILY_CODE = code;
  var dev = null;
  try { dev = localStorage.getItem("deviceId"); if (!dev) { dev = "d" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem("deviceId", dev); } } catch (e) { dev = "d" + Math.random().toString(36).slice(2, 12); }
  window.DEVICE_ID = dev;

  function makeDb(fs, prefix) {
    var mapPath = function (path) { var seg = path.split("/"); seg[0] = prefix + seg[0]; return seg.join("/"); };
    var wrapDoc = function (ref) {
      return {
        id: ref.id, path: ref.path,
        get: function () { return ref.get(); },
        set: function (d) { return ref.set(d); },
        update: function (d) { return ref.update(d); },
        delete: function () { return ref.delete(); },
        onSnapshot: function (n, e) { return ref.onSnapshot({ includeMetadataChanges: true }, n, e); },
        // short cooperative lock, so two phones don't create the same month at once
        acquire: function (opt) {
          var ttl = (opt && opt.ttlMs) || 30000, holder = (opt && opt.holder) || "x";
          return fs.runTransaction(function (tx) {
            return tx.get(ref).then(function (s) {
              var d = s.exists ? s.data() : {};
              if (d.lockUntil && d.lockUntil > Date.now() && d.lockBy !== holder) return { acquired: false };
              tx.set(ref, { lockUntil: Date.now() + ttl, lockBy: holder }, { merge: true });
              return { acquired: true };
            });
          });
        },
      };
    };
    var wrapQuery = function (q) {
      return {
        where: function (f, op, v) { return wrapQuery(q.where(f, op, v)); },
        orderBy: function (f, dir) { return wrapQuery(q.orderBy(f, dir)); },
        limit: function (n) { return wrapQuery(q.limit(n)); },
        get: function () { return q.get(); },
        onSnapshot: function (n, e) { return q.onSnapshot({ includeMetadataChanges: true }, n, e); },
      };
    };
    return {
      doc: function (path) { return wrapDoc(fs.doc(mapPath(path))); },
      collection: function (name) {
        var c = fs.collection(prefix + name);
        var w = wrapQuery(c);
        w.add = function (d) { return c.add(d); };
        w.doc = function (id) { return wrapDoc(id ? c.doc(id) : c.doc()); };
        return w;
      },
    };
  }

  window.APP_DB_READY = (async function () {
    var cfg = window.FIREBASE_CONFIG;
    if (!code || !window.firebase || !cfg || !cfg.projectId) return null;
    firebase.initializeApp(cfg);
    var fs = firebase.firestore();
    try { await fs.enablePersistence({ synchronizeTabs: true }); } catch (e) {}
    return makeDb(fs, "hb_" + code + "_");
  })();
})();
