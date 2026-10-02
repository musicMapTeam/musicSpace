import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invitation,invitationUrl,previewPath,nfcInvitation,admissionRoute} from '../runtime-preview/src/admission-protocol.js';
const base='https://space.example/event-room/',code='ABCDEFGH2345';
test('QR, NDEF and native GATT carry the exact same identity-free invitation',()=>{
 const target={kind:'room',code},url=invitationUrl(base+'?token=secret#private',target);
 assert.equal(url,base+'?room='+code);
 assert.deepEqual(nfcInvitation(base,target),{records:[{recordType:'url',data:url}]});
 assert.deepEqual(invitation(url,{base,allowCode:false}),target);
 assert.equal(previewPath(target),'/preview/'+code);
 assert.deepEqual(invitation(' abcdefgh2345 ',{base}),target);
});
test('foreign, credential-bearing, ambiguous and malformed transport values are rejected',()=>{
 const suffix='?room='+code;
 for(const value of ['https://other.example/event-room/'+suffix,'https://space.example/other/'+suffix,'https://u:p@space.example/event-room/'+suffix,base+suffix+'#photo',base+suffix+'&room='+code,base+suffix+'&community='+code,base+suffix+'&token=secret',base+'?room=invalid','javascript:alert(1)','//space.example/event-room/'+suffix,base+suffix+'\n'])assert.throws(()=>invitation(value,{base,allowCode:false}),undefined,value);
 assert.throws(()=>invitation(base+'?community='+code,{base,kind:'room'}));
 assert.throws(()=>nfcInvitation('http://127.0.0.1/event-room/',{kind:'room',code}),/HTTPS/);
});
test('community transport opens only its explicit community preview',()=>{
 const target={kind:'community',code};
 assert.deepEqual(invitation(invitationUrl(base,target),{base,kind:'community'}),target);
 assert.equal(previewPath(target),'/communities/preview/'+code);
});
test('shared Node/Worker native routes preserve legacy preview and explicit join guards',()=>{
 assert.equal(admissionRoute('/admission/room/'+code+'/preview','GET'),'/preview/'+code);
 assert.equal(admissionRoute('/admission/room/'+code+'/join','POST'),'/rooms/'+code+'/join');
 assert.equal(admissionRoute('/admission/community/'+code+'/preview','GET'),'/communities/preview/'+code);
 for(const [path,method] of [['/admission/room/'+code+'/join','GET'],['/admission/room/'+code+'/preview','POST'],['/admission/community/'+code+'/join','POST'],['/admission/room/invalid/preview','GET']])assert.equal(admissionRoute(path,method),path);
});
