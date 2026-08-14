import crypto from "node:crypto";
import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assertAllowedOutputPaths, getGenerationAdapter, safeSlug } from "./registry.js";

function escapeHtml(value){return String(value||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");}
function replaceSimpleSlot(html,slot,value){const escaped=escapeHtml(value);const pattern=new RegExp(`(<[^>]+data-slot=["']${slot}["'][^>]*>)([^<]*)(</[^>]+>)`,`g`);return html.replace(pattern,`$1${escaped}$3`);}
function run(command,args,cwd){const result=spawnSync(command,args,{cwd,encoding:"utf8",maxBuffer:10*1024*1024});if(result.status!==0)throw Object.assign(new Error(`${command} ${args.join(" ")} failed: ${result.stderr||result.stdout}`),{code:"worker_command_failed"});return result.stdout.trim();}

export async function createIsolatedGitWorkspace(repoRoot,baselineCommit="HEAD"){
  const tempRoot=await mkdtemp(path.join(os.tmpdir(),"dgtl-generation-"));const workspace=path.join(tempRoot,"worktree");
  run("git",["worktree","add","--detach",workspace,baselineCommit],repoRoot);
  return{path:workspace,baselineCommit:run("git",["rev-parse","HEAD"],workspace),async cleanup(){run("git",["worktree","remove","--force",workspace],repoRoot);await rm(tempRoot,{recursive:true,force:true});}};
}

export async function generateTemplatePitch(job,{workspaceRoot}){
  const adapter=getGenerationAdapter(job.adapterId);if(!adapter||adapter.id!=="pitch.pages")throw new Error("The deterministic acceptance worker supports pitch.pages only.");
  const slug=safeSlug(job.slug);const outputDir=path.join(workspaceRoot,"pitches",slug);await mkdir(outputDir,{recursive:false});
  const templatePath=path.join(workspaceRoot,"pitches","_templates","website-overhaul.html");let html=await readFile(templatePath,"utf8");
  const company=job.contextSnapshot.company;const opportunity=job.contextSnapshot.opportunity;const verified=(job.contextSnapshot.research||[]).filter((item)=>item.provenanceClass==="verified_research");
  html=html.replace(/(<span[^>]*data-slot=["']brand-name["'][^>]*>)[\s\S]*?(<\/span>)/g,`$1${escapeHtml(company.displayName)}$2`);
  html=replaceSimpleSlot(html,"hero-headline",`${company.displayName} deserves a digital presence that proves the business behind it.`);
  html=replaceSimpleSlot(html,"hero-subhead",`${opportunity.approachAngle} The proposed entry point is ${opportunity.entryOffer||opportunity.offer}.`);
  html=replaceSimpleSlot(html,"opportunity-headline",opportunity.approachAngle);
  html=replaceSimpleSlot(html,"opportunity-lead",verified[0]?.content||"The approved brief identifies a clear opportunity without presenting unverified notes as fact.");
  html=replaceSimpleSlot(html,"opportunity-body",`${opportunity.offer||opportunity.entryOffer} is the recommended starting point. This page preserves the approved strategy separately from sourced research.`);
  html=replaceSimpleSlot(html,"closing-body",job.brief?.intendedCta||"Book a call to review the proposed first step.");
  if(job.revisionInstructions)html+=`\n<!-- DGTL revision instruction: ${escapeHtml(job.revisionInstructions)} -->\n`;
  const manifest={slug,name:`${company.displayName} × DGTL`,type:"pitch",client:company.displayName,status:"draft",hub:"index.html",teaser:null,canonicalUrl:"",notes:`Generated through ${adapter.skillName} ${job.adapterVersion} from immutable job ${job.id}.`,updated:new Date().toISOString().slice(0,10),pendingAssets:[]};
  await writeFile(path.join(outputDir,"index.html"),html);await writeFile(path.join(outputDir,"pitch.json"),`${JSON.stringify(manifest,null,2)}\n`);
  const registryPath=path.join(workspaceRoot,"pitches","pitches.index.json");const registry=JSON.parse(await readFile(registryPath,"utf8"));if(registry.pitches.includes(slug))throw Object.assign(new Error("Slug collision in pitches.index.json."),{code:"slug_collision"});registry.pitches.push(slug);registry.pitches.sort();registry.updated=manifest.updated;await writeFile(registryPath,`${JSON.stringify(registry,null,2)}\n`);
  const paths=[`pitches/${slug}/index.html`,`pitches/${slug}/pitch.json`,`pitches/pitches.index.json`];assertAllowedOutputPaths(adapter,slug,paths);
  return{paths,sourcePath:`pitches/${slug}/index.html`,manifestReference:`pitches/${slug}/pitch.json`};
}

export async function validateGeneratedPitch(job,{workspaceRoot,outputManifest,linkCheckRunner=(root)=>run("python3",["tools/check-links.py"],root),changedPathsRunner=(root,paths)=>recordWorkspaceDiff(root,paths).paths}){
  const adapter=getGenerationAdapter(job.adapterId);assertAllowedOutputPaths(adapter,job.slug,outputManifest.paths);
  const changedPaths=changedPathsRunner(workspaceRoot,outputManifest.paths);assertAllowedOutputPaths(adapter,job.slug,changedPaths);
  for(const relative of outputManifest.paths){const file=await lstat(path.join(workspaceRoot,relative));if(file.isSymbolicLink()||!file.isFile())throw Object.assign(new Error(`Generated output must be a regular file: ${relative}`),{code:"unsafe_generated_file"});}
  const manifest=JSON.parse(await readFile(path.join(workspaceRoot,outputManifest.manifestReference),"utf8"));const html=await readFile(path.join(workspaceRoot,outputManifest.sourcePath),"utf8");const registry=JSON.parse(await readFile(path.join(workspaceRoot,"pitches","pitches.index.json"),"utf8"));
  const checks={manifestExists:manifest.slug===job.slug,registered:registry.pitches.includes(job.slug),requiredIndex:/<!doctype html>/i.test(html),noRootAbsoluteLinks:!/(?:href|src)=["']\/(?!\/)/i.test(html),noUnexpectedPaths:true,reportedPathsPresent:outputManifest.paths.every((item)=>changedPaths.includes(item))};
  const linkOutput=linkCheckRunner(workspaceRoot);checks.repoLinkGate=/missing=0/.test(linkOutput);
  const passed=Object.values(checks).every(Boolean);const payload=[];for(const relative of outputManifest.paths.sort())payload.push(relative,await readFile(path.join(workspaceRoot,relative)));const contentChecksum=crypto.createHash("sha256").update(Buffer.concat(payload.map((item)=>Buffer.isBuffer(item)?item:Buffer.from(item)))).digest("hex");
  return{contentChecksum,validationResults:{passed,checks,linkOutput},outputManifest};
}

export function recordWorkspaceDiff(workspaceRoot,generatedPaths=[]){if(generatedPaths.length)run("git",["add","-N","--",...generatedPaths],workspaceRoot);return{paths:run("git",["status","--short"],workspaceRoot).split("\n").filter(Boolean).map((line)=>line.replace(/^(?:..\s|.\s)/,"")),diffSummary:run("git",["diff","--stat"],workspaceRoot)};}
export function commitWorkspaceCandidate(workspaceRoot,slug){const safe=safeSlug(slug);run("git",["add","--",`pitches/${safe}`,"pitches/pitches.index.json"],workspaceRoot);run("git",["-c","user.name=DGTL Generation Worker","-c","user.email=generation@invalid.local","commit","-m",`build(pitch): generate ${safe}`],workspaceRoot);return run("git",["rev-parse","HEAD"],workspaceRoot);}
