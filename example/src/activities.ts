import { Context } from '@temporalio/activity'
import axios from 'axios';

export async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}

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