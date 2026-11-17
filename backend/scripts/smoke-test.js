const base=(process.env.FIT_API_URL||"http://localhost:5000").replace(/\/$/,"");
const checks=[];
async function check(name,fn){try{await fn();checks.push({name,ok:true});}catch(error){checks.push({name,ok:false,error:error.message});}}
async function json(path,options={}){const response=await fetch(base+path,options);return {response,data:await response.json().catch(()=>({}))};}
await check("health endpoint",async()=>{
  const {response,data}=await json("/api/health");
  if(!response.ok||data.status!=="ok")throw new Error("Expected HTTP 200 and status=ok; received "+response.status+" / "+JSON.stringify(data));
});
for(const path of ["/api/auth/me","/api/activity/today","/api/activity/leaderboard","/api/activity/notifications","/api/membership/access"]){
  await check("authentication required: "+path,async()=>{
    const {response}=await json(path);
    if(response.status!==401)throw new Error("Expected 401 without a bearer token; received "+response.status);
  });
}
await check("untrusted browser origin is not allowed",async()=>{
  const response=await fetch(base+"/api/health",{method:"OPTIONS",headers:{Origin:"https://untrusted.invalid", "Access-Control-Request-Method":"GET"}});
  if(response.headers.get("access-control-allow-origin"))throw new Error("Untrusted origin received Access-Control-Allow-Origin");
});
const failed=checks.filter(item=>!item.ok);
for(const item of checks)console.log((item.ok?"PASS ":"FAIL ")+item.name+(item.error?" — "+item.error:""));
console.log("\\n"+(checks.length-failed.length)+"/"+checks.length+" smoke checks passed");
if(failed.length)process.exitCode=1;
