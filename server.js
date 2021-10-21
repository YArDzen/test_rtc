const express = require("express");
const http = require("http");

const WebSocket = require('ws');

const app = express();
const server = http.createServer(app)

let serve_static = express.static(__dirname + "/static");
app.use("/static", serve_static);

const wsServer = new WebSocket.Server({ server });
let ws_connections = {};

function uuidv4() {
 return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
   var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
   return v.toString(16);
 });
}

function onConnect(wsClient, req){
  let current_id = uuidv4();

  ws_connections[current_id] = wsClient;

  wsClient.on('message', function(message) {
    let data;
    try{
      data = JSON.parse(message.toString());
    }catch{
      return;
    }

    for(let key in ws_connections){
      if(key != current_id){
        ws_connections[key].send(JSON.stringify(data))
        break;
      }
    }
  });

  wsClient.on("close", function(){
    delete ws_connections[current_id];
  });
}

wsServer.on('connection', onConnect);
app.get("/", function(request, response){
  response.sendFile(__dirname + "/templates/index.html");
})

server.listen(3000);
