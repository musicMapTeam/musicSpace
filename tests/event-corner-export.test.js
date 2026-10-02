import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cornerExportable} from '../web/event-room/corner-panel.js';
const context={id:'synthetic-corner',actor:'self',revision:4};
const snapshot=()=>({actorId:'self',corner:{id:'synthetic-corner',status:'active',joined:true,materialValid:true,eligible:true,ownSaved:true,myConfirmed:true,peerConfirmed:true,revision:4},contributions:[{userId:'self'},{userId:'peer'}]});
test('creation export requires the same viewer, saved version and both current permissions',()=>{
 assert.equal(cornerExportable(snapshot(),context),true);
 for(const field of ['joined','materialValid','eligible','ownSaved','myConfirmed','peerConfirmed']){const value=snapshot();value.corner[field]=false;assert.equal(cornerExportable(value,context),false,field);}
 for(const patch of [{revision:5},{id:'other'},{status:'withdrawn'}]){const value=snapshot();Object.assign(value.corner,patch);assert.equal(cornerExportable(value,context),false);}
 const switched=snapshot();switched.actorId='other';assert.equal(cornerExportable(switched,context),false);
});
test('creation export cannot substitute duplicate people or omit the current person',()=>{
 for(const contributions of [[{userId:'peer'},{userId:'peer'}],[{userId:'stranger'},{userId:'peer'}],[{userId:'self'}],[]]){const value=snapshot();value.contributions=contributions;assert.equal(cornerExportable(value,context),false);}
});
