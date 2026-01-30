const crypto=require("crypto");
const admin=require("firebase-admin");

function base64JsonEnv(name){
 const v=process.env[name];
 if(!v) throw new Error("Missing "+name);
 return JSON.parse(Buffer.from(v,"base64").toString("utf8"));
}

function timingSafeEq(a,b){
 const ba=Buffer.from(a);
 const bb=Buffer.from(b);
 if(ba.length!==bb.length) return false;
 return crypto.timingSafeEqual(ba,bb);
}

function telegramCheck(data,token){
 const {hash,...rest}=data;

 const checkString=Object.keys(rest)
 .sort()
 .map(k=>`${k}=${rest[k]}`)
 .join("\n");

 const secret=crypto.createHash("sha256").update(token).digest();
 const hmac=crypto.createHmac("sha256",secret).update(checkString).digest("hex");

 return timingSafeEq(hmac,hash);
}

let inited=false;
function initAdmin(){
 if(inited) return;
 const sa=base64JsonEnv("FIREBASE_SERVICE_ACCOUNT_BASE64");
 admin.initializeApp({credential:admin.credential.cert(sa)});
 inited=true;
}

exports.handler=async(e)=>{

 try{

 if(e.httpMethod!=="POST") return {statusCode:405};

 const token=process.env.TG_BOT_TOKEN;
 if(!token) throw new Error("No TG_BOT_TOKEN");

 const body=JSON.parse(e.body);
 const tg=body.tg;

 if(!telegramCheck(tg,token)){
 return {statusCode:401,body:JSON.stringify({ok:false,error:"Hash bad"})};
 }

 initAdmin();

 const uid="tg:"+tg.id;

 const customToken=await admin.auth().createCustomToken(uid);

 await admin.firestore().doc("users/"+uid).set({
 tg,
 updatedAt:new Date()
 },{merge:true});

 return {
 statusCode:200,
 body:JSON.stringify({ok:true,customToken})
 };

 }catch(err){
 return {statusCode:500,body:JSON.stringify({ok:false,error:err.message})};
 }

};
