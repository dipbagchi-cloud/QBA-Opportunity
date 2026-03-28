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
          console.log("<< " + (j.content || "").substring(0, 400));
          if (j.actions) console.log("   Actions: " + JSON.stringify(j.actions).substring(0, 300));
          if (j.data) console.log("   Data: " + JSON.stringify(j.data).substring(0, 300));
          console.log("");
        } catch(e) {
          console.log(">> " + msg);
          console.log("<< ERROR: " + data.substring(0, 300));
        }
        resolve();
      });
    });
    req.on("error", (e) => { console.log("ERROR: " + e.message); resolve(); });
    req.write(JSON.stringify({message: msg}));
    req.end();
  });
}

async function main() {
  // Login
  const loginOpts = {hostname:"localhost",port:3001,path:"/api/auth/login",method:"POST",headers:{"Content-Type":"application/json"}};
  const token = await new Promise((resolve) => {
    const req = http.request(loginOpts, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d).token); } catch(e) { console.log("Login failed"); resolve(null); }
      });
    });
    req.write(JSON.stringify({email:"dip.bagchi@example.com",password:"password123"}));
    req.end();
  });
  if (!token) return;
  console.log("Login OK\n");

  // First list opportunities to see what's available
  await chat(token, "show my opportunities with their stages");

  // Try move to presales with a specific name (will need to find a Discovery stage one)
  await chat(token, 'move "Test" to presales');

  // Try help to see lifecycle section
  await chat(token, "what lifecycle actions can you do?");
}
main();
