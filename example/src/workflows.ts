import { proxyActivities } from '@temporalio/workflow';
import * as wf from '@temporalio/workflow';

// Only import the activity types
import type * as activities from './activities';

const { greet, waitNatsEvent } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

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

  await greet(name);
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
