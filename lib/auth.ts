import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireStaff(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) redirect("/login");
  const {data:profile}=await supabase.from("profiles")
    .select("full_name,role,is_active").eq("id",user.id).single();
  if(!profile?.is_active || !["admin","manager"].includes(profile.role)) redirect("/investors");
  return {supabase,user,profile};
}

export async function requireInvestor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles")
    .select("full_name,role,is_active").eq("id", user.id).single();
  if (!profile?.is_active || !["investor","admin","manager"].includes(profile.role)) redirect("/");
  return { supabase, user, profile };
}
