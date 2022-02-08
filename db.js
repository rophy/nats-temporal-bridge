
// in-memory store
const db = {};

module.exports.add = (subject, namespace, workflowId, signal, sub) => {
  // intentionally avoided lodash since I don't want to validate param formats.
  if (!db[subject]) db[subject] = {};
  if (!db[subject][namespace]) db[subject][namespace] = {};
  if (!db[subject][namespace][workflowId]) db[subject][namespace][workflowId] = {};
  db[subject][namespace][workflowId][signal] = sub;
};

module.exports.remove = (subject, namespace, workflowId, signal) => {
  let sub = null;
  if (db[subject]) {

    if (db[subject][namespace]) {

      if (db[subject][namespace][workflowId]) {

        if (db[subject][namespace][workflowId][signal]) {
          sub = db[subject][namespace][workflowId][signal];
          delete db[subject][namespace][workflowId][signal];
        }

        if (Object.keys(db[subject][namespace][workflowId]).length === 0) {
          delete db[subject][namespace][workflowId];
        }

      }

      if (Object.keys(db[subject][namespace]).length === 0) {
        delete db[subject][namespace];
      }
    }

    if (Object.keys(db[subject]).length === 0) {
        delete db[subject];
    }
  }

  return sub;
};

module.exports.hasSubject = (subject) => {
  return db.hasOwnProperty(subject);
};


module.exports.iterate = (subject, callback) => {
  if (!db[subject]) return;
  for(let namespace in db[subject]) {
    for(let workflowId in db[subject][namespace]) {
      for(let signal in db[subject][namespace][workflowId]) {
        callback(namespace, workflowId, signal);
      }
    }
  }
};
