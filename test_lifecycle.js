const http = require("http");

function test(name, opts, body) {
  return new Promise((resolve) => {
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => data += c);
      res.on("end", () => {
        console.log(name + ": " + res.statusCode);
        if (res.statusCode !== 200) {
          console.log("  Body: " + data.substring(0, 300));
        } else {
          try {
            const j = JSON.parse(data);
            console.log("  Content: " + (j.content || j.response || j.message || JSON.stringify(j)).substring(0, 250));
          } catch(e) {
            console.log("  Body: " + data.substring(0, 300));
          }
        }
        resolve();
      });
    });
    req.on("error", (e) => { console.log(name + " ERROR: " + e.message); resolve(); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // First login
  const loginOpts = {hostname:"localhost",port:3001,path:"/api/auth/login",method:"POST",headers:{"Content-Type":"application/json"}};
  const token = await new Promise((resolve) => {
    const req = http.request(loginOpts, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d).token); } catch(e) { console.log("Login failed: " + d.substring(0,200)); resolve(null); }
      });
    });
    req.write(JSON.stringify({email:"dip.bagchi@example.com",password:"password123"}));
    req.end();
  });
  if (!token) return;
  console.log("Login OK\n");

  const chatOpts = () => ({
    hostname:"localhost",port:3001,path:"/api/chatbot/message",method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+token}
  });

  // Test 1: Basic greeting
  await test("T1-Greeting", chatOpts(), {message:"hello"});
  // Test 2: List opportunities
  await test("T2-List", chatOpts(), {message:"show my opportunities"});
  // Test 3: Move to presales
  await test("T3-MovePresales", chatOpts(), {message:"move opportunity to presales"});
  // Test 4: Move to sales
  await test("T4-MoveSales", chatOpts(), {message:"move opportunity to sales"});
  // Test 5: Proposal sent
  await test("T5-ProposalSent", chatOpts(), {message:"proposal sent for opportunity"});
  // Test 6: Mark lost
  await test("T6-MarkLost", chatOpts(), {message:"mark opportunity as lost"});
  // Test 7: Re-estimate
  await test("T7-Reestimate", chatOpts(), {message:"send back opportunity for re-estimate"});
  // Test 8: Help
  await test("T8-Help", chatOpts(), {message:"help"});
}
main();
