"use client";
import { useRef } from "react";

type Props={
  label:string; value:string; onChange:(v:string)=>void; min?:string; required?:boolean;
};
export function DateTimePicker({label,value,onChange,min,required=true}:Props){
  const dateRef=useRef<HTMLInputElement>(null);
  const timeRef=useRef<HTMLInputElement>(null);
  const [date,time="09:00"]=value?value.split("T"):["","09:00"];
  const emit=(d:string,t:string)=>onChange(d?`${d}T${t||"09:00"}`:"");
  return <label className="dateTimeLabel">
    <span>{label}{required?" *":""}</span>
    <div className="dateTimePicker">
      <div className="pickerPart" onClick={()=>dateRef.current?.showPicker?.()}>
        <span className="pickerIcon">▣</span>
        <input ref={dateRef} type="date" required={required} value={date}
          min={min?.split("T")[0]} onChange={e=>emit(e.target.value,time)}/>
      </div>
      <div className="pickerPart" onClick={()=>timeRef.current?.showPicker?.()}>
        <span className="pickerIcon">◷</span>
        <input ref={timeRef} type="time" required={required} value={date?time:"09:00"}
          onChange={e=>emit(date,e.target.value)}/>
      </div>
    </div>
  </label>;
}
