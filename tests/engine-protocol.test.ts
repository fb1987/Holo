import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { CodexRuntime, type AgentRunOptions } from "../server/codex.js";

const fakeServer = String.raw`
import {createInterface} from 'node:readline';
const out=m=>process.stdout.write(JSON.stringify(m)+'\n');
let turn='turn-1',thread='thread-1',initialized=false,mode='';
const complete=()=>{out({method:'item/completed',params:{threadId:thread,turnId:turn,item:{type:'agentMessage',phase:'final_answer',id:'message-1',text:'{"ok":true}'}}});out({method:'turn/completed',params:{threadId:thread,turn:{id:turn,status:'completed',items:[]}}});};
createInterface({input:process.stdin}).on('line',line=>{
 const m=JSON.parse(line);
 if(m.id==='server-approval'){complete();return;}
 if(m.method==='initialized'){initialized=true;return;}
 if(m.method==='initialize'){out({id:m.id,result:{userAgent:'test'}});return;}
 if(!initialized){out({id:m.id,error:{code:1,message:'Handshake required'}});return;}
 if(m.method==='account/read')out({id:m.id,result:{account:{type:'chatgpt',planType:'pro'},requiresOpenaiAuth:true}});
 else if(m.method==='model/list')out({id:m.id,result:{data:[{id:'model-id',model:'test-model',displayName:'Test model',isDefault:true,supportedReasoningEfforts:[{reasoningEffort:'high'}]}]}});
 else if(m.method==='thread/start'||m.method==='thread/resume')out({id:m.id,result:{thread:{id:thread}}});
 else if(m.method==='turn/start'){
   mode=m.params.input[0].text;
   out({id:m.id,result:{turn:{id:turn}}});
   if(mode==='crash'){process.exit(7);return;}
   if(mode==='approval'){out({id:'server-approval',method:'item/commandExecution/requestApproval',params:{threadId:thread,turnId:turn,command:'test command'}});return;}
   if(mode==='wait'){out({method:'item/started',params:{threadId:thread,turnId:turn,item:{type:'reasoning'}}});return;}
   if(mode==='whitespace'){out({method:'item/agentMessage/delta',params:{threadId:thread,turnId:turn,itemId:'message-1',delta:'{"value":'+' '.repeat(3000)}});return;}
   out({method:'item/agentMessage/delta',params:{threadId:thread,turnId:turn,itemId:'message-1',delta:'{"ok":true}'}});
   complete();
 }else if(m.method==='turn/interrupt'){out({id:m.id,result:{}});out({method:'turn/completed',params:{threadId:thread,turn:{id:turn,status:'interrupted'}}});}
 else out({id:m.id,error:{code:-32601,message:'Unknown method'}});
});
`;
async function runtime(t: test.TestContext) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "holo-rpc-test-"));
  await writeFile(path.join(dir, "fake.mjs"), fakeServer);
  const codex = new CodexRuntime(dir, {
    binary: process.execPath,
    args: [path.join(dir, "fake.mjs")],
  });
  t.after(async () => {
    await codex.close();
    await rm(dir, { recursive: true, force: true });
  });
  return { codex, dir };
}
function options(
  dir: string,
  extra: Partial<AgentRunOptions> = {},
): AgentRunOptions {
  return {
    cwd: dir,
    instructions: "Test only",
    prompt: "complete",
    outputSchema: { type: "object" },
    onThread: () => {},
    onEvent: () => {},
    ...extra,
  };
}
test("app-server handshake, account/models and completed streamed turn use real JSONL transport", async (t) => {
  const { codex, dir } = await runtime(t),
    status = await codex.connect();
  assert.equal(status.connected, true);
  assert.equal(status.authenticated, true);
  assert.equal(status.planType, "pro");
  assert.equal((await codex.models())[0].id, "test-model");
  let thread = "";
  const events: string[] = [];
  const output = await codex.run(
    options(dir, {
      onThread: (id) => {
        thread = id;
      },
      onEvent: (method) => events.push(method),
    }),
  );
  assert.equal(thread, "thread-1");
  assert.equal(output, '{"ok":true}');
  assert.ok(events.includes("item/agentMessage/delta"));
  assert.ok(events.includes("turn/completed"));
  assert.equal(
    await codex.run(options(dir, { threadId: thread })),
    '{"ok":true}',
  );
});
test("server-initiated approval is held until the client replies", async (t) => {
  const { codex, dir } = await runtime(t);
  let approval = false;
  codex.on("request", (rpc) => {
    approval = true;
    assert.equal(rpc.method, "item/commandExecution/requestApproval");
    codex.respond(rpc.id, { decision: "accept" });
  });
  const output = await codex.run(options(dir, { prompt: "approval" }));
  assert.equal(approval, true);
  assert.equal(output, '{"ok":true}');
});
test("cancellation rejects active turn and disconnect cannot leave a hanging run", async (t) => {
  const { codex, dir } = await runtime(t),
    ctrl = new AbortController();
  await assert.rejects(
    () =>
      codex.run(
        options(dir, {
          prompt: "wait",
          signal: ctrl.signal,
          onEvent: (method) => {
            if (method === "item/started") ctrl.abort();
          },
        }),
      ),
    /cancelled/,
  );
  await assert.rejects(
    () => codex.run(options(dir, { prompt: "crash" })),
    /stopped/,
  );
  assert.equal(codex.status().connected, false);
});
test("unbounded structured whitespace is interrupted, and the next turn can complete", async (t) => {
  const { codex, dir } = await runtime(t);
  await assert.rejects(
    () => codex.run(options(dir, { prompt: "whitespace" })),
    /stalled while formatting/,
  );
  assert.equal(
    await codex.run(options(dir, { threadId: "thread-1" })),
    '{"ok":true}',
  );
});
test("native tool probes retry once, deduplicate, and refresh on explicit connection", async (t) => {
  const { codex, dir } = await runtime(t);
  const executable = path.join(dir, "python-probe");
  const countFile = path.join(dir, "probe-count");
  await writeFile(
    executable,
    `#!${process.execPath}\nconst fs=require('node:fs');const path=require('node:path');const file=path.join(__dirname,'probe-count');let count=0;try{count=Number(fs.readFileSync(file,'utf8'));}catch{}fs.writeFileSync(file,String(++count));if(count<3)process.exit(1);process.stdout.write('5.2.1');\n`,
    { mode: 0o755 },
  );
  await writeFile(
    path.join(dir, "tools.json"),
    JSON.stringify({ blenderPython: executable }),
  );
  await Promise.all([codex.configureTools(), codex.configureTools()]);
  assert.equal(await readFile(countFile, "utf8"), "2");
  assert.equal(codex.status().tools.blender, false);
  await codex.connect();
  assert.equal(await readFile(countFile, "utf8"), "3");
  assert.equal(codex.status().tools.blender, true);
});
