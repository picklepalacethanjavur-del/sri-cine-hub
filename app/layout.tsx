import type { Metadata } from "next";import "./globals.css";import { SiteHeader } from "@/components/SiteHeader";import { SiteFooter } from "@/components/SiteFooter";
export const metadata:Metadata={title:"Sri Cine Hub | Camera Rental Chennai",description:"Cinema cameras, lenses, lights, grip, transport, gensets and post-production services in Chennai."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><SiteHeader/><main>{children}</main><SiteFooter/></body></html>}
