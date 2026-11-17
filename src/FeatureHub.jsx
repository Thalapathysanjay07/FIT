import {useEffect,useMemo,useRef,useState} from "react";
import ActivityRewards from "./ActivityRewards.jsx";
import {Activity,ArrowDownToLine,CalendarDays,CheckCircle2,Clock3,Dumbbell,Download,Flame,Footprints,HeartPulse,Search,Settings,ShieldCheck,Target,Timer,Trash2,UserRound,Wind,Zap} from "lucide-react";

const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const catalog=[
 {name:"Bodyweight squat",group:"Lower body",equipment:"None",level:"Beginner",sets:"3 × 10–12",steps:["Stand with feet about shoulder-width apart.","Sit hips back and bend knees while keeping chest comfortable and upright.","Push through the whole foot to stand."]},
 {name:"Incline push-up",group:"Chest",equipment:"Bench or wall",level:"Beginner",sets:"3 × 8–12",steps:["Place hands on a stable raised surface.","Keep body in a straight line and lower chest toward the surface.","Push away smoothly without locking elbows hard."]},
 {name:"Glute bridge",group:"Glutes",equipment:"Mat",level:"Beginner",sets:"3 × 12–15",steps:["Lie on your back with knees bent and feet flat.","Brace gently and lift hips until shoulders, hips and knees align.","Lower with control; avoid over-arching your back."]},
 {name:"Bird dog",group:"Core",equipment:"Mat",level:"Beginner",sets:"3 × 8 each side",steps:["Start on hands and knees with a neutral spine.","Reach opposite arm and leg away from your body.","Return slowly and switch sides without rotating hips."]},
 {name:"Prone Y-T-W",group:"Back",equipment:"Mat",level:"Beginner",sets:"2 × 6 each shape",steps:["Lie face down with forehead supported and ribs relaxed.","Raise arms into a Y, then T, then W shape using a small controlled range.","Keep shoulders away from ears and stop if your neck or back feels strained."]},
 {name:"Reverse lunge",group:"Lower body",equipment:"None",level:"Beginner",sets:"3 × 8 each side",steps:["Stand tall and step one foot backward.","Lower only as far as comfortable while keeping balance.","Drive through the front foot and return."]},
 {name:"Dumbbell row",group:"Back",equipment:"Dumbbells",level:"Beginner",sets:"3 × 10 each side",steps:["Support one hand on a stable bench or chair.","Pull the weight toward your hip while keeping back neutral.","Lower slowly and repeat; avoid twisting."]},
 {name:"Dumbbell shoulder press",group:"Shoulders",equipment:"Dumbbells",level:"Intermediate",sets:"3 × 8–10",steps:["Hold light dumbbells near shoulder height.","Press upward in a comfortable range without arching your back.","Lower slowly to the starting position."]},
 {name:"Resistance-band row",group:"Back",equipment:"Resistance bands",level:"Beginner",sets:"3 × 10–12",steps:["Anchor a resistance band securely at chest height.","Pull elbows back while keeping shoulders relaxed.","Return slowly and keep the band under control."]},
 {name:"Band overhead press",group:"Shoulders",equipment:"Resistance bands",level:"Beginner",sets:"3 × 8–10",steps:["Stand on the middle of a resistance band and hold the ends near shoulders.","Press upward in a comfortable range without leaning back.","Lower slowly and keep tension controlled."]},
 {name:"Romanian deadlift",group:"Posterior chain",equipment:"Dumbbells",level:"Intermediate",sets:"3 × 8–10",steps:["Hold weights in front of thighs with soft knees.","Push hips back and lower weights close to legs with a neutral spine.","Stand by driving hips forward; stop if your back rounds."]},
 {name:"Plank",group:"Core",equipment:"Mat",level:"Beginner",sets:"3 × 20–40 sec",steps:["Place forearms and toes on the floor; use knees for an easier option.","Keep ribs and pelvis aligned and breathe steadily.","Stop when you cannot maintain position."]},
 {name:"Step-up",group:"Lower body",equipment:"Stable step",level:"Beginner",sets:"3 × 10 each side",steps:["Use a low, stable step.","Place the whole foot on the step and rise under control.","Step down slowly; hold a support if balance is difficult."]},
 {name:"Dead bug",group:"Core",equipment:"Mat",level:"Beginner",sets:"3 × 8 each side",steps:["Lie on your back with arms up and knees bent.","Slowly lower opposite arm and leg while keeping lower back comfortable.","Return and alternate sides."]},
 {name:"Jumping jack",group:"Conditioning",equipment:"None",level:"Beginner",sets:"3 × 30 sec",steps:["Start standing with arms by your sides.","Step or jump feet apart as arms rise overhead.","Return smoothly; use step-outs for low impact."]},
 {name:"Mountain climber",group:"Conditioning",equipment:"Mat",level:"Intermediate",sets:"3 × 20 sec",steps:["Start in a stable high plank.","Bring one knee toward chest, then switch at a controlled pace.","Keep shoulders over wrists and hips steady."]},
 {name:"Cat-cow mobility",group:"Mobility",equipment:"Mat",level:"Beginner",sets:"2 × 8 cycles",steps:["Start on hands and knees.","Gently round spine, then move into a comfortable extension.","Move slowly with your breath; avoid forcing range."]},
 {name:"Wall sit",group:"Lower body",equipment:"Wall",level:"Beginner",sets:"3 × 20–40 sec",steps:["Lean against a wall and walk feet forward.","Slide down only to a comfortable knee angle.","Hold while breathing, then stand slowly."]}
];
const mealIdeas={
 "Vegetarian":[
  {slot:"Breakfast",name:"Oats, milk or soy milk & banana",cal:360,protein:16,why:"Fibre-rich breakfast with a useful protein base"},
  {slot:"Lunch",name:"Dal, rice, curd & vegetables",cal:520,protein:22,why:"A balanced mix of lentils, grains and vegetables"},
  {slot:"Snack",name:"Roasted chana & fruit",cal:220,protein:10,why:"Portable snack with fibre and plant protein"},
  {slot:"Dinner",name:"Paneer or tofu, chapati & vegetables",cal:480,protein:28,why:"Protein-focused dinner with vegetables"}
 ],
 "Mixed diet":[
  {slot:"Breakfast",name:"Eggs, whole-grain toast & fruit",cal:360,protein:23,why:"Protein-rich breakfast with carbohydrates"},
  {slot:"Lunch",name:"Chicken, rice & vegetables",cal:540,protein:38,why:"Lean protein with a satisfying grain portion"},
  {slot:"Snack",name:"Curd or yogurt & banana",cal:210,protein:10,why:"Simple snack with protein and carbohydrates"},
  {slot:"Dinner",name:"Dal, chapati, vegetables & egg",cal:470,protein:25,why:"Balanced meal with mixed protein sources"}
 ],
 "Vegan":[
  {slot:"Breakfast",name:"Soy milk oats, chia & banana",cal:360,protein:19,why:"Plant-based breakfast with fibre"},
  {slot:"Lunch",name:"Chickpea rice bowl & vegetables",cal:520,protein:20,why:"Legumes provide plant protein and fibre"},
  {slot:"Snack",name:"Roasted chana & fruit",cal:220,protein:10,why:"Convenient plant-based snack"},
  {slot:"Dinner",name:"Tofu, chapati & mixed vegetables",cal:480,protein:27,why:"Tofu-based protein with a balanced plate"}
 ]
};
const days=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const sessions=[
 {title:"Full body strength",focus:"Strength",items:["Bodyweight squat","Incline push-up","Dumbbell row","Glute bridge","Bird dog"]},
 {title:"Lower body + core",focus:"Strength",items:["Reverse lunge","Romanian deadlift","Glute bridge","Dead bug","Plank"]},
 {title:"Upper body + core",focus:"Strength",items:["Incline push-up","Dumbbell row","Dumbbell shoulder press","Bird dog","Plank"]},
 {title:"Conditioning + mobility",focus:"Conditioning",items:["Jumping jack","Mountain climber","Cat-cow mobility","Dead bug"]}
];

