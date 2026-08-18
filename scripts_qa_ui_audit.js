const fs=require('fs'), path=require('path'), ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root='/mnt/data/v6_3_qa';
const results={buttons:[],fields:[],links:[]};
function attr(node,name){
  const a=node.attributes?.properties?.find(p=>ts.isJsxAttribute(p)&&p.name.text===name);
  if(!a)return null;
  if(!a.initializer)return true;
  if(ts.isStringLiteral(a.initializer))return a.initializer.text;
  return 'expr';
}
function hasMeaningfulChildren(el){
  const kids=el.children||[];
  return kids.some(c=>{
    if(ts.isJsxText(c))return c.getText().trim().length>0;
    return ts.isJsxExpression(c)||ts.isJsxElement(c)||ts.isJsxSelfClosingElement(c);
  });
}
function walk(node,file,anc=[]){
  if(ts.isJsxElement(node)){
    const name=node.openingElement.tagName.getText();
    if(name==='button'){
      const aria=attr(node.openingElement,'aria-label');
      if(!hasMeaningfulChildren(node)&&!aria) results.buttons.push({file,line:sf.getLineAndCharacterOfPosition(node.pos).line+1,issue:'button has no visible child and no aria-label'});
    }
    if(name==='a'||name==='Link'){
      const aria=attr(node.openingElement,'aria-label');
      if(!hasMeaningfulChildren(node)&&!aria) results.links.push({file,line:sf.getLineAndCharacterOfPosition(node.pos).line+1,issue:`${name} has no visible child and no aria-label`});
    }
  }
  if(ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node)){
    const name=node.tagName.getText();
    if(['input','select','textarea'].includes(name)){
      const inLabel=anc.some(a=>ts.isJsxElement(a)&&a.openingElement.tagName.getText()==='label');
      const aria=attr(node,'aria-label');
      const id=attr(node,'id');
      const placeholder=attr(node,'placeholder');
      if(!inLabel&&!aria&&!id){
        results.fields.push({file,line:sf.getLineAndCharacterOfPosition(node.pos).line+1,tag:name,placeholder,issue:'field is not nested in label and has no aria-label/id'});
      }
    }
  }
  ts.forEachChild(node,c=>walk(c,file,[...anc,node]));
}
function recurse(dir){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.next'].includes(e.name))continue;
  const p=path.join(dir,e.name);
  if(e.isDirectory())recurse(p); else if(/\.(tsx|jsx)$/.test(e.name)){
   const text=fs.readFileSync(p,'utf8');
   global.sf=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   walk(sf,path.relative(root,p),[]);
  }
 }
}
recurse(root);
console.log(JSON.stringify(results,null,2));
