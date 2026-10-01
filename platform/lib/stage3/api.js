import { permissionDeniedResponse } from "../permissions.js";
import { redirectSameHost } from "../http/redirects.js";
export function stage3ErrorResponse(error,request){try{return permissionDeniedResponse(error,request);}catch{return Response.json({error:error?.message||"Stage 3 request failed.",code:error?.code||undefined,missing:error?.missing||undefined},{status:Number(error?.status)||400});}}
export function redirectStage3(request,pathname,notice=""){return redirectSameHost(pathname,notice);}
