
import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {loadPremiumReceiptData} from "@/lib/receiptData";
import {makePremiumReceiptPdf} from "@/lib/receiptPdf";

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return new NextResponse("Unauthorized",{status:401});
  const {data:profile}=await supabase.from("profiles").select("role,is_active").eq("id",user.id).single();
  if(!profile?.is_active||!["admin","staff"].includes(profile.role))return new NextResponse("Forbidden",{status:403});
  const data=await loadPremiumReceiptData(supabase,id);
  if(!data)return new NextResponse("Not found",{status:404});
  const bytes=await makePremiumReceiptPdf(data);
  return new NextResponse(bytes,{headers:{
    "Content-Type":"application/pdf",
    "Content-Disposition":`attachment; filename="SriCineHub-${data.receiptCode}.pdf"`
  }});
}