function WalkingTracker({onToast}){
 const date=todayKey();
 const [steps,setSteps]=useState(()=>read("fit-steps-"+date,0));
 const [target,setTarget]=useState(()=>read("fit-step-goal",8000));
 const [manual,setManual]=useState("");
 const [source,setSource]=useState(()=>read("fit-step-source","Manual"));
 const [status,setStatus]=useState("Not connected");
 const [busy,setBusy]=useState(false);
 const [heartRate,setHeartRate]=useState(null);
 const pedometerRef=useRef(null);
 const [tracking,setTracking]=useState(false);
 useEffect(()=>()=>{if(pedometerRef.current){pedometerRef.current.remove?.();import("@capgo/capacitor-pedometer").then(({CapacitorPedometer})=>CapacitorPedometer.stopMeasurementUpdates()).catch(()=>{});}},[]);
 const distanceKm=steps*0.00075;
 const calories=Math.round(steps*0.04);
 useEffect(()=>localStorage.setItem("fit-steps-"+date,JSON.stringify(steps)),[steps,date]);
 useEffect(()=>localStorage.setItem("fit-step-goal",JSON.stringify(target)),[target]);
 async function startPhoneTracking(){
   try{
     const {CapacitorPedometer}=await import("@capgo/capacitor-pedometer");
     const available=await CapacitorPedometer.isAvailable();
     if(!available.stepCounting)throw new Error("This phone does not expose a supported step sensor.");
     let permission=await CapacitorPedometer.checkPermissions();
     if(permission.activityRecognition!=="granted"){
       await CapacitorPedometer.requestPermissions();
       permission=await CapacitorPedometer.checkPermissions();
     }
     if(permission.activityRecognition!=="granted")throw new Error("Activity recognition permission was not granted. Enable it in Android app settings to count steps.");
     if(pedometerRef.current)await pedometerRef.current.remove();
     pedometerRef.current=await CapacitorPedometer.addListener("measurement",data=>{
       const count=Math.max(0,Number(data.numberOfSteps)||0);
       setSteps(v=>Math.max(v,count));
       setSource("Phone sensor");
       localStorage.setItem("fit-step-source","Phone sensor");
     });
     await CapacitorPedometer.startMeasurementUpdates();
     setTracking(true);
     setStatus("Phone step sensor is tracking while FIT is active");
   }catch(error){setStatus(error.message||"Phone step tracking is unavailable on this device.");}
 }
 async function stopPhoneTracking(){
   try{const {CapacitorPedometer}=await import("@capgo/capacitor-pedometer");await CapacitorPedometer.stopMeasurementUpdates();await pedometerRef.current?.remove();pedometerRef.current=null;setTracking(false);setStatus("Phone step tracking paused.");}catch(error){setStatus(error.message||"Could not stop tracking.");}
 }
 async function connectAndSync(){
   setBusy(true);setStatus("Checking Health Connect…");
   try{
     const {Health}=await import("@capgo/capacitor-health");
     const availability=await Health.isAvailable();
     if(!availability.available)throw new Error(availability.reason||"Health Connect is available only in the installed mobile app, not the website preview.");
     const authorization=await Health.requestAuthorization({read:["steps","distance","calories","heartRate"],write:[]});
     const denied=authorization?.readDenied||[];
     if(denied.length)throw new Error("Health data permission not granted for: "+denied.join(", ")+". You can enable access in Health Connect settings.");
     const start=new Date();start.setHours(0,0,0,0);
     const end=new Date();
     const [stepData,distanceData,heartData]=await Promise.all([
       Health.readSamples({dataType:"steps",startDate:start.toISOString(),endDate:end.toISOString(),limit:1000}),
       Health.readSamples({dataType:"distance",startDate:start.toISOString(),endDate:end.toISOString(),limit:1000}),
       Health.readSamples({dataType:"heartRate",startDate:start.toISOString(),endDate:end.toISOString(),limit:1000})
     ]);
     const total=(stepData.samples||[]).reduce((sum,s)=>sum+Number(s.value||0),0);
     const distance=(distanceData.samples||[]).reduce((sum,s)=>sum+Number(s.value||0),0);
     const hrs=(heartData.samples||[]).map(s=>Number(s.value)).filter(n=>n>0);
     setSteps(Math.round(total));
     if(hrs.length)setHeartRate(Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length));
     setSource("Health Connect");
     localStorage.setItem("fit-step-source","Health Connect");
     localStorage.setItem("fit-distance-"+date,JSON.stringify(distance));
     setStatus("Connected · synced just now");
     onToast?.("Walking activity synced from Health Connect");
   }catch(error){
     setStatus(error.message||"Could not connect. Install/update the FIT Android app and try again.");
   }finally{setBusy(false);}
 }
 function addManual(e){
   e.preventDefault();
   const value=Number(manual);
   if(!Number.isFinite(value)||value<1||value>100000)return;
   setSteps(v=>v+Math.round(value));setSource("Manual");setManual("");
   localStorage.setItem("fit-step-source","Manual");
   onToast?.("Steps added");
 }
 async function syncStepsToAccount(){
   try{
     const response=await fetch(`${import.meta.env.VITE_API_URL||""}/api/activity/today`,{
       method:"PUT",
       headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("fit-token")}`},
       body:JSON.stringify({date,steps,stepGoal:target})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(data.error||"Could not sync walking activity.");
     onToast?.("Walking activity synced to your FIT account");
   }catch(error){setStatus(error.message||"Sign in to sync activity to your FIT account.");}
 }
 return <div className="feature-page walking-page">
   <div className="section-heading"><div><div className="eyebrow">DAILY ACTIVITY</div><h2>Walking Tracker</h2><p className="muted">Your daily movement, synced with supported health apps and fitness bands.</p></div><span className="feature-tag"><Footprints size={14}/> {source}</span></div>
   <section className="panel walking-main">
     <div className="walking-number">{steps.toLocaleString("en-IN")}<small> steps today</small></div>
     <div className="progress-track walking-progress"><div className="progress-fill" style={{width:`${Math.min(100,steps/Math.max(1,target)*100)}%`}}/></div>
     <div className="walking-goal-row"><span>{Math.min(100,Math.round(steps/Math.max(1,target)*100))}% of daily goal</span><label>Goal <input aria-label="Daily step goal" type="number" min="1000" max="50000" step="500" value={target} onChange={e=>setTarget(Math.max(1000,Number(e.target.value)||1000))}/> steps</label></div>
     <div className="walking-stats"><div><Footprints/><strong>{(distanceKm).toFixed(2)} km</strong><small>Estimated distance</small></div><div><Flame/><strong>{calories} kcal</strong><small>Estimated calories</small></div><div><HeartPulse/><strong>{heartRate?heartRate+" bpm":"—"}</strong><small>Average heart rate</small></div></div>
   </section>
   <section className="panel walking-history">
     <div className="eyebrow">YOUR LAST 7 DAYS</div><h3>Weekly walking consistency</h3>
     <div className="walking-week-grid">{Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));const key=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");const count=key===date?steps:Number(read("fit-steps-"+key,0));const pct=Math.min(100,Math.round(count/Math.max(1,target)*100));return <div className="walking-week-day" key={key}><strong>{count.toLocaleString("en-IN")}</strong><div className="walking-week-track"><span style={{height:pct+"%"}}/></div><small>{d.toLocaleDateString("en-IN",{weekday:"short"})}</small></div>})}</div>
     <p className="tiny-note">Daily totals are stored on this device. Earlier days appear when steps were logged or synced on those dates.</p>
   </section>
   <div className="walking-grid">
     <section className="panel"><div className="eyebrow">FITNESS BAND / PHONE SYNC</div><h3>Connect your device</h3><p className="tiny-note">FIT can count steps from a supported phone sensor and read steps, distance and heart-rate data shared to Android Health Connect or Apple Health by supported bands. First sync your band in its own companion app, then allow FIT access.</p><button className="primary-btn" disabled={busy} onClick={connectAndSync}>{busy?"Connecting…":"Connect / Sync Health data"}</button><button className="outline-btn walking-settings" onClick={syncStepsToAccount}>Sync steps to my FIT account</button><button className="outline-btn walking-settings" onClick={tracking?stopPhoneTracking:startPhoneTracking}>{tracking?"Pause phone step tracking":"Start phone step tracking"}</button><button className="outline-btn walking-settings" onClick={async()=>{try{const {Health}=await import("@capgo/capacitor-health");await Health.openHealthConnectSettings();}catch{setStatus("Health Connect settings are available in the installed Android app.");}}}>Open Health Connect settings</button><p className="tiny-note">{status}</p></section>
     <section className="panel"><div className="eyebrow">MANUAL STEP ENTRY</div><h3>Add steps</h3><form className="walking-manual" onSubmit={addManual}><label>Steps to add<input type="number" min="1" max="100000" value={manual} onChange={e=>setManual(e.target.value)} placeholder="e.g. 2500" required/></label><button className="outline-btn">Add steps</button></form><p className="tiny-note">Manual entries are kept separate from verified sensor readings in the source label.</p></section>
   </div>
   <p className="tiny-note">Distance and calories shown for manual step entries are estimates using a general stride and energy factor; actual values vary by height, pace and body weight. Health data access is optional and can be revoked in device settings.</p>
 </div>;
}

function todayKey(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
export default function FeatureHub({page,onToast,onSignOut,user,goal,level,onGoalChange,onLevelChange,onAddMeal}){
 const [profile,setProfile]=useState(()=>read("fit-profile",{name:user?.name||"",age:"",heightCm:"",weightKg:"",targetWeightKg:"",goal:goal||"Weight loss",level:level||"Beginner",equipment:"Bodyweight",dietStyle:"Mixed diet",daysPerWeek:3,sessionMinutes:30}));
 const [completed,setCompleted]=useState(()=>read("fit-session-log",{}));
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("All");
 const [selected,setSelected]=useState(null);
 const [rest,setRest]=useState(0);
 const [timerOn,setTimerOn]=useState(false);
 useEffect(()=>localStorage.setItem("fit-profile",JSON.stringify(profile)),[profile]);
 useEffect(()=>localStorage.setItem("fit-session-log",JSON.stringify(completed)),[completed]);
 useEffect(()=>{if(!timerOn||rest<=0)return;const id=setInterval(()=>setRest(v=>{if(v<=1){setTimerOn(false);return 0}return v-1}),1000);return()=>clearInterval(id)},[timerOn,rest]);
 const bmi=Number(profile.age)>=18&&Number(profile.weightKg)>0&&Number(profile.heightCm)>0?Number(profile.weightKg)/((Number(profile.heightCm)/100)**2):null;
 const weekly=useMemo(()=>{const count=Math.min(6,Math.max(2,Number(profile.daysPerWeek)||3));const chosen=profile.goal==="Weight loss"?[sessions[0],sessions[3],sessions[1],sessions[2]]:profile.goal==="Muscle gain"?[sessions[0],sessions[2],sessions[1],sessions[0]]:[sessions[0],sessions[3],sessions[2],sessions[1]];return days.map((day,i)=>({day,session:i<count?chosen[i%chosen.length]:null}))},[profile.goal,profile.daysPerWeek]);
 const toggleSession=async(day)=>{const key=todayKey()+"-"+day;const wasDone=!!completed[key];setCompleted(v=>({...v,[key]:!v[key]}));onToast?.(wasDone?"Workout marked incomplete":"Workout completed");if(!wasDone){try{const response=await fetch(`${import.meta.env.VITE_API_URL||""}/api/activity/workout`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("fit-token")}`},body:JSON.stringify({date:todayKey()})});if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||"Workout saved on this device; server sync is unavailable.");}}catch(error){onToast?.(error.message||"Workout saved locally; sync unavailable.");}}};
 const exportData=()=>{const data={exportedAt:new Date().toISOString(),profile,sessionLog:completed,fitnessData:Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("fit-")&&k!=="fit-token").map(k=>[k,read(k,null)]))};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="fit-my-data.json";a.click();URL.revokeObjectURL(url);onToast?.("Your data export is ready")};
 const deleteAccount=async()=>{const password=window.prompt("Enter your account password to permanently delete your FIT account and synced data.");if(password===null)return;if(!password)return onToast?.("Password is required");try{const response=await fetch(`${import.meta.env.VITE_API_URL||""}/api/account`,{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("fit-token")}`},body:JSON.stringify({password})});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||"Account deletion failed");localStorage.clear();window.location.reload()}catch(error){onToast?.(error.message)}};

 if(page==="Walking Tracker")return <WalkingTracker onToast={onToast}/>;
 if(page==="Activity & Rewards")return <ActivityRewards onToast={onToast}/>;
 if(page==="Profile")return <div className="feature-page"><div className="section-heading"><div><div className="eyebrow">YOUR FITNESS IDENTITY</div><h2>Personal profile</h2><p className="muted">Use these details to shape your training suggestions.</p></div></div><section className="panel feature-form"><div className="feature-form-grid"><label>Display name<input value={profile.name} maxLength="60" onChange={e=>setProfile({...profile,name:e.target.value})} placeholder="Your name"/></label><label>Age<input type="number" min="13" max="100" value={profile.age} onChange={e=>setProfile({...profile,age:e.target.value})} placeholder="Age"/></label><label>Height (cm)<input type="number" min="100" max="230" value={profile.heightCm} onChange={e=>setProfile({...profile,heightCm:e.target.value})} placeholder="Height"/></label><label>Current weight (kg)<input type="number" min="25" max="350" step="0.1" value={profile.weightKg} onChange={e=>setProfile({...profile,weightKg:e.target.value})} placeholder="Weight"/></label><label>Target weight (kg)<input type="number" min="25" max="350" step="0.1" value={profile.targetWeightKg} onChange={e=>setProfile({...profile,targetWeightKg:e.target.value})} placeholder="Target weight"/></label><label>Fitness goal<select value={profile.goal} onChange={e=>{setProfile({...profile,goal:e.target.value});onGoalChange?.(e.target.value)}}><option>Weight loss</option><option>Muscle gain</option><option>Fitness maintenance</option></select></label><label>Experience<select value={profile.level} onChange={e=>{setProfile({...profile,level:e.target.value});onLevelChange?.(e.target.value)}}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>Available equipment<select value={profile.equipment} onChange={e=>setProfile({...profile,equipment:e.target.value})}><option>Bodyweight</option><option>Dumbbells</option><option>Full gym</option><option>Resistance bands</option></select></label><label>Diet preference<select value={profile.dietStyle||"Mixed diet"} onChange={e=>setProfile({...profile,dietStyle:e.target.value})}><option>Mixed diet</option><option>Vegetarian</option><option>Vegan</option></select></label><label>Training days / week<select value={profile.daysPerWeek} onChange={e=>setProfile({...profile,daysPerWeek:Number(e.target.value)})}>{[2,3,4].map(n=><option key={n} value={n}>{n} days</option>)}</select></label><label>Session duration<select value={profile.sessionMinutes} onChange={e=>setProfile({...profile,sessionMinutes:Number(e.target.value)})}>{[15,20,30,40,45,60,75].map(n=><option key={n} value={n}>{n} minutes</option>)}</select></label></div><div className="profile-metrics"><div><small>Estimated BMI</small><strong>{bmi?bmi.toFixed(1):"—"}</strong><span>Screening estimate only; not a diagnosis.</span></div><div><small>Current goal</small><strong>{profile.goal}</strong><span>{profile.daysPerWeek} training days · {profile.sessionMinutes} min sessions</span></div></div><button className="primary-btn" onClick={()=>onToast?.("Profile saved")}>Save profile</button></section></div>;
 if(page==="Meal Planner")return <div className="feature-page"><div className="section-heading"><div><div className="eyebrow">DAILY FOOD IDEAS</div><h2>Personalized meal planner</h2><p className="muted">Sample meal ideas based on your selected food preference and fitness goal.</p></div><span className="feature-tag">{profile.goal}</span></div><section className="panel meal-plan-settings"><label className="setting-field">Diet preference<select value={profile.dietStyle||"Mixed diet"} onChange={e=>setProfile({...profile,dietStyle:e.target.value})}><option>Mixed diet</option><option>Vegetarian</option><option>Vegan</option></select></label><p className="tiny-note">Portions and nutrition values are approximate examples. Adjust to your appetite, budget, culture and health needs.</p></section><div className="meal-plan-grid">{mealIdeas[profile.dietStyle||"Mixed diet"].map(meal=><article className="panel meal-plan-card" key={meal.slot}><div className="eyebrow">{meal.slot}</div><h3>{meal.name}</h3><p>{meal.why}</p><div className="meal-plan-macros"><span>{meal.cal} kcal</span><span>{meal.protein} g protein</span></div><button className="outline-btn" onClick={()=>onAddMeal?.(meal)}>Add to today's food log</button></article>)}</div><p className="tiny-note">FIT provides general nutrition education, not a prescribed diet. Consult a registered dietitian for medical or condition-specific nutrition needs.</p></div>;
 if(page==="Plan")return <div className="feature-page"><div className="section-heading"><div><div className="eyebrow">ADAPTIVE TRAINING</div><h2>Your weekly workout plan</h2><p className="muted">A starter schedule based on your goal and availability. Adjust intensity to your ability.</p></div><span className="feature-tag"><Target size={14}/>{profile.goal}</span></div><div className="plan-summary-grid"><div className="panel"><small>Training frequency</small><strong>{profile.daysPerWeek} days / week</strong></div><div className="panel"><small>Session length</small><strong>{profile.sessionMinutes} minutes</strong></div><div className="panel"><small>Experience</small><strong>{profile.level}</strong></div></div><div className="weekly-plan">{weekly.map(({day,session})=>{const done=!!completed[todayKey()+"-"+day];const adaptedItems=session?session.items.map(name=>profile.equipment==="Bodyweight"?(name==="Dumbbell row"?"Prone Y-T-W":name==="Dumbbell shoulder press"?"Incline push-up":name):profile.equipment==="Resistance bands"?(name==="Dumbbell row"?"Resistance-band row":name==="Dumbbell shoulder press"?"Band overhead press":name):name):[];return <article className="panel weekly-day" key={day}><div className="weekly-day-head"><div><small>{day.toUpperCase()}</small><h3>{session?session.title:"Recovery / Rest day"}</h3></div>{session?<span className={done?"feature-tag completed":"feature-tag"}>{done?"COMPLETED":session.focus}</span>:<span className="feature-tag">RECOVERY</span>}</div>{session?<><div className="plan-exercises">{adaptedItems.map(name=><div key={name}><Dumbbell size={15}/><span>{name}</span><small>{profile.level==="Beginner"?"2 sets · ":profile.level==="Advanced"?"4 sets · ":""}{catalog.find(x=>x.name===name)?.sets}</small></div>)}</div><button className={done?"done-btn":"outline-btn"} onClick={()=>toggleSession(day)}>{done?"Undo completion":"Mark today's session complete"}</button></>:<p className="muted">Take an easy walk or do gentle mobility if it feels good.</p>}</article>})}</div><div className="panel rest-timer"><div><div className="eyebrow">REST TIMER</div><h3>{String(Math.floor(rest/60)).padStart(2,"0")}:{String(rest%60).padStart(2,"0")}</h3><p className="muted">Use between sets; choose a comfortable recovery interval.</p></div><div className="timer-actions"><button className="outline-btn" onClick={()=>{setRest(60);setTimerOn(false)}}>60 sec</button><button className="outline-btn" onClick={()=>{setRest(90);setTimerOn(false)}}>90 sec</button><button className="outline-btn" onClick={()=>setTimerOn(v=>!v)} disabled={rest===0}>{timerOn?"Pause":"Start"}</button><button className="outline-btn" onClick={()=>{setRest(0);setTimerOn(false)}}>Reset</button></div></div></div>;
 if(page==="Exercise Library")return <div className="feature-page"><div className="section-heading"><div><div className="eyebrow">MOVEMENT REFERENCE</div><h2>Exercise library</h2><p className="muted">Browse exercise instructions and suggested set ranges.</p></div></div><div className="discover-search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search exercises or muscle groups"/></div><div className="filter-chips">{["All",...new Set(catalog.map(x=>x.group))].map(x=><button className={category===x?"selected":""} key={x} onClick={()=>setCategory(x)}>{x}</button>)}</div>{selected?<section className="panel exercise-detail"><button className="back-link" onClick={()=>setSelected(null)}>← Back to library</button><span className="feature-tag">{selected.group} · {selected.level}</span><h2>{selected.name}</h2><p className="muted">{selected.equipment} · Suggested: {selected.sets}</p><h3>How to perform</h3>{selected.steps.map((step,i)=><div className="instruction-row" key={step}><span>{i+1}</span><p>{step}</p></div>)}<p className="tiny-note">Stop if you feel sharp pain, dizziness, chest pain or unusual shortness of breath. Ask a qualified trainer to check your form if unsure.</p></section>:<div className="exercise-grid">{catalog.filter(x=>(category==="All"||x.group===category)&&[x.name,x.group,x.equipment].join(" ").toLowerCase().includes(query.toLowerCase())).map(x=><button className="panel exercise-tile" key={x.name} onClick={()=>setSelected(x)}><span className="feature-tag">{x.group}</span><Dumbbell size={25}/><strong>{x.name}</strong><small>{x.level} · {x.equipment}</small><span className="exercise-sets">{x.sets}</span></button>)}</div>}</div>;
 if(page==="Settings")return <div className="feature-page"><div className="section-heading"><div><div className="eyebrow">ACCOUNT & PRIVACY</div><h2>Settings</h2><p className="muted">Control your data and account.</p></div></div><section className="panel settings-feature"><div className="settings-action"><div><Download/><strong>Export my fitness data</strong><p>Download a JSON copy of your profile, logs and app settings.</p></div><button className="outline-btn" onClick={exportData}>Export data</button></div><div className="settings-action"><div><ShieldCheck/><strong>Privacy information</strong><p>Review how FIT stores account data and how to contact the app owner.</p></div><a className="outline-btn" href="/privacy.html" target="_blank" rel="noreferrer">Privacy policy</a></div><div className="settings-action"><div><Settings/><strong>Terms of use</strong><p>Read the app's use and safety terms.</p></div><a className="outline-btn" href="/terms.html" target="_blank" rel="noreferrer">View terms</a></div><div className="settings-action danger-action"><div><Trash2/><strong>Delete FIT account</strong><p>Permanently remove your account and synced fitness data. This cannot be undone.</p></div><button className="danger-btn" onClick={deleteAccount}>Delete account</button></div><div className="settings-action"><div><UserRound/><strong>Sign out</strong><p>End this session on this device.</p></div><button className="outline-btn" onClick={onSignOut}>Sign out</button></div></section></div>;
 return null;
}
