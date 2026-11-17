import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { firebaseAuth, firestoreDb } from "./firebase.js";
import {useEffect,useMemo,useState} from "react";
import {Award,Bell,Flame,Footprints,Medal,ShieldCheck,Trophy,Zap} from "lucide-react";
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const keyFor=(offset=0)=>{const d=new Date();d.setDate(d.getDate()-offset);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const token=()=>localStorage.getItem("fit-token");
const api=import.meta.env.VITE_API_URL||"";
async function request(path,options={}){const t=token();if(!t)throw new Error("Please sign in to sync activity.");const response=await fetch(api+path,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+t,...options.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Activity service unavailable.");return data;}
export default function ActivityRewards({onToast}){
 const today=keyFor();
 const [steps,setSteps]=useState(()=>Number(read("fit-steps-"+today,0))||0);
 const [goal,setGoal]=useState(()=>Number(read("fit-step-goal",8000))||8000);
 const [leaderboard,setLeaderboard]=useState([]);
 const [optIn,setOptIn]=useState(()=>read("fit-leaderboard-opt-in",false));
 const [notifications,setNotifications]=useState([]);
 const [error,setError]=useState("");
 const [syncing,setSyncing]=useState(false);
 const sessions=read("fit-session-log",{});
 const completedDays=useMemo(()=>{const days=new Set();Object.entries(sessions).forEach(([k,v])=>{if(v){const d=k.slice(0,10);if(/^\\d{4}-\\d{2}-\\d{2}$/.test(d))days.add(d);}});return days;},[]);
 const workoutStreak=useMemo(()=>{let n=0;for(let i=0;i<365;i++){if(completedDays.has(keyFor(i)))n++;else if(i===0)continue;else break;}return n;},[completedDays]);
 const stepStreak=useMemo(()=>{let n=0;for(let i=0;i<365;i++){const d=keyFor(i),count=i===0?steps:Number(read("fit-steps-"+d,0));if(count>=goal)n++;else if(i===0)continue;else break;}return n;},[steps,goal]);
 const badges=[{name:"First 1,000",desc:"Reach 1,000 steps in a day",earned:steps>=1000,icon:Footprints},{name:"Step Goal",desc:"Meet your daily step target",earned:steps>=goal,icon:TargetIcon},{name:"3-day mover",desc:"Meet your step goal three days in a row",earned:stepStreak>=3,icon:Flame},{name:"Workout starter",desc:"Complete your first scheduled workout",earned:completedDays.size>=1,icon:Zap},{name:"Consistency",desc:"Build a 3-day workout streak",earned:workoutStreak>=3,icon:Medal}];
 async function loadRemote(){
  try{
   if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
    const user=firebaseAuth?.currentUser;if(!user||!firestoreDb)throw new Error("Please sign in to Firebase again.");
    const activitySnap=await getDocs(query(collection(firestoreDb,"activityDays"),where("leaderboardOptIn","==",true)));
    const from=keyFor(6);const totals=new Map();
    activitySnap.docs.forEach(item=>{const d=item.data();if(d.activityDate<from||d.activityDate>today)return;const old=totals.get(d.userId)||{name:d.displayName||"FIT Member",steps:0,workouts:0};old.steps+=Number(d.steps||0);old.workouts+=Number(d.workouts||0);if(d.displayName)old.name=d.displayName;totals.set(d.userId,old);});
    setLeaderboard([...totals.values()].sort((a,b)=>b.steps-a.steps||b.workouts-a.workouts).slice(0,20));
    const ns=await getDocs(query(collection(firestoreDb,"activityNotifications"),where("userId","==",user.uid)));
    setNotifications(ns.docs.map(d=>{const x=d.data();return {id:d.id,title:x.title,body:x.body,created_at:x.createdAt,read_at:x.readAt};}).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,30));
   }else{
    const [board,notice]=await Promise.all([request("/api/activity/leaderboard"),request("/api/activity/notifications")]);
    setLeaderboard(board.leaderboard||[]);setNotifications(notice.notifications||[]);
   }
   setError("");
  }catch(e){setError(e.message);}
 }
 useEffect(()=>{localStorage.setItem("fit-step-goal",JSON.stringify(goal));},[goal]);
 useEffect(()=>{let active=true;(async()=>{try{
  if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
   const user=firebaseAuth?.currentUser;if(!user||!firestoreDb)throw new Error("Please sign in to Firebase again.");
   const snap=await getDoc(doc(firestoreDb,"activityDays",user.uid+"_"+today));
   if(!active)return;if(snap.exists()){const server=snap.data();if(Number(server.steps)>steps){setSteps(Number(server.steps));localStorage.setItem("fit-steps-"+today,JSON.stringify(Number(server.steps)));}if(server.stepGoal)setGoal(Number(server.stepGoal));setOptIn(Boolean(server.leaderboardOptIn));}
  }else{
   const d=await request("/api/activity/today?date="+today);if(!active)return;const server=d.activity||{};if(Number(server.steps)>steps){setSteps(Number(server.steps));localStorage.setItem("fit-steps-"+today,JSON.stringify(Number(server.steps)));}if(server.step_goal)setGoal(Number(server.step_goal));
  }
  await loadRemote();
 }catch(e){if(active)setError(e.message);}})();return()=>{active=false};},[]);
 async function syncActivity(){
  setSyncing(true);setError("");
  try{
   localStorage.setItem("fit-steps-"+today,JSON.stringify(steps));
   if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
    const user=firebaseAuth?.currentUser;if(!user||!firestoreDb)throw new Error("Please sign in to Firebase again.");
    const ref=doc(firestoreDb,"activityDays",user.uid+"_"+today);const snap=await getDoc(ref);const old=snap.exists()?snap.data():{};
    await setDoc(ref,{userId:user.uid,activityDate:today,steps:Math.round(steps),stepGoal:Math.round(goal),workouts:Number(old.workouts||0),leaderboardOptIn:Boolean(old.leaderboardOptIn),displayName:user.displayName||"FIT Member",updatedAt:new Date().toISOString()},{merge:true});if(steps>=goal){const noticeRef=doc(firestoreDb,"activityNotifications",user.uid+"_stepgoal_"+today);const noticeSnap=await getDoc(noticeRef);if(!noticeSnap.exists())await setDoc(noticeRef,{userId:user.uid,kind:"step_goal",title:"Daily step goal reached",body:"You reached your step goal. Great consistency!",createdAt:new Date().toISOString(),readAt:null});}
   }else{
    const d=await request("/api/activity/today",{method:"PUT",body:JSON.stringify({date:today,steps,stepGoal:goal})});setSteps(Number(d.activity.steps));
   }
   await loadRemote();onToast?.("Activity synced securely");
  }catch(e){setError(e.message);}finally{setSyncing(false);}
 }
 async function toggleOptIn(value){
  const previous=optIn;setOptIn(value);localStorage.setItem("fit-leaderboard-opt-in",JSON.stringify(value));
  try{
   if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
    const user=firebaseAuth?.currentUser;if(!user||!firestoreDb)throw new Error("Please sign in to Firebase again.");
    const refs=await getDocs(query(collection(firestoreDb,"activityDays"),where("userId","==",user.uid)));
    const updates=refs.docs.filter(d=>d.data().activityDate>=keyFor(6)&&d.data().activityDate<=today);
    for(const item of updates)await setDoc(item.ref,{leaderboardOptIn:value,displayName:user.displayName||"FIT Member",updatedAt:new Date().toISOString()},{merge:true});
    const todayRef=doc(firestoreDb,"activityDays",user.uid+"_"+today);const todaySnap=await getDoc(todayRef);
    if(!todaySnap.exists())await setDoc(todayRef,{userId:user.uid,activityDate:today,steps,stepGoal:goal,workouts:0,leaderboardOptIn:value,displayName:user.displayName||"FIT Member",updatedAt:new Date().toISOString()});
   }else await request("/api/activity/leaderboard-opt-in",{method:"PUT",body:JSON.stringify({enabled:value})});
   await loadRemote();
  }catch(e){setOptIn(previous);localStorage.setItem("fit-leaderboard-opt-in",JSON.stringify(previous));setError(e.message);}
 }
 async function markRead(id){
  try{
   if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
    const user=firebaseAuth?.currentUser;if(!user||!firestoreDb)throw new Error("Please sign in again.");
    const ref=doc(firestoreDb,"activityNotifications",id);const snap=await getDoc(ref);
    if(!snap.exists()||snap.data().userId!==user.uid)throw new Error("Notification not found.");
    await updateDoc(ref,{readAt:new Date().toISOString()});
   }else await request("/api/activity/notifications/"+id+"/read",{method:"POST",body:"{}"});
   setNotifications(v=>v.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));
  }catch(e){setError(e.message);}
 }

 return <div className="feature-page">
  <div className="section-heading"><div><div className="eyebrow">MOVE · TRAIN · REPEAT</div><h2>Activity & Rewards</h2><p className="muted">Daily goals, consistency streaks and milestones.</p></div><span className="feature-tag"><Trophy size={14}/> FIT achievements</span></div>
  <div className="stats-grid"><article className="stat-card"><div className="stat-top">Steps today <Footprints size={17}/></div><div className="stat-value">{steps.toLocaleString("en-IN")}</div><div className="stat-sub">of {goal.toLocaleString("en-IN")} step goal</div></article><article className="stat-card"><div className="stat-top">Step streak <Flame size={17}/></div><div className="stat-value">{stepStreak}<small> days</small></div><div className="stat-sub">Consecutive daily goals</div></article><article className="stat-card"><div className="stat-top">Workout streak <Zap size={17}/></div><div className="stat-value">{workoutStreak}<small> days</small></div><div className="stat-sub">From completed plan sessions</div></article><article className="stat-card"><div className="stat-top">Badges earned <Award size={17}/></div><div className="stat-value">{badges.filter(b=>b.earned).length}<small> / {badges.length}</small></div><div className="stat-sub">Personal milestones</div></article></div>
  <section className="panel"><div className="eyebrow">DAILY ACTIVITY GOAL</div><h3>Make movement count</h3><div className="walking-number">{steps.toLocaleString("en-IN")}<small> steps</small></div><div className="progress-track"><div className="progress-fill" style={{width:Math.min(100,steps/Math.max(1,goal)*100)+"%"}}/></div><div className="walking-goal-row"><span>{Math.min(100,Math.round(steps/Math.max(1,goal)*100))}% completed</span><label>Goal <input aria-label="Daily step goal" type="number" min="1000" max="50000" step="500" value={goal} onChange={e=>setGoal(Math.max(1000,Math.min(50000,Number(e.target.value)||1000)))}/> steps</label></div><button className="primary-btn" disabled={syncing} onClick={syncActivity}>{syncing?"Syncing…":"Save & sync activity"}</button><p className="tiny-note">Step count is read from your existing Walking Tracker. Connect your phone or health app there for sensor-based steps.</p></section>
  <section className="panel"><div className="eyebrow">ACHIEVEMENTS</div><h3>Your badges</h3><div className="exercise-grid">{badges.map(({name,desc,earned,icon:Icon})=><article className="panel exercise-tile" key={name}><Icon size={25}/><strong>{name}</strong><small>{desc}</small><span className="feature-tag">{earned?"UNLOCKED":"LOCKED"}</span></article>)}</div></section>
  <section className="panel"><div className="eyebrow">COMMUNITY</div><h3>7-day fitness leaderboard</h3><label className="settings-action"><span><strong>Join public leaderboard</strong><small>Your display name, steps and workout count for the last 7 days will be visible to signed-in FIT users.</small></span><input type="checkbox" checked={optIn} onChange={e=>toggleOptIn(e.target.checked)}/></label>{leaderboard.length?<div className="payment-history">{leaderboard.map((row,i)=><div className="payment-history-row" key={row.name+"-"+i}><span><strong>#{i+1} {row.name}</strong><small>{Number(row.workouts||0)} workouts</small></span><strong>{Number(row.steps||0).toLocaleString("en-IN")} steps</strong></div>)}</div>:<p className="tiny-note">No opted-in leaderboard entries yet. You can join any time.</p>}<p className="tiny-note">Leaderboard participation is optional. You can turn it off whenever you like.</p></section>
  <section className="panel"><div className="eyebrow">PROGRESS NOTIFICATIONS</div><h3><Bell size={18}/> Your activity updates</h3>{notifications.length?notifications.map(n=><div className="meal-item" key={n.id}><div className="meal-icon"><Bell/></div><div className="meal-info"><strong>{n.title}</strong><small>{n.body} · {new Date(n.created_at).toLocaleString("en-IN")}</small></div>{!n.read_at&&<button className="outline-btn" onClick={()=>markRead(n.id)}>Mark read</button>}</div>):<p className="tiny-note">Activity notifications appear here after your daily goal is reached or a workout is logged.</p>}</section>
  {error&&<p className="auth-error">{error}</p>}
 </div>;
}
function TargetIcon(props){return <ShieldCheck {...props}/>}
