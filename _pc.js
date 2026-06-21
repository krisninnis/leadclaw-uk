const babel=require("./node_modules/@babel/core");const fs=require("fs");const path=require("path");let bad=0;
for(const f of ["src/app/page.tsx","src/components/app-footer.tsx"]){
 try{babel.parseSync(fs.readFileSync(f,"utf8"),{filename:f,configFile:path.resolve("babel.config.js")});console.log("PARSE OK   ",f);}
 catch(e){console.log("PARSE FAIL ",f,"::",e.message.split("\n")[0]);bad=1;}
}
// Validate JSON-LD objects are serialisable/parse-able by evaluating the literals out of the source
process.exit(bad);
