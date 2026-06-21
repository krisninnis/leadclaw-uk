const fs=require("fs");
const src=fs.readFileSync("src/app/page.tsx","utf8");
function grab(name){
  const re=new RegExp("const "+name+" = ([\\s\\S]*?);\\n\\n","m");
  const m=src.match(re); if(!m) throw new Error("not found: "+name); return m[1];
}
const faqs=eval("("+grab("faqs")+")");
const softwareSchema=eval("("+grab("softwareSchema")+")");
const organizationSchema=eval("("+grab("organizationSchema")+")");
const serviceSchema=eval("("+grab("serviceSchema")+")");
const faqSchema=eval("("+grab("faqSchema")+")");
const blocks={softwareSchema,organizationSchema,serviceSchema,faqSchema};
for(const [k,v] of Object.entries(blocks)){
  const s=JSON.stringify(v); JSON.parse(s); // round-trip
  console.log(k.padEnd(20),"@type="+(Array.isArray(v["@type"])?v["@type"].join("/"):v["@type"]), "bytes="+s.length);
}
console.log("FAQ count:", faqSchema.mainEntity.length, "| questions on page:", faqs.length);
console.log("Any phone/address in schema?:", /phone|tel|streetAddress|PostalAddress/i.test(JSON.stringify(blocks))?"YES (problem)":"none");
