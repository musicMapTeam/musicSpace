for (const k of Object.keys(sessions)) { await sessions[k].ctx.close().catch(() => {}); delete sessions[k]; }
return 'closed';
