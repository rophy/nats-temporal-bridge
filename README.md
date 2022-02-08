# nats-temporal-bridge

A web service that connect Temporal signals with NATS events.

##

Temporal workflows are implemented as activities, the activities cannot be long-running services, as these activities are supposed to be steps of a distributed workflow.

While you can implement a repeating activity that polls for NATS events continuously, it's much more effective to have a long-running service that subscribe to NATS events.

This web service acts as the bridge between NATS events and Temporal workflows. It is a long-running web service that subscribes to NATS topics, and signals Temporal workflows as necssary.


## Getting Started

Assuming both NATS and Temporal service are running on localhost with default ports.

First, start this bridge service:


```bash
npm install
node app.js
```

Then, you can create a temporal workflow like this:


```typescript
import { proxyActivities } from '@temporalio/workflow';
import * as wf from '@temporalio/workflow';

// Only import the activity types
import type * as activities from './activities';

const { waitNatsEvent } = proxyActivities<typeof activities>({});

export const unblockSignal = wf.defineSignal<[string]>('unblock');
export const isBlockedQuery = wf.defineQuery<boolean>('isBlocked');

/** A workflow that simply calls an activity */
export async function example(name: string): Promise<string> {
  let isBlocked = true;
  let result = "";
  wf.setHandler(unblockSignal, (payload: string) => {
    isBlocked = false;
    result = payload;
  });
  wf.setHandler(isBlockedQuery, () => isBlocked);

  await waitNatsEvent(name, 'unblock');

  console.log('Blocked');
  try {
    await wf.condition(() => !isBlocked);
    console.log('Unblocked', result);
  } catch (err) {
    if (err instanceof wf.CancelledFailure) {
      console.log('Cancelled');
    }
    throw err;
  }
  return result;
}

```

With the `waitNatsEvent` activity as:

```typescript
import { Context } from '@temporalio/activity'
import axios from 'axios';

export async function waitNatsEvent(subject: string, signal: string): Promise<string> {
  let info = Context.current().info;
  let resp = await axios.post('http://localhost:3000/subscribe', {
    subject: subject,
    namespace: info.activityNamespace,
    workflowId: info.workflowExecution.workflowId,
    signal: signal
  });
  return `response=${resp.status}`;
}
```
