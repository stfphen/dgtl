import { permissionDeniedResponse } from "../permissions.js";
export function stage3ErrorResponse(error,request){try{return permissionDeniedResponse(error,request);}catch{return Response.json({error:error?.message||"Stage 3 request failed.",code:error?.code||undefined,missing:error?.missing||undefined},{status:Number(error?.status)||400});}}
export function redirectStage3(request,pathname,notice=""){const url=new URL(pathname,process.env.PUBLIC_APP_URL||request.url);if(notice)url.searchParams.set("notice",notice);return Response.redirect(url,303);}
