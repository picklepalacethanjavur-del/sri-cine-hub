import { address, phones } from "@/lib/data";
export function SiteFooter(){return <footer className="siteFooter"><div className="footerInner"><div><b>SRI CINE HUB PVT. LTD.</b><p>Camera Rental · Lights · Grip · Post Production Studio</p></div><div><b>Location</b><p>{address}</p></div><div><b>Contact</b><p>{phones.join(" · ")}</p></div></div></footer>}
