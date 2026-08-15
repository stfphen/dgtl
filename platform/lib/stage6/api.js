import { permissionDeniedResponse } from "../permissions.js";
export function stage6ErrorResponse(error,request){try{return permissionDeniedResponse(error,request);}catch{return Response.json({error:error?.message||"Assistant request failed.",code:error?.code||undefined},{status:Number(error?.status)||400});}}
