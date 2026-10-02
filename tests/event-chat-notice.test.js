import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingSavedMessageNotice} from '../web/event-room/chat-panel.js';
const confirmed={type:'send',saved:true,peerId:'peer-a',messageId:'message-a'};
test('a confirmed server save remains explicit when its history refresh has not arrived',()=>{
 assert.match(pendingSavedMessageNotice({lastResult:confirmed,current:{peerId:'peer-a',messages:[]},error:{message:'网络断开'}}),/已由服务保存.*不必重发/);
});
test('pending or unrelated messages never claim server confirmation',()=>{
 assert.equal(pendingSavedMessageNotice({lastResult:null,current:{peerId:'peer-a',messages:[]}}),null);
 assert.equal(pendingSavedMessageNotice({lastResult:{...confirmed,saved:false},current:{peerId:'peer-a',messages:[]}}),null);
 assert.equal(pendingSavedMessageNotice({lastResult:confirmed,current:{peerId:'peer-b',messages:[]}}),null);
});
test('confirmed history replacing the provisional save notice removes the notice',()=>{
 assert.equal(pendingSavedMessageNotice({lastResult:confirmed,current:{peerId:'peer-a',messages:[{id:'message-a'}]}}),null);
});
