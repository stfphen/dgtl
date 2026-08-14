import crypto from "node:crypto";

function timingSafeEqual(left,right){const a=Buffer.from(String(left||""));const b=Buffer.from(String(right||""));return a.length===b.length&&crypto.timingSafeEqual(a,b);}

export function authenticateGenerationWorker(request, env = process.env) {
  const expected=String(env.CORE_GENERATION_WORKER_TOKEN||"");
  const teamId=String(env.CORE_GENERATION_WORKER_TEAM_ID||"");
  const authorization=String(request?.headers?.get?.("authorization")||"");
  const supplied=authorization.startsWith("Bearer ")?authorization.slice(7):"";
  if(!expected||!teamId||!timingSafeEqual(supplied,expected))throw Object.assign(new Error("Generation worker authentication failed."),{status:401});
  return {id:String(env.CORE_GENERATION_WORKER_ID||"generation-worker"),teamId,scopes:["generation:claim","generation:submit","deployment:claim","deployment:submit"]};
}
