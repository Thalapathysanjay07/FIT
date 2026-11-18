import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import QRCode from "qrcode";
import { firebaseAuth, firestoreDb } from "./firebase.js";
import {useEffect,useRef,useState} from "react";
import FeatureHub from "./FeatureHub.jsx";
import {Activity,Apple,BarChart3,CalendarDays,Check,ChevronRight,Crown,Dumbbell,Flame,Footprints,Home,Menu,Plus,Search,Sparkles,Target,Timer,Trophy,TrendingUp,Utensils,Wallet,Users,HeartPulse,X,Zap} from "lucide-react";
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const dayKey=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const initialMeals=()=>{const key="fit-meals-"+dayKey();if(localStorage.getItem(key))return read(key,[]);const legacy=read("fit-meals",[]);localStorage.removeItem("fit-meals");return legacy};
const initialWater=()=>{const key="fit-water-"+dayKey();if(localStorage.getItem(key))return read(key,0);const legacy=read("fit-water",0);localStorage.removeItem("fit-water");return legacy};
const plans=[{id:1,name:"Full body foundation",type:"Strength",level:"Beginner",min:25,desc:"Squats · incline push-ups · rows · plank"},{id:2,name:"Upper body strength",type:"Strength",level:"Intermediate",min:35,desc:"Push-ups · dumbbell rows · shoulder press"},{id:3,name:"Lower body + core",type:"Strength",level:"Intermediate",min:40,desc:"Squats · lunges · glute bridges · dead bug"},{id:4,name:"HIIT express",type:"Conditioning",level:"Advanced",min:18,desc:"High knees · mountain climbers · intervals"},{id:5,name:"Mobility reset",type:"Recovery",level:"Beginner",min:15,desc:"Cat-cow · hip opener · thoracic rotations"}];
const trends=[["Strength training","BUILD MUSCLE","Progressive overload and compound movements.","30–45 min"],["Walking workouts","DAILY ACTIVITY","Accessible low-impact movement for consistency.","20–40 min"],["Mobility flow","RECOVERY","Build range of motion and movement quality.","10–20 min"],["Short HIIT","CONDITIONING","Time-efficient intervals; scale intensity safely.","15–20 min"]];
const challenges=[["steps","7-day step streak","Aim for a consistent daily step target.",7],["protein","Protein-first week","Log meals and work toward your protein goal.",5],["strength","Strength starter","Complete three strength sessions.",3]];
const money=n=>Number(n||0).toLocaleString("en-IN");
function estimateTargets(profile,goal){
 const age=Number(profile?.age),height=Number(profile?.heightCm),weight=Number(profile?.weightKg);
 if(!Number.isFinite(age)||!Number.isFinite(height)||!Number.isFinite(weight)||age<18||age>100||height<100||height>230||weight<25||weight>350)return null;
 const bmr=10*weight+6.25*height-5*age-78;
 const maintenance=bmr*1.4;
 const calories=Math.round((goal==="Weight loss"?maintenance-300:goal==="Muscle gain"?maintenance+200:maintenance)/50)*50;
 const protein=Math.round(weight*(goal==="Muscle gain"?1.6:1.4)/5)*5;
 return {calories:Math.max(1200,Math.min(4500,calories)),protein:Math.max(50,Math.min(250,protein))};
}
const dateOffset=(offset)=>{const d=new Date();d.setDate(d.getDate()-offset);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
function Stat({Icon,label,value,unit="",sub}){return <article className="stat-card"><div className="stat-top">{label}<Icon size={17}/></div><div className="stat-value">{value}<small>{unit}</small></div><div className="stat-sub">{sub}</div></article>}
function AdminPanel(){
  if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true")return <section className="panel admin-panel"><div className="eyebrow">OWNER CONTROL · FIREBASE SPARK</div><h2>Manual payment verification</h2><p className="muted">Spark has no Cloud Functions. For safety, the browser cannot approve payments or grant Premium.</p><ol><li>Open Firestore in the Firebase Console using the project-owner account.</li><li>Open <b>paymentRequests</b> and locate the request by its UTR document ID.</li><li>Verify the transaction in your bank/UPI app. Never approve based only on the screenshot or submitted UTR.</li><li>Change the request status to <b>approved</b> or <b>rejected</b>.</li><li>For approval, create or update <b>memberships/{userId}</b>, where userId is the request's userId. Copy the request's planCode, set startsAt to the current ISO date/time, and set expiresAt to 30 days later for monthly or 365 days later for yearly.</li></ol><p className="tiny-note">Membership document fields: userId, planCode, startsAt, expiresAt, paymentRequestId. Monthly is ₹49 for 30 days; yearly is ₹499 for 365 days. Console owner actions bypass client rules; never grant users Firestore project-owner access.</p><a className="outline-btn" href={`https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID||""}/firestore/data`} target="_blank" rel="noreferrer">Open Firebase Firestore Console</a></section>;

 const [key,setKey]=useState("");const [payments,setPayments]=useState([]);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [loaded,setLoaded]=useState(false);
 async function load(){if(key.trim().length<24){setError("Enter the backend admin key (at least 24 characters).");return;}setBusy(true);setError("");try{const r=await fetch(`${import.meta.env.VITE_API_URL||""}/api/admin/payments`,{headers:{"x-fit-admin-key":key.trim()}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not load payment requests.");setPayments(d.payments||[]);setLoaded(true);}catch(e){setError(e.message||"Admin request failed.");}finally{setBusy(false);}}
 async function review(id,decision){if(!window.confirm(`${decision==="approve"?"Approve":"Reject"} this payment request?`))return;setBusy(true);setError("");try{const r=await fetch(`${import.meta.env.VITE_API_URL||""}/api/admin/payments/${id}/review`,{method:"POST",headers:{"Content-Type":"application/json","x-fit-admin-key":key.trim()},body:JSON.stringify({decision})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Could not review payment.");await load();}catch(e){setError(e.message||"Review failed.");}finally{setBusy(false);}}
 return <section className="panel admin-panel"><div className="eyebrow">OWNER CONTROL</div><h2>Payment review</h2><p className="muted">Only the server-side FIT_ADMIN_KEY can access payment records. Keep it private.</p><label className="setting-field">Admin key<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} placeholder="Enter backend admin key"/></label><button className="primary-btn" disabled={busy} onClick={load}>{busy?"Loading…":"Load payment requests"}</button>{error&&<p className="auth-error">{error}</p>}{loaded&&<><div className="admin-summary"><strong>{payments.filter(p=>p.status==="pending").length}</strong><span>Pending</span><strong>{payments.length}</strong><span>Recent requests</span></div>{payments.length===0?<p className="tiny-note">No payment requests found.</p>:payments.map(p=><article className="admin-payment" key={p.id}><div><strong>{p.name} · {p.email}</strong><p>{"FIT Pro 3 Months · ₹49"} · UTR: {p.utr}</p><small>{new Date(p.created_at).toLocaleString("en-IN")} · {p.status}</small></div>{p.status==="pending"&&<div className="admin-actions"><button className="primary-btn" disabled={busy} onClick={()=>review(p.id,"approve")}>Approve</button><button className="outline-btn" disabled={busy} onClick={()=>review(p.id,"reject")}>Reject</button></div>}</article>)}</>}</section>;
}

export default function App({onSignOut,user}){
const lastSavedData=useRef("");
const [syncStatus,setSyncStatus]=useState("syncing");
const [page,S]=useState("Overview"),[mobile,M]=useState(false),[meals,SM]=useState(initialMeals),[done,SD]=useState(()=>read("fit-done",[])),[goal,SG]=useState(()=>read("fit-goal","Muscle gain")),[level,SL]=useState(()=>read("fit-level","Beginner")),[calTarget,SC]=useState(()=>read("fit-cal",2000)),[proTarget,SP]=useState(()=>read("fit-pro",120)),[water,SW]=useState(initialWater),[weights,SWt]=useState(()=>read("fit-weights",[])),[weightInput,SWeightInput]=useState(""),[ch,SH]=useState(()=>read("fit-ch",{})),[modal,SMo]=useState(false),[name,SN]=useState(""),[cal,SCal]=useState(""),[pro,SPro]=useState(""),[search,SS]=useState(""),[prompt,SPr]=useState(""),[reply,SR]=useState(""),[coachLoading,SCoachLoading]=useState(false),[coachMode,SCoachMode]=useState("chat"),[paymentConfig,SPaymentConfig]=useState(null),[qrData,SQrData]=useState(""),[membership,SMembership]=useState(null),[payments,SPayments]=useState([]),[selectedPlan,SSelectedPlan]=useState("monthly"),[utr,SUTR]=useState(""),[paymentBusy,SPaymentBusy]=useState(false),[paymentError,SPaymentError]=useState(""),[paymentMessage,SPaymentMessage]=useState(""),[toast,ST]=useState("");
const cals=meals.reduce((s,m)=>s+Number(m.cal||0),0),protein=meals.reduce((s,m)=>s+Number(m.protein||0),0);
const profile=read("fit-profile",{});
const targetEstimate=estimateTargets(profile,goal);
const weeklyNutrition=Array.from({length:7},(_,i)=>{const key=dateOffset(6-i);const logs=read("fit-meals-"+key,[]);return {date:key,calories:logs.reduce((v,m)=>v+Number(m.cal||0),0),protein:logs.reduce((v,m)=>v+Number(m.protein||0),0),steps:Number(read("fit-steps-"+key,0)||0),meals:logs.length};});
const weeklyAverage={calories:Math.round(weeklyNutrition.reduce((v,d)=>v+d.calories,0)/7),protein:Math.round(weeklyNutrition.reduce((v,d)=>v+d.protein,0)/7),loggedDays:weeklyNutrition.filter(d=>d.meals>0).length};
const weightTrend=weights.length>=2?{first:weights[0],last:weights[weights.length-1],change:Number((weights[weights.length-1].kg-weights[0].kg).toFixed(1))}:null;
const maxWeeklyCalories=Math.max(1,...weeklyNutrition.map(d=>d.calories));
const maxWeeklySteps=Math.max(1,...weeklyNutrition.map(d=>d.steps));
useEffect(()=>localStorage.setItem("fit-meals-"+dayKey(),JSON.stringify(meals)),[meals]);useEffect(()=>localStorage.setItem("fit-done",JSON.stringify(done)),[done]);useEffect(()=>localStorage.setItem("fit-goal",JSON.stringify(goal)),[goal]);useEffect(()=>localStorage.setItem("fit-level",JSON.stringify(level)),[level]);useEffect(()=>localStorage.setItem("fit-cal",JSON.stringify(calTarget)),[calTarget]);useEffect(()=>localStorage.setItem("fit-pro",JSON.stringify(proTarget)),[proTarget]);useEffect(()=>localStorage.setItem("fit-water-"+dayKey(),JSON.stringify(water)),[water]);useEffect(()=>localStorage.setItem("fit-weights",JSON.stringify(weights)),[weights]);useEffect(()=>localStorage.setItem("fit-ch",JSON.stringify(ch)),[ch]);
useEffect(()=>{
  const sync=async()=>{
    const firebaseMode=import.meta.env.VITE_USE_FIREBASE_AUTH==="true";
    const currentUser=firebaseMode?firebaseAuth?.currentUser:null;
    const legacyToken=localStorage.getItem("fit-token");
    if(firebaseMode&&!currentUser){setSyncStatus("waiting");return;}
    if(!firebaseMode&&!legacyToken){setSyncStatus("local");return;}
    const data={};
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(key&&key.startsWith("fit-")&&key!=="fit-token"){
        try{data[key]=JSON.parse(localStorage.getItem(key));}catch{}
      }
    }
    const serialized=JSON.stringify(data);
    if(serialized===lastSavedData.current){setSyncStatus("saved");return;}
    setSyncStatus("syncing");
    try{
      if(firebaseMode){
        if(!firestoreDb)throw new Error("Firestore is not configured.");
        await setDoc(doc(firestoreDb,"userData",currentUser.uid),{
          uid:currentUser.uid,
          data,
          updatedAt:new Date().toISOString()
        });
        lastSavedData.current=serialized;
        setSyncStatus("saved");
      }else{
        const response=await fetch(`${import.meta.env.VITE_API_URL||""}/api/data`,{
          method:"PUT",
          headers:{"Content-Type":"application/json",Authorization:`Bearer ${legacyToken}`},
          body:JSON.stringify({data})
        });
        if(!response.ok)throw new Error(`Data sync failed (HTTP ${response.status}).`);
        lastSavedData.current=serialized;
        setSyncStatus("saved");
      }
    }catch(error){setSyncStatus("error");console.warn("FIT data sync failed:",error);}
  };
  const handleOnline=()=>{sync();};
  const handleOffline=()=>setSyncStatus("offline");
  const handleVisible=()=>{if(document.visibilityState==="visible"&&navigator.onLine)sync();};
  const timer=setInterval(sync,15000);
  window.addEventListener("online",handleOnline);
  window.addEventListener("offline",handleOffline);
  document.addEventListener("visibilitychange",handleVisible);
  if(!navigator.onLine)setSyncStatus("offline");
  sync();
  return()=>{
    clearInterval(timer);
    window.removeEventListener("online",handleOnline);
    window.removeEventListener("offline",handleOffline);
    document.removeEventListener("visibilitychange",handleVisible);
  };
},[]);
useEffect(()=>{
  if(page!=="Membership")return;
  let active=true;SPaymentError("");SQrData("");
  (async()=>{
    try{
      if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
        const currentUser=firebaseAuth?.currentUser;
        if(!currentUser||!firestoreDb)throw new Error("Please sign in to Firebase again.");
        const upiId=String(import.meta.env.VITE_FIT_UPI_ID||"").trim();
        const merchantName=String(import.meta.env.VITE_FIT_MERCHANT_NAME||"FIT").trim();
        SPaymentConfig({upiId,merchantName,plans:[{code:"monthly",name:"FIT Pro Monthly",amount:49,days:30},{code:"yearly",name:"FIT Pro Yearly",amount:499,days:365}]});
        if(/^[A-Za-z0-9._-]{2,256}@[A-Za-z0-9.-]{2,64}$/.test(upiId)){
          const plan=selectedPlan==="yearly"?{amount:"499.00",name:"FIT Pro Yearly"}:{amount:"49.00",name:"FIT Pro Monthly"};
          const uri="upi://pay?"+new URLSearchParams({pa:upiId,pn:merchantName,am:plan.amount,cu:"INR",tn:plan.name}).toString();
          SQrData(await QRCode.toDataURL(uri,{errorCorrectionLevel:"M",margin:2,width:280}));
        }
        const [memberSnap,paymentSnap]=await Promise.all([
          getDoc(doc(firestoreDb,"memberships",currentUser.uid)),
          getDocs(query(collection(firestoreDb,"paymentRequests"),where("userId","==",currentUser.uid)))
        ]);
        const member=memberSnap.exists()?memberSnap.data():null;
        const activeMember=member&&Date.parse(member.expiresAt)>Date.now()&&Date.parse(member.startsAt)<=Date.now();
        SMembership(activeMember?{...member,expires_at:member.expiresAt,starts_at:member.startsAt}:null);
        SPayments(paymentSnap.docs.map(d=>({id:d.id,...d.data(),created_at:d.data().createdAt})).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))));
      }else{
        const token=localStorage.getItem("fit-token");const headers=token?{Authorization:`Bearer ${token}`}:{};
        const [config,status,qr]=await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL||""}/api/membership/config`).then(r=>r.json()),
          token?fetch(`${import.meta.env.VITE_API_URL||""}/api/membership/me`,{headers}).then(r=>r.ok?r.json():{membership:null,payments:[]}):Promise.resolve({membership:null,payments:[]}),
          fetch(`${import.meta.env.VITE_API_URL||""}/api/membership/qr?plan=${selectedPlan}`).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"QR is unavailable");return d;})
        ]);
        if(!active)return;SPaymentConfig(config);SMembership(status.membership||null);SPayments(status.payments||[]);SQrData(qr.qrDataUrl||"");
      }
    }catch(error){if(active)SPaymentError(error.message||"Could not load membership payment settings.");}
  })();
  return()=>{active=false};
},[page,selectedPlan]);

async function submitUpiReference(e){
  e.preventDefault();SPaymentError("");SPaymentMessage("");
  if(!utr.trim()){SPaymentError("Enter the UPI transaction reference/UTR.");return;}
  if(!/^[A-Za-z0-9-]{8,80}$/.test(utr.trim().replace(/\s/g,""))){SPaymentError("Enter a valid UTR (8–80 letters or numbers).");return;}
  SPaymentBusy(true);
  try{
    if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
      const currentUser=firebaseAuth?.currentUser;if(!currentUser||!firestoreDb)throw new Error("Please sign in to Firebase again.");
      const cleanUtr=utr.trim().replace(/\s/g,"");
      const plan=selectedPlan==="yearly"?{planCode:"yearly",amountPaise:49900}:{planCode:"monthly",amountPaise:4900};
      await setDoc(doc(firestoreDb,"paymentRequests",cleanUtr),{userId:currentUser.uid,...plan,utr:cleanUtr,status:"pending",createdAt:new Date().toISOString()});
      SPaymentMessage("Payment reference submitted. FIT Pro activates only after the owner verifies the payment.");SUTR("");
      const history=await getDocs(query(collection(firestoreDb,"paymentRequests"),where("userId","==",currentUser.uid)));
      SPayments(history.docs.map(d=>({id:d.id,...d.data(),created_at:d.data().createdAt})).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))));
    }else{
      const token=localStorage.getItem("fit-token");if(!token)throw new Error("Please sign in again.");
      const response=await fetch(`${import.meta.env.VITE_API_URL||""}/api/payments/upi-request`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({planCode:selectedPlan,utr:utr.trim()})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"Could not submit payment reference.");
      SPaymentMessage(data.message||"Submitted for manual verification.");SUTR("");
      const status=await fetch(`${import.meta.env.VITE_API_URL||""}/api/membership/me`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json());
      SMembership(status.membership||null);SPayments(status.payments||[]);
    }
  }catch(error){SPaymentError(error.message||"Payment submission failed.");}
  finally{SPaymentBusy(false);}
}

const notify=t=>{ST(t);setTimeout(()=>ST(""),2500)};
const nav=[["Overview",Home],["Workouts",Dumbbell],["Plan",CalendarDays],["Exercise Library",Search],["Nutrition",Apple],["Meal Planner",Utensils],["Progress",BarChart3],["Discover",TrendingUp],["Challenges",Trophy],["Walking Tracker",Footprints],["Activity & Rewards",Trophy],["FIT Coach",Sparkles],["Profile",Users],["Settings",Wallet],["Membership",Crown],...(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"?[]:[["Admin",Users]])];
const filtered=plans.filter(p=>(level==="Beginner"?p.level!=="Advanced":level==="Intermediate"?p.level!=="Advanced":true));
function addWeight(e){e.preventDefault();const value=Number(weightInput);if(!Number.isFinite(value)||value<20||value>500)return;SWt([...weights,{id:Date.now(),kg:value,date:new Date().toISOString()}].sort((a,b)=>new Date(a.date)-new Date(b.date)));SWeightInput("");notify("Weight check-in saved");}
function addMeal(e){e.preventDefault();if(!name.trim())return;SM([...meals,{id:Date.now(),name,cal:Number(cal)||0,protein:Number(pro)||0}]);SN("");SCal("");SPro("");SMo(false);notify("Meal saved on this device");}
function quickAddMeal(meal){SM(v=>[...v,{id:Date.now(),name:meal.name,cal:meal.cal,protein:meal.protein}]);notify("Meal added to today’s food log");}
async function ask(e){
  e.preventDefault();
  const question=prompt.trim();
  if(!question||coachLoading)return;
  const token=localStorage.getItem("fit-token");
  if(!token&&!(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"&&firebaseAuth?.currentUser)){SR("Please sign in again to use FIT Coach.");return;}
  SCoachLoading(true);SR("");
  try{
    if(import.meta.env.VITE_USE_FIREBASE_AUTH==="true"){
      const currentUser=firebaseAuth?.currentUser;if(!currentUser||!firestoreDb)throw new Error("Please sign in to Firebase again.");
      if(coachMode!=="chat"){
        const memberSnap=await getDoc(doc(firestoreDb,"memberships",currentUser.uid));
        const member=memberSnap.exists()?memberSnap.data():null;
        if(!member||Date.parse(member.expiresAt)<=Date.now()||Date.parse(member.startsAt)>Date.now())throw new Error("FIT Pro is required for personalised plans and weekly reports.");
      }
      const currentSteps=Number(read("fit-steps-"+dayKey(),0));
      const calorieGoal=targetEstimate?.calories||calTarget;
      const proteinGoal=targetEstimate?.protein||proTarget;
      let answer="FIT Smart Coach · Firebase free mode (on-device guidance, not a generative AI service).\n\n";
      if(coachMode==="diet"){
        answer+=`Your goal: ${goal}. Daily guide: around ${calorieGoal} kcal and ${proteinGoal} g protein (estimates only).\n\nBreakfast: oats with eggs or soy milk and fruit.\nLunch: rice or chapati, dal, vegetables and a protein source such as eggs, chicken, tofu or paneer.\nSnack: roasted chana, fruit or curd.\nDinner: vegetables with dal and a protein source.\n\nKeep portions flexible and adjust for appetite, budget and health needs. ${question}`;
      }else if(coachMode==="workout"){
        answer+=`Goal: ${goal} · Level: ${level}.\n\nStarter week: 3 non-consecutive strength sessions. Each session: 5–8 min warm-up, squat or sit-to-stand, push-up variation, row variation, glute bridge and plank. Start with 2 sets of 8–12 controlled reps, rest 60–90 seconds, and increase gradually only when form stays comfortable. Add easy walking and recovery days.\n\nAvoid exercising through sharp pain, dizziness or chest pain. ${question}`;
      }else if(coachMode==="weekly-report"){
        answer+=`Last 7 days from the data currently saved on this device:\n• Average calories: ${weeklyAverage.calories} kcal/day\n• Average protein: ${weeklyAverage.protein} g/day\n• Food logging days: ${weeklyAverage.loggedDays}/7\n• Today's steps: ${currentSteps.toLocaleString("en-IN")}\n\nThis report cannot infer unlogged meals or workouts. Next steps: log meals consistently, choose a realistic step target, and schedule recovery between strength sessions. ${question}`;
      }else{
        answer+=`Your current goal is ${goal} and experience level is ${level}. Today's steps: ${currentSteps.toLocaleString("en-IN")}. Focus on one repeatable habit today: complete a comfortable workout or walk, log your meals, and get enough rest. For your question: ${question}\n\nThis is general fitness guidance, not medical advice.`;
      }
      SR(answer);
    }else{
      const response=await fetch(`${import.meta.env.VITE_API_URL||""}/api/coach`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({mode:coachMode,question:(question.slice(0,350)+"\n\nFIT context: "+JSON.stringify({goal,level,age:profile.age,heightCm:profile.heightCm,weightKg:profile.weightKg,dietPreference:profile.dietPreference,calorieTarget:targetEstimate?.calories||calTarget,proteinTarget:targetEstimate?.protein||proTarget,water,steps:read("fit-steps-"+dayKey(),0),weekly:weeklyNutrition.map(d=>[d.date,d.calories,d.protein,d.steps,d.meals]),weeklyAverage}))})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||"FIT Coach is unavailable right now.");
      SR(data.answer||"No answer received. Please try again.");
    }
  }catch(error){SR(error.message||"Could not reach FIT Coach. Please try again.");}
  finally{SCoachLoading(false);}
}
const date=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
return <div className="app-shell"><aside className={`sidebar ${mobile?"open":""}`}><div className="brand"><div className="brand-mark"><Activity/></div>FIT<span className="brand-dot">.</span><button className="mobile-close" onClick={()=>M(false)}><X/></button></div><div className="side-label">YOUR WORKSPACE</div><nav>{nav.map(([n,I])=><button key={n} className={page===n?"nav-item active":"nav-item"} onClick={()=>{S(n);M(false)}}><I size={18}/>{n}{n==="Membership"&&<span className="nav-count">PRO</span>}</button>)}</nav><div className="side-bottom"><div className="upgrade-card"><Zap color="#b6f36b"/><strong>Build your best self.</strong><p>Small steps. Strong habits. Real progress.</p><button className="upgrade-link" onClick={()=>S("Membership")}>Explore FIT Pro →</button></div><div className="profile"><div className="avatar">F</div><div><strong>{user?.name||"FIT Member"}</strong><small>Personal account</small></div></div></div></aside>{mobile&&<div className="scrim" onClick={()=>M(false)}/>}<main className="main-area"><header className="topbar"><button className="menu-btn" onClick={()=>M(true)}><Menu/></button><div className="crumb">FIT <span>/</span><b>{page}</b></div><div className="top-actions"><span title={syncStatus==="saved"?"Your latest fitness data is synced":syncStatus==="syncing"?"Saving your fitness data":syncStatus==="error"?"Sync failed; your data remains on this device":syncStatus==="waiting"?"Waiting for Firebase sign-in":"Local-only mode"} style={{fontSize:12,color:syncStatus==="error"?"#d97706":"inherit"}}>{syncStatus==="saved"?"Synced":syncStatus==="syncing"?"Saving…":syncStatus==="error"?"Sync issue":syncStatus==="waiting"?"Connecting…":"Local mode"}</span>{date}<div className="top-avatar">F</div></div></header><div className="page-content"><div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> YOUR PERSONAL FITNESS SPACE</div><h1>Make today count<span className="green">.</span></h1><p className="muted">Consistency creates results. Your journey, your pace.</p></div><div className="date-pill"><CalendarDays size={16}/>{date}</div></div>
{page==="Overview"&&<><section className="hero-card"><div className="hero-copy"><div className="hero-kicker"><Flame size={15}/> DAILY FOCUS</div><h2>Progress over<br/><em>perfection.</em></h2><p>One good choice at a time.</p><button className="primary-btn" onClick={()=>S("Workouts")}>Start a workout <ChevronRight size={15}/></button></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-circle"><Dumbbell size={65}/></div></div></section><div className="section-heading"><div><div className="eyebrow">YOUR NUMBERS</div><h2>Today at a glance</h2></div><button className="text-btn" onClick={()=>S("Progress")}>View progress ↗</button></div><div className="stats-grid"><Stat Icon={Flame} label="Calories consumed" value={money(cals)} unit=" kcal" sub={`of ${money(calTarget)} kcal target`}/><Stat Icon={Apple} label="Protein intake" value={protein} unit=" g" sub={`of ${proTarget} g target`}/><Stat Icon={Dumbbell} label="Workouts completed" value={done.length} sub="Logged on this device"/><Stat Icon={Footprints} label="Walking steps" value={money(read("fit-steps-"+dayKey(),0))} sub="Open Walking Tracker to sync"/></div><div className="content-grid"><section className="panel"><div className="panel-heading"><div><div className="eyebrow">STAY FUELLED</div><h3>Today's nutrition</h3></div><button className="add-btn" onClick={()=>SMo(true)}><Plus size={15}/> Add meal</button></div><div className="calorie-row"><strong>{money(cals)} <small>/ {money(calTarget)} kcal</small></strong><span className="remaining">{Math.max(0,calTarget-cals)} left</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${Math.min(100,cals/Math.max(1,calTarget)*100)}%`}}/></div>{meals.slice(-4).map(m=><div className="meal-item" key={m.id}><div className="meal-icon"><Utensils/></div><div className="meal-info"><strong>{m.name}</strong><small>{m.protein}g protein</small></div><div className="meal-macros"><strong>{m.cal} kcal</strong><button className="remove-btn" onClick={()=>SM(meals.filter(x=>x.id!==m.id))}>Remove</button></div></div>)}</section><section className="panel"><div className="eyebrow">DAILY HABITS</div><h3>Hydration check</h3><div className="water-count"><strong>{water}</strong><span> / 8 glasses</span></div><div className="water-cups">{Array.from({length:8},(_,i)=><button key={i} className={i<water?"cup filled":"cup"} onClick={()=>SW(i+1)}>●</button>)}</div><button className="outline-btn full-btn" onClick={()=>SW(Math.min(8,water+1))}>Log one glass +</button><p className="tiny-note">Hydration needs vary by person and conditions.</p></section></div><section className="panel quick-panel"><div className="eyebrow">EXPLORE FIT</div><h3>Build your routine</h3><div className="quick-links">{[["Walking Tracker",Footprints,"Sync steps and activity"],["Discover",TrendingUp,"Explore workout trends"],["Challenges",Trophy,"Build lasting habits"],["FIT Coach",Sparkles,"Get food plans and coaching"]].map(([n,I,d])=><button key={n} onClick={()=>S(n)}><I/><span><b>{n}</b><small>{d}</small></span><ChevronRight/></button>)}</div></section></>}
{page==="Workouts"&&<><div className="section-heading"><div><div className="eyebrow">TRAINING PLAN</div><h2>Workouts for your level</h2><p className="muted">Choose sessions that fit your experience.</p></div></div><label className="filter-row">Experience level <select value={level} onChange={e=>SL(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><div className="workout-cards">{filtered.map(w=><article className="workout-card" key={w.id}><div className="workout-card-top"><span className="workout-type">{w.type}</span><span className="duration"><Timer size={14}/>{w.min} min</span></div><div className="workout-visual"><Dumbbell size={38}/></div><h3>{w.name}</h3><p>{w.desc}</p><div className="workout-card-bottom"><span>{w.level}</span><button className={done.includes(w.id)?"done-btn":"outline-btn"} onClick={()=>{SD(done.includes(w.id)?done.filter(x=>x!==w.id):[...done,w.id]);notify(done.includes(w.id)?"Workout unmarked":"Workout completed")}}>{done.includes(w.id)?"Completed ✓":"Mark complete"}</button></div></article>)}</div></>}
{page==="Nutrition"&&<><div className="section-heading"><div><div className="eyebrow">FOOD & FUEL</div><h2>Nutrition tracker</h2><p className="muted">Your food log and daily targets.</p></div><button className="primary-btn" onClick={()=>SMo(true)}>+ Add meal</button></div><div className="stats-grid"><Stat Icon={Flame} label="Calories" value={money(cals)} unit=" kcal" sub={`Target ${calTarget}`}/><Stat Icon={Apple} label="Protein" value={protein} unit=" g" sub={`Target ${proTarget}g`}/><Stat Icon={Target} label="Remaining" value={Math.max(0,calTarget-cals)} unit=" kcal" sub="Daily calorie target"/></div><section className="panel nutrition-full"><h3>Meal log</h3>{meals.map(m=><div className="meal-item" key={m.id}><div className="meal-icon"><Utensils/></div><div className="meal-info"><strong>{m.name}</strong><small>{m.protein}g protein</small></div><div className="meal-macros"><strong>{m.cal} kcal</strong><button className="remove-btn" onClick={()=>SM(meals.filter(x=>x.id!==m.id))}>Remove</button></div></div>)}</section><section className="panel targets-panel"><h3>Daily targets</h3><p className="tiny-note">Targets are estimates using your saved age, height, weight and goal. No sex-specific input is collected, so this uses a midpoint formula and moderate activity assumption.</p>{targetEstimate?<button className="outline-btn" onClick={()=>{SC(targetEstimate.calories);SP(targetEstimate.protein);notify("Estimated calorie and protein targets applied")}}>Calculate from my profile</button>:<p className="tiny-note">Complete your age, height and current weight in Profile (18+ required) to calculate suggested targets.</p>}<label>Calories<input type="number" value={calTarget} onChange={e=>SC(Number(e.target.value))}/></label><label>Protein (g)<input type="number" value={proTarget} onChange={e=>SP(Number(e.target.value))}/></label><p className="tiny-note">Targets are adjustable estimates, not medical nutrition advice.</p></section></>}
{page==="Progress"&&<><div className="section-heading"><div><div className="eyebrow">YOUR CONSISTENCY</div><h2>Progress overview</h2></div></div><div className="stats-grid"><Stat Icon={Dumbbell} label="Workouts completed" value={done.length} sub="Recorded on this device"/><Stat Icon={Flame} label="Calories logged" value={money(cals)} unit=" kcal" sub="Food log"/><Stat Icon={Apple} label="Protein logged" value={protein} unit=" g" sub="Food log"/><Stat Icon={Trophy} label="Challenges active" value={Object.keys(ch).length} sub="Started challenges"/></div><section className="panel weight-panel"><div className="eyebrow">WEIGHT CHECK-IN</div><h3>Track your body metrics</h3><form className="weight-form" onSubmit={addWeight}><label>Weight today (kg)<input type="number" min="20" max="500" step="0.1" value={weightInput} onChange={e=>SWeightInput(e.target.value)} placeholder="e.g. 72.5" required/></label><button className="primary-btn">Save check-in</button></form><div className="weight-history">{weights.slice().reverse().slice(0,8).map(w=><div className="weight-entry" key={w.id}><span>{new Date(w.date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</span><strong>{w.kg} kg</strong></div>)}</div>{weightTrend&&<div className="weight-entry"><span>Change across recorded check-ins</span><strong>{weightTrend.change>0?"+":""}{weightTrend.change} kg</strong></div>}{weights.length===0&&<p className="tiny-note">Add your first check-in to start building a personal weight history.</p>}</section><section className="panel weekly-report-panel"><div className="eyebrow">LAST 7 DAYS</div><h3>Weekly nutrition & activity</h3><div className="stats-grid"><Stat Icon={Flame} label="Average calories" value={weeklyAverage.calories} unit=" kcal" sub="Per calendar day, including unlogged days as zero"/><Stat Icon={Apple} label="Average protein" value={weeklyAverage.protein} unit=" g" sub="Per calendar day, including unlogged days as zero"/><Stat Icon={Check} label="Days with food logs" value={weeklyAverage.loggedDays} sub="Out of 7 days"/></div><div className="weight-history">{weeklyNutrition.map(d=><div className="weight-entry" key={d.date}><span>{new Date(d.date+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short",day:"numeric"})} · {d.meals} meals · {d.steps.toLocaleString("en-IN")} steps</span><strong>{d.calories} kcal / {d.protein}g</strong></div>)}</div><h4>7-day calories</h4><div className="weight-history">{weeklyNutrition.map(d=><div className="weight-entry" key={"cal-"+d.date}><span>{new Date(d.date+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"})}</span><div style={{display:"flex",alignItems:"center",gap:10,minWidth:"55%"}}><div className="progress-track" style={{flex:1}}><div className="progress-fill" style={{width:`${d.calories/maxWeeklyCalories*100}%`}}/></div><strong>{d.calories}</strong></div></div>)}</div><h4>7-day steps</h4><div className="weight-history">{weeklyNutrition.map(d=><div className="weight-entry" key={"steps-"+d.date}><span>{new Date(d.date+"T12:00:00").toLocaleDateString("en-IN",{weekday:"short"})}</span><div style={{display:"flex",alignItems:"center",gap:10,minWidth:"55%"}}><div className="progress-track" style={{flex:1}}><div className="progress-fill" style={{width:`${d.steps/maxWeeklySteps*100}%`}}/></div><strong>{d.steps.toLocaleString("en-IN")}</strong></div></div>)}</div><button className="primary-btn" onClick={()=>{S("FIT Coach");SCoachMode("weekly-report");SPr("Create my weekly report using the last seven days of logged meals, steps and available workout data. Highlight missing data honestly.")}}>Generate weekly report · FIT Pro</button><p className="tiny-note">This report uses locally saved meal and step history. Workout history may be incomplete if workouts were not date-stamped.</p></section></>}
{page==="Discover"&&<><div className="section-heading"><div><div className="eyebrow">FIT DISCOVER</div><h2>Explore what's moving</h2><p className="muted">Workout formats worth exploring.</p></div></div><div className="discover-search"><Search/><input value={search} onChange={e=>SS(e.target.value)} placeholder="Search workout styles"/></div><div className="discover-grid">{trends.filter(x=>x.join(" ").toLowerCase().includes(search.toLowerCase())).map(([title,tag,desc,time],i)=><article className="discover-card" key={title}><div className="discover-art"><TrendingUp size={35}/><span>0{i+1}</span></div><div className="eyebrow">{tag}</div><h3>{title}</h3><p>{desc}</p><div className="discover-meta">{time}</div><button className="outline-btn" onClick={()=>S("Workouts")}>Find a session →</button></article>)}</div><p className="tiny-note">These are general fitness categories, not a verified live popularity ranking.</p></>}
{page==="Challenges"&&<><div className="section-heading"><div><div className="eyebrow">COMMUNITY MOMENTUM</div><h2>Small wins, big habits</h2><p className="muted">Log your own progress and stay consistent.</p></div></div><div className="challenge-grid">{challenges.map(([id,title,desc,total])=>{let p=ch[id]||0;return <article className="panel challenge-card" key={id}><div className="challenge-icon"><Trophy/></div><span className="status-pill">{p>=total?"COMPLETED":"OPEN CHALLENGE"}</span><h3>{title}</h3><p>{desc}</p><div className="challenge-progress">{p} / {total} steps</div><div className="progress-track"><div className="progress-fill" style={{width:`${p/total*100}%`}}/></div><button className="outline-btn" disabled={p>=total} onClick={()=>SH({...ch,[id]:Math.min(total,p+1)})}>{p>=total?"Completed":"Log progress +1"}</button></article>})}</div></>}
{page==="FIT Coach"&&<><div className="section-heading"><div><div className="eyebrow">FIT SMART ASSISTANT</div><h2>Your fitness companion</h2><p className="muted">General education for workouts, food habits and consistency.</p></div></div><div className="coach-layout"><section className="panel coach-panel"><div className="coach-avatar"><Sparkles/></div><h2>Ask. Learn. Improve.</h2><div className="prompt-chips">{["How do I start losing weight?","How can I build muscle?","Give me beginner workout tips","How should I plan meals?"].map(x=><button key={x} onClick={()=>SPr(x)}>{x}</button>)}</div><div className="prompt-chips coach-modes">{[["chat","Ask FIT Coach · Free"],["diet","Guided diet plan · Pro"],["workout","Guided workout plan · Pro"],["weekly-report","Weekly progress report · Pro"]].map(([mode,label])=><button type="button" className={coachMode===mode?"selected":""} key={mode} onClick={()=>{SCoachMode(mode);SPr(mode==="diet"?"Create my personalised Indian-food diet plan":mode==="workout"?"Create my weekly workout plan based on my goal and equipment":mode==="weekly-report"?"Analyse my last week's fitness progress and give next-week actions":"How can I improve my fitness today?")}}>{label}</button>)}</div><form className="coach-form" onSubmit={ask}><input value={prompt} onChange={e=>SPr(e.target.value)} placeholder="Ask a fitness question..." maxLength={1200} required/><button className="primary-btn" disabled={coachLoading}>{coachLoading?"Thinking…":"Ask"}</button></form>{reply&&<div className="coach-answer"><div className="eyebrow">FIT COACH RESPONSE</div><p>{reply}</p><small>General educational guidance, not medical advice. For health concerns, consult a qualified professional.</small></div>}</section><section className="panel"><div className="eyebrow">YOUR PROFILE</div><h3>Fitness preferences</h3><label className="setting-field">Goal<select value={goal} onChange={e=>SG(e.target.value)}><option>Weight loss</option><option>Muscle gain</option><option>Fitness maintenance</option></select></label><label className="setting-field">Experience<select value={level} onChange={e=>SL(e.target.value)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></section></div><p className="tiny-note">FIT Coach uses the AI service configured by the app owner. Availability depends on backend configuration.</p></>}
{["Plan","Exercise Library","Meal Planner","Walking Tracker","Activity & Rewards","Profile","Settings"].includes(page)&&<FeatureHub page={page} onToast={notify} onSignOut={onSignOut} user={user} goal={goal} level={level} onGoalChange={SG} onLevelChange={SL} onAddMeal={quickAddMeal}/>}
{page==="Membership"&&<><section className="membership-hero"><div className="eyebrow"><Crown size={15}/> FIT MEMBERSHIP</div><h2>Make your next level<br/><span className="green">your new normal.</span></h2><p>Start free. Upgrade when you need more structure.</p></section>
{membership&&<section className="panel"><span className="status-pill">ACTIVE MEMBERSHIP</span><h3>{membership.planCode==="yearly"?"FIT Pro Yearly":"FIT Pro Monthly"}</h3><p className="muted">Valid until {new Date(membership.expires_at).toLocaleDateString("en-IN")}</p></section>}
<div className="pricing-grid"><article className="panel price-card"><div className="eyebrow">START HERE</div><h3>FIT Free</h3><div className="price">₹0 <small>/ forever</small></div><ul><li>✓ Workout library</li><li>✓ Daily meal and water logging</li><li>✓ Progress tracking</li><li>✓ Weekly starter plan</li><li>✓ Basic calorie and protein targets</li></ul></article>
<article className="panel price-card"><span className="status-pill">FIT PRO</span><h3>Monthly</h3><ul><li>✓ Personalised guided diet recommendations</li><li>✓ Goal-based guided workout plans</li><li>✓ Weekly progress reports</li><li>✓ Adaptive nutrition guidance</li></ul><div className="price">₹49 <small>/ month</small></div><p className="tiny-note">30 days access · manual renewal</p><button className={selectedPlan==="monthly"?"primary-btn":"outline-btn"} onClick={()=>SSelectedPlan("monthly")}>{selectedPlan==="monthly"?"Selected plan":"Choose monthly"}</button></article><article className="panel price-card featured-price"><span className="status-pill">BEST VALUE</span><h3>Yearly</h3><ul><li>✓ Everything in FIT Pro Monthly</li><li>✓ One year of access</li><li>✓ No automatic renewal</li></ul><div className="price">₹499 <small>/ year</small></div><p className="tiny-note">365 days access · manual renewal</p><button className={selectedPlan==="yearly"?"primary-btn":"outline-btn"} onClick={()=>SSelectedPlan("yearly")}>{selectedPlan==="yearly"?"Selected plan":"Choose yearly"}</button></article></div>
<section className="panel income-panel"><div className="eyebrow"><Crown size={14}/> MEMBERSHIP PAYMENT</div><h3>Pay with UPI</h3>
{paymentConfig?.upiId?<><p className="muted">Selected plan: {selectedPlan==="yearly"?"₹499 for 1 year (365 days)":"₹49 for 1 month (30 days)"}. Complete the UPI payment, then enter the transaction reference below. FIT Pro activates only after manual verification.</p><a className="outline-btn" href={`upi://pay?pa=${encodeURIComponent(paymentConfig.upiId)}&pn=${encodeURIComponent(paymentConfig.merchantName||"FIT")}&am=${selectedPlan==="yearly"?"499.00":"49.00"}&cu=INR&tn=${encodeURIComponent(selectedPlan==="yearly"?"FIT Pro Yearly":"FIT Pro Monthly")}`}>Open UPI app to pay</a>{qrData&&<div className="upi-qr-wrap"><img src={qrData} alt={`FIT Pro ${selectedPlan} UPI payment QR`} width="220" height="220"/><p className="tiny-note">Scan with any UPI app · {selectedPlan==="yearly"?"₹499":"₹49"}</p></div>}
<form className="weight-form" onSubmit={submitUpiReference}><label>UPI transaction reference / UTR<input value={utr} onChange={e=>SUTR(e.target.value)} minLength="8" maxLength="80" placeholder="Enter UTR after payment" required/></label><button className="primary-btn" disabled={paymentBusy}>{paymentBusy?"Submitting…":"Submit payment reference"}</button></form>
{paymentError&&<p className="auth-error">{paymentError}</p>}{paymentMessage&&<p className="tiny-note">{paymentMessage}</p>}{payments.length>0&&<div className="payment-history"><h4>Payment requests</h4>{payments.map(p=><div className="payment-history-row" key={p.id}><span>{(p.planCode==="yearly"?"Yearly · ₹499":"Monthly · ₹49")} · {p.utr}</span><strong className={p.status==="approved"?"payment-approved":p.status==="rejected"?"payment-rejected":"payment-pending"}>{p.status}</strong></div>)}</div>}
</>:<p className="tiny-note">UPI payment is not configured yet. The app owner must add VITE_FIT_UPI_ID and VITE_FIT_MERCHANT_NAME to the frontend hosting environment. No payment can be submitted until then.</p>}
{payments.length>0&&<div className="weight-history"><h3>Recent payment requests</h3>{payments.map(p=><div className="weight-entry" key={p.id}><span>{(p.planCode==="yearly"?"Yearly · ₹499":"Monthly · ₹49")} · {p.utr}</span><strong>{p.status}</strong></div>)}</div>}
<p className="tiny-note">Payments are manually reviewed. Never share your UPI PIN or OTP with anyone.</p></section></>}
{page==="Admin"&&<AdminPanel/>}
</div></main></div>;
}
