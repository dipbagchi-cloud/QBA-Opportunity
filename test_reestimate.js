const http = require("http");

function chat(token, msg) {
  return new Promise((resolve) => {
    const opts = {
      hostname:"localhost",port:3001,path:"/api/chatbot/message",method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+token}
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          console.log(">> " + msg);
          console.log("<< " + (j.content || "").substring(0, 600));
          if (j.actions) console.log("   Actions: " + JSON.stringify(j.actions).substring(0, 500));
          console.log("");
        } catch(e) { console.log("ERROR: " + data.substring(0, 300)); }
        resolve();
      });
    });
    req.on("error", (e) => { console.log("ERROR: " + e.message); resolve(); });
    req.write(JSON.stringify({message: msg}));
    req.end();
  });
}

async function main() {
  const loginOpts = {hostname:"localhost",port:3001,path:"/api/auth/login",method:"POST",headers:{"Content-Type":"application/json"}};
  const token = await new Promise((resolve) => {
    const req = http.request(loginOpts, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d).token); } catch(e) { resolve(null); } });
    });
    req.write(JSON.stringify({email:"dip.bagchi@example.com",password:"password123"}));
    req.end();
  });
  if (!token) { console.log("Login failed"); return; }
  console.log("Login OK\n");

  // Isolated re-estimate tests
  await chat(token, 'send back "Test new bot" for re-estimate');
  await chat(token, 're-estimate "Test new bot"');
  await chat(token, 'reestimate "Test new bot"');
  await chat(token, 'send "Test new bot" back for re-estimate');
}
main();
