const { Connection, WorkflowClient } = require('@temporalio/client');
const { body, validationResult } = require('express-validator');
const express = require('express');
const nats = require('nats');
const _ = require('lodash');
const sc = nats.StringCodec();

const app = express();
const port = 3000;


const servers = ["localhost:4442"];

// in-memory store
const db = {};


// nats client.
let nc = null;

// temporal connection.
let temporalConnection = null;


app.use(require('body-parser').json());


app.post('/subscribe', (req, res) => {
  
  body('subject').notEmpty();
  body('namespace').notEmpty();
  body('workflowId').notEmpty();
  body('signal').notEmpty();


  let subject = req.body.subject;
  let namespace = req.body.namespace;
  let workflowId = req.body.workflowId;
  let signal = req.body.signal;
  
  console.log('/subscribe', subject, namespace, workflowId, signal);

  // intentionally avoided lodash since I don't want to validate param formats.
  if (!db[subject]) db[subject] = {};
  if (!db[subject][namespace]) db[subject][namespace] = {};
  if (!db[subject][namespace][workflowId]) db[subject][namespace][workflowId] = {};
  
  
  // todo: this should be done after nc is initialized.
  let sub = nc.subscribe(subject, {
    callback: (err, msg) => onNatsSubject(err, subject, msg)
  });
  db[subject][namespace][workflowId][signal] = sub;
  
  res.status(200).end();
  
});

app.post('/publish', (req, res) => {
  body('subject').notEmpty();
  
  console.log('publish', req.body.subject, sc.encode(req.body.message));
  nc.publish(req.body.subject, sc.encode(req.body.message));
  
  res.status(200).end();
  
});

async function init() {
  nc = await nats.connect(servers);
  console.log(`connected to nats: ${servers}`);
  
  
  temporalConnection = new Connection({});
  console.log(`connected to temporal: {}`);
  
  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
  
}


async function onNatsSubject(err, subject, msg) {
  console.log('onNatsSubject', err, subject);
  if (err) return console.error(err);
  if (!db[subject]) return console.warn(`subscribed nats topic without temporal subscribers: ${subject}`);
  
  let data = sc.decode(msg.data);
  if (data) data = JSON.stringify(msg.data);
  console.log('data', data);
  for(let namespace in db[subject]) {
    let temporalClient = new WorkflowClient(temporalConnection.service, {
      namespace: namespace
    });
    for(let workflowId in db[subject][namespace]) {
      let handle = temporalClient.getHandle(workflowId);
      for(let signal in db[subject][namespace][workflowId]) {
        try {
          console.log('onNatsSubject', subject, namespace, workflowId, signal);
          await handle.signal(signal);
        } catch(signalErr) {          
          console.trace('onNatsSubject', signalErr, signalErr.code);
          // NOT_FOUND: instace of Error, { code: 5, details: "sql: no rows in result set" }
          // bad, but couldn't figure out a better way
          if (signalErr.code === 5) {
            console.info(`workflow ${workflowId} no longer exists, removing from subscribers`);
            let sub = db[subject][namespace][workflowId][signal];
            delete db[subject][namespace][workflowId][signal];
            if (Object.keys(db[subject][namespace][workflowId]).length === 0) {
              delete db[subject][namespace][workflowId];
              if (Object.keys(db[subject][namespace]).length === 0) {
                delete db[subject][namespace];
                if (Object.keys(db[subject]).length === 0) {
                  delete db[subject];
                  console.log(`unsubscribing nats subject: ${subject}`);
                  sub.unsubscribe();
                }
              }
            }
          } else {
             console.error('onNatsSubject', signalErr);
          }
        }
      }
    }
  }
}


init();