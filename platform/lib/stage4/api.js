import { permissionDeniedResponse } from "../permissions.js";
import { redirectSameHost } from "../http/redirects.js";
export function stage4ErrorResponse(error,request){try{return permissionDeniedResponse(error,request);}catch{return Response.json({error:error?.message||"Stage 4 request failed.",code:error?.code||undefined},{status:Number(error?.status)||400});}}
export function redirectStage4(request,pathname,notice=""){return redirectSameHost(pathname,notice);}
