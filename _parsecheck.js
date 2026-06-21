const babel = require("./node_modules/@babel/core");
const fs = require("fs");
let bad=0;
for (const f of ["src/app/page.tsx","src/components/app-footer.tsx"]) {
  try {
    babel.parseSync(fs.readFileSync(f,"utf8"), {
      filename: f,
      presets: [["./node_modules/@babel/preset-react",{runtime:"automatic"}], "./node_modules/@babel/preset-typescript"],
    });
    console.log("PARSE OK   ", f);
  } catch (e) { console.log("PARSE FAIL ", f, "::", e.message.split("\n")[0]); bad=1; }
}
process.exit(bad);
