import { permissionDeniedResponse } from "../permissions.js";
export function stage4ErrorResponse(error,request){try{return permissionDeniedResponse(error,request);}catch{return Response.json({error:error?.message||"Stage 4 request failed.",code:error?.code||undefined},{status:Number(error?.status)||400});}}
export function redirectStage4(request,pathname,notice=""){const url=new URL(pathname,process.env.PUBLIC_APP_URL||request.url);if(notice)url.searchParams.set("notice",notice);return Response.redirect(url,303);}
