
import {PDFDocument,StandardFonts,rgb,PDFFont,PDFPage} from "pdf-lib";
import type {PremiumReceiptData,PremiumReceiptLine} from "./receiptData";

const money=(v:number)=>`Rs. ${Number(v||0).toLocaleString("en-IN")}`;
const shortDate=(v:string)=>v?new Date(v).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";

function split(font:PDFFont,text:string,size:number,max:number){
  const words=String(text||"").split(/\s+/);const out:string[]=[];let line="";
  for(const w of words){const next=line?`${line} ${w}`:w;if(font.widthOfTextAtSize(next,size)<=max)line=next;else{if(line)out.push(line);line=w;}}
  if(line)out.push(line);return out.length?out:[""];
}

export async function makePremiumReceiptPdf(d:PremiumReceiptData){
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const W=595,H=842,M=38;
  const charcoal=rgb(.08,.08,.08),gold=rgb(.72,.57,.23),muted=rgb(.38,.38,.38),light=rgb(.965,.96,.945),line=rgb(.86,.86,.84);
  let page!:PDFPage,y=0,pageNo=0;

  function header(){
    pageNo++;page=pdf.addPage([W,H]);y=H-M;
    page.drawRectangle({x:M,y:y-56,width:W-2*M,height:58,color:charcoal});
    page.drawText("SRI CINE HUB PVT. LTD.",{x:M+14,y:y-22,size:16,font:bold,color:rgb(1,1,1)});
    page.drawText("Cinema Equipment Rental & Production Services",{x:M+14,y:y-39,size:8,font:regular,color:rgb(.78,.78,.78)});
    page.drawText("RENTAL RECEIPT",{x:W-M-128,y:y-18,size:10,font:bold,color:rgb(1,1,1)});
    page.drawText(d.receiptCode,{x:W-M-128,y:y-35,size:9,font:bold,color:rgb(.88,.72,.3)});
    y-=78;
  }
  function ensure(h:number){if(y-h<55)header();}
  function labelValue(x:number,yy:number,label:string,value:string,w=220){
    page.drawText(label.toUpperCase(),{x,y:yy,size:6.8,font:bold,color:muted});
    for(const [i,l] of split(bold,value||"—",8.7,w).entries())page.drawText(l,{x,y:yy-13-i*10,size:8.7,font:bold,color:charcoal});
  }
  function sectionTitle(text:string){
    ensure(30);page.drawText(text.toUpperCase(),{x:M,y,size:8,font:bold,color:rgb(.45,.34,.1)});
    page.drawLine({start:{x:M,y:y-5},end:{x:W-M,y:y-5},thickness:.8,color:gold});y-=20;
  }

  header();

  // Summary cards
  ensure(110);
  page.drawRectangle({x:M,y:y-86,width:250,height:88,color:light,borderColor:line,borderWidth:.5});
  page.drawRectangle({x:M+263,y:y-86,width:256,height:88,color:light,borderColor:line,borderWidth:.5});
  page.drawText("CLIENT INFORMATION",{x:M+10,y:y-14,size:7,font:bold,color:rgb(.45,.34,.1)});
  labelValue(M+10,y-30,"Client",d.customer.company||d.customer.name,220);
  if(d.customer.company&&d.customer.name)labelValue(M+10,y-54,"Contact",d.customer.name,220);
  const contact=[d.customer.phone,d.customer.email].filter(Boolean).join("  |  ");
  if(contact)page.drawText(contact,{x:M+10,y:y-76,size:7,font:regular,color:muted});

  page.drawText("RENTAL SUMMARY",{x:M+273,y:y-14,size:7,font:bold,color:rgb(.45,.34,.1)});
  labelValue(M+273,y-30,"Booking",d.rental.bookingCode,110);
  labelValue(M+395,y-30,"Quotation",d.rental.quotationCode||"—",118);
  labelValue(M+273,y-55,"Project",d.rental.project||d.rental.production||"—",230);
  page.drawText(`${d.rental.pickup}  →  ${d.rental.returnAt}  (${d.rental.duration})`,{x:M+273,y:y-76,size:6.8,font:regular,color:muted});
  y-=108;

  sectionTitle("Equipment & Services");
  function tableHead(){
    ensure(26);page.drawRectangle({x:M,y:y-17,width:W-2*M,height:21,color:charcoal});
    const c=rgb(1,1,1),s=6.7;
    page.drawText("#",{x:M+6,y:y-10,size:s,font:bold,color:c});
    page.drawText("DESCRIPTION",{x:M+22,y:y-10,size:s,font:bold,color:c});
    page.drawText("ASSET / SERIAL",{x:275,y:y-10,size:s,font:bold,color:c});
    page.drawText("QTY",{x:373,y:y-10,size:s,font:bold,color:c});
    page.drawText("DAYS",{x:405,y:y-10,size:s,font:bold,color:c});
    page.drawText("RATE",{x:445,y:y-10,size:s,font:bold,color:c});
    page.drawText("AMOUNT",{x:501,y:y-10,size:s,font:bold,color:c});
    y-=28;
  }
  tableHead();
  let idx=0;
  for(const item of d.lines){
    ensure(34);idx++;
    const desc=split(regular,item.description,7.3,235);
    page.drawText(String(idx),{x:M+6,y,size:7.3,font:regular,color:charcoal});
    desc.forEach((t,i)=>page.drawText(t,{x:M+22,y:y-i*9,size:7.3,font:i===0?bold:regular,color:charcoal}));
    const asset=split(regular,item.assetRef||"—",6.8,88);asset.slice(0,2).forEach((t,i)=>page.drawText(t,{x:275,y:y-i*9,size:6.8,font:regular,color:muted}));
    page.drawText(String(item.quantity||0),{x:377,y,size:7.2,font:regular});
    page.drawText(String(item.days||0),{x:409,y,size:7.2,font:regular});
    const rate=money(item.rate);page.drawText(rate,{x:493-regular.widthOfTextAtSize(rate,6.2),y,size:6.2,font:regular});
    const amt=money(item.amount);page.drawText(amt,{x:W-M-bold.widthOfTextAtSize(amt,6.4),y,size:6.4,font:bold});
    y-=Math.max(26,desc.length*9+8);
    page.drawLine({start:{x:M,y:y+5},end:{x:W-M,y:y+5},thickness:.35,color:line});
    if(y<105&&idx<d.lines.length){header();sectionTitle("Equipment & Services — Continued");tableHead();}
  }

  ensure(175);y-=6;
  const leftX=M,rightX=322,boxTop=y;
  page.drawRectangle({x:leftX,y:boxTop-130,width:245,height:132,color:light,borderColor:line,borderWidth:.5});
  page.drawRectangle({x:rightX,y:boxTop-130,width:235,height:132,color:light,borderColor:line,borderWidth:.5});
  page.drawText("CHARGES",{x:leftX+10,y:boxTop-15,size:7,font:bold,color:rgb(.45,.34,.1)});
  const chargeRows:Array<[string,number|null,boolean]>=[
    ["Rental total",d.charges.rentalTotal,false],
    ["Damage charges",d.charges.damage,false],
    ["Late charges",d.charges.late,false],
    ["Additional charges",d.charges.additional,false],
    ["Discount",d.charges.receiptDiscount,true],
  ];
  let cy=boxTop-32;
  for(const [label,val,neg] of chargeRows){
    if(val===0&&label!=="Rental total")continue;
    page.drawText(label,{x:leftX+10,y:cy,size:7.5,font:regular,color:muted});
    const value=`${neg?"- ":""}${money(val||0)}`;
    page.drawText(value,{x:leftX+235-bold.widthOfTextAtSize(value,7.5),y:cy,size:7.5,font:bold,color:charcoal});cy-=17;
  }
  page.drawLine({start:{x:leftX+10,y:boxTop-105},end:{x:leftX+235,y:boxTop-105},thickness:1,color:gold});
  page.drawText("GRAND TOTAL",{x:leftX+10,y:boxTop-123,size:9,font:bold,color:charcoal});
  const gt=money(d.charges.grandTotal);page.drawText(gt,{x:leftX+235-bold.widthOfTextAtSize(gt,10),y:boxTop-123,size:10,font:bold,color:charcoal});

  page.drawText("PAYMENT SUMMARY",{x:rightX+10,y:boxTop-15,size:7,font:bold,color:rgb(.45,.34,.1)});
  const statusColor=d.status==="PAID"?rgb(.13,.45,.23):d.status==="PARTIALLY PAID"?rgb(.75,.52,.12):rgb(.68,.18,.16);
  page.drawRectangle({x:rightX+10,y:boxTop-43,width:215,height:20,color:statusColor});
  page.drawText(d.status,{x:rightX+18,y:boxTop-37,size:8,font:bold,color:rgb(1,1,1)});
  page.drawText("Paid",{x:rightX+10,y:boxTop-67,size:8,font:regular,color:muted});
  const paid=money(d.paid);page.drawText(paid,{x:rightX+225-bold.widthOfTextAtSize(paid,8),y:boxTop-67,size:8,font:bold});
  page.drawText("Balance",{x:rightX+10,y:boxTop-88,size:8,font:regular,color:muted});
  const bal=money(d.balance);page.drawText(bal,{x:rightX+225-bold.widthOfTextAtSize(bal,9),y:boxTop-88,size:9,font:bold});
  if(d.payments.length)page.drawText(`${d.payments.length} payment transaction${d.payments.length===1?"":"s"} recorded`,{x:rightX+10,y:boxTop-113,size:6.5,font:regular,color:muted});
  y=boxTop-150;

  sectionTitle("Payment History");
  if(!d.payments.length){
    page.drawText("No payment recorded.",{x:M,y,size:8,font:regular,color:muted});y-=22;
  }else{
    ensure(28);page.drawRectangle({x:M,y:y-17,width:W-2*M,height:21,color:charcoal});
    page.drawText("DATE",{x:M+8,y:y-10,size:6.7,font:bold,color:rgb(1,1,1)});
    page.drawText("METHOD",{x:145,y:y-10,size:6.7,font:bold,color:rgb(1,1,1)});
    page.drawText("REFERENCE",{x:265,y:y-10,size:6.7,font:bold,color:rgb(1,1,1)});
    page.drawText("AMOUNT",{x:500,y:y-10,size:6.7,font:bold,color:rgb(1,1,1)});y-=28;
    for(const p of d.payments){
      ensure(24);
      page.drawText(shortDate(p.date),{x:M+8,y,size:7.3,font:regular});
      page.drawText(p.method,{x:145,y,size:7.3,font:regular});
      page.drawText(p.reference||"—",{x:265,y,size:7.3,font:regular});
      const a=money(p.amount);page.drawText(a,{x:W-M-bold.widthOfTextAtSize(a,7.3),y,size:7.3,font:bold});y-=20;
      page.drawLine({start:{x:M,y:y+5},end:{x:W-M,y:y+5},thickness:.35,color:line});
    }
  }

  if(d.notes){
    ensure(70);y-=6;sectionTitle("Notes");
    for(const t of split(regular,d.notes,7.5,W-2*M)){page.drawText(t,{x:M,y,size:7.5,font:regular,color:muted});y-=10;}
  }

  ensure(55);y-=8;
  page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:.6,color:gold});y-=18;
  page.drawText("Thank you for choosing Sri Cine Hub.",{x:M,y,size:8,font:bold,color:charcoal});
  page.drawText("This receipt reflects the current rental charges and posted payment ledger.",{x:M,y:y-13,size:6.5,font:regular,color:muted});

  const pages=pdf.getPages();
  pages.forEach((p:PDFPage,i:number)=>{
    p.drawLine({start:{x:M,y:28},end:{x:W-M,y:28},thickness:.35,color:line});
    p.drawText(`Sri Cine Hub Pvt. Ltd.  |  Receipt ${d.receiptCode}  |  Page ${i+1} of ${pages.length}`,{x:M,y:17,size:6,font:regular,color:muted});
  });
  return pdf.save();
}
