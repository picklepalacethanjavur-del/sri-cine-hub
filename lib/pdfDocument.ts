import {PDFDocument,StandardFonts,rgb,PDFFont,PDFPage} from "pdf-lib";

type Line={description:string;quantity:number;days:number;rate:number;amount:number;section?:string};
type Layout="standard"|"request"|"receipt";
type Doc={title:string;number:string;partyLabel:string;party:string;project?:string;period?:string;lines:Line[];subtotal?:number;discount?:number;tax?:number;other?:number;total?:number;notes?:string;requestOnly?:boolean;layout?:Layout};
const fmt=(n:number)=>`Rs. ${Number(n||0).toLocaleString("en-IN")}`;
function split(font:PDFFont,text:string,size:number,max:number){const words=String(text||"").split(/\s+/);const lines:string[]=[];let line="";for(const w of words){const next=line?`${line} ${w}`:w;if(font.widthOfTextAtSize(next,size)<=max)line=next;else{if(line)lines.push(line);line=w;}}if(line)lines.push(line);return lines.length?lines:[""];}
export async function makeBusinessPdf(d:Doc){
 const pdf=await PDFDocument.create();const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);const W=595,H=842,M=42;let page!:PDFPage;let y=0;
 const layout:Layout=d.layout||(d.requestOnly?"request":"standard");
 function newPage(){page=pdf.addPage([W,H]);y=H-M;page.drawText("SRI CINE HUB PVT. LTD.",{x:M,y,size:15,font:bold,color:rgb(.08,.08,.08)});page.drawText("Cinema Equipment Rental & Production Services",{x:M,y:y-18,size:8,font:regular,color:rgb(.35,.35,.35)});page.drawLine({start:{x:M,y:y-30},end:{x:W-M,y:y-30},thickness:1,color:rgb(.72,.57,.23)});y-=52;}
 function ensure(h:number){if(y-h<M+30)newPage();}
 function drawTableHeader(){
   ensure(28);
   page.drawRectangle({x:M,y:y-18,width:W-2*M,height:22,color:rgb(.94,.94,.94)});
   const color=rgb(.28,.28,.28),size=7.5;
   if(layout==="receipt"){
     page.drawText("DESCRIPTION",{x:M+8,y:y-10,size,font:bold,color});
     const label="AMOUNT";page.drawText(label,{x:W-M-bold.widthOfTextAtSize(label,size)-8,y:y-10,size,font:bold,color});
   }else if(layout==="request"){
     page.drawText("S.NO",{x:M+4,y:y-10,size,font:bold,color});
     page.drawText("DESCRIPTION",{x:M+28,y:y-10,size,font:bold,color});
     page.drawText("QTY",{x:382,y:y-10,size,font:bold,color});
     page.drawText("DAYS",{x:430,y:y-10,size,font:bold,color});
   }else{
     page.drawText("S.NO",{x:M+4,y:y-10,size,font:bold,color});
     page.drawText("DESCRIPTION",{x:M+28,y:y-10,size,font:bold,color});
     page.drawText("QTY",{x:348,y:y-10,size,font:bold,color});
     page.drawText("DAYS",{x:389,y:y-10,size,font:bold,color});
     page.drawText("RATE",{x:430,y:y-10,size,font:bold,color});
     const label="AMOUNT";page.drawText(label,{x:W-M-bold.widthOfTextAtSize(label,size),y:y-10,size,font:bold,color});
   }
   y-=28;
 }
 newPage();page.drawText(d.title.toUpperCase(),{x:M,y,size:20,font:bold});page.drawText(d.number,{x:W-M-bold.widthOfTextAtSize(d.number,11),y:y+4,size:11,font:bold});y-=32;
 page.drawText(d.partyLabel,{x:M,y,size:8,font:bold,color:rgb(.4,.4,.4)});page.drawText(d.party||"Not entered",{x:M,y:y-15,size:11,font:bold});if(d.project){page.drawText("PROJECT",{x:320,y,size:8,font:bold,color:rgb(.4,.4,.4)});page.drawText(d.project,{x:320,y:y-15,size:10,font:bold});}y-=42;if(d.period){page.drawText("RENTAL PERIOD",{x:M,y,size:8,font:bold,color:rgb(.4,.4,.4)});page.drawText(d.period,{x:M,y:y-15,size:9,font:regular});y-=38;}
 let current="";let n=0;for(const line of d.lines){if((line.section||"General")!==current){ensure(62);current=line.section||"General";page.drawRectangle({x:M,y:y-18,width:W-2*M,height:24,color:rgb(.96,.94,.88)});page.drawText(current.toUpperCase(),{x:M+8,y:y-10,size:9,font:bold,color:rgb(.25,.2,.08)});y-=34;drawTableHeader();}
   ensure(38);n++;
   if(layout==="receipt"){
     const desc=split(regular,line.description||"Untitled item",9,390);for(let i=0;i<desc.length;i++)page.drawText(desc[i],{x:M+8,y:y-i*11,size:9,font:i===0?bold:regular});const amt=fmt(line.amount||0);page.drawText(amt,{x:W-M-bold.widthOfTextAtSize(amt,9)-8,y,size:9,font:bold});y-=Math.max(28,desc.length*11+8);
   }else if(layout==="request"){
     const desc=split(regular,line.description||"Untitled item",9,315);page.drawText(String(n),{x:M+4,y,size:9,font:regular});for(let i=0;i<desc.length;i++)page.drawText(desc[i],{x:M+28,y:y-i*11,size:9,font:i===0?bold:regular});page.drawText(String(line.quantity||0),{x:382,y,size:9,font:regular});page.drawText(String(line.days||0),{x:430,y,size:9,font:regular});y-=Math.max(28,desc.length*11+8);
   }else{
     const desc=split(regular,line.description||"Untitled item",9,265);page.drawText(String(n),{x:M+4,y,size:9,font:regular});for(let i=0;i<desc.length;i++)page.drawText(desc[i],{x:M+28,y:y-i*11,size:9,font:i===0?bold:regular});page.drawText(String(line.quantity||0),{x:348,y,size:9,font:regular});page.drawText(String(line.days||0),{x:389,y,size:9,font:regular});page.drawText(fmt(line.rate||0),{x:430,y,size:8,font:regular});const amt=fmt(line.amount||0);page.drawText(amt,{x:W-M-bold.widthOfTextAtSize(amt,8),y,size:8,font:bold});y-=Math.max(28,desc.length*11+8);
   }
   page.drawLine({start:{x:M,y:y+5},end:{x:W-M,y:y+5},thickness:.4,color:rgb(.88,.88,.88)});
 }
 if(!d.requestOnly){ensure(110);y-=8;const x=360;const rows:Array<[string,number]>=[["Subtotal",d.subtotal||0],["Discount",-(d.discount||0)],["Tax",d.tax||0],["Other",d.other||0]];for(const [label,val] of rows){if(val!==0||label==="Subtotal"){page.drawText(label,{x,y,size:9,font:regular});page.drawText(fmt(val),{x:W-M-bold.widthOfTextAtSize(fmt(val),9),y,size:9,font:bold});y-=18;}}page.drawLine({start:{x,y:y+4},end:{x:W-M,y:y+4},thickness:1,color:rgb(.72,.57,.23)});page.drawText("GRAND TOTAL",{x,y:y-14,size:11,font:bold});page.drawText(fmt(d.total||0),{x:W-M-bold.widthOfTextAtSize(fmt(d.total||0),12),y:y-14,size:12,font:bold});y-=42;}
 if(d.notes){ensure(80);page.drawText("NOTES",{x:M,y,size:8,font:bold,color:rgb(.4,.4,.4)});y-=15;for(const l of split(regular,d.notes,9,W-2*M)){page.drawText(l,{x:M,y,size:9,font:regular});y-=12;}}
 const pages=pdf.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:M,y:30},end:{x:W-M,y:30},thickness:.5,color:rgb(.85,.85,.85)});p.drawText(`Sri Cine Hub Pvt. Ltd.  |  Page ${i+1} of ${pages.length}`,{x:M,y:18,size:7,font:regular,color:rgb(.45,.45,.45)});});
 return pdf.save();
}
