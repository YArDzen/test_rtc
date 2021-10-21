import {RTC} from "/static/rtc.js";

const ws = new WebSocket("ws://127.0.0.1:8000/ws");
let current_conn = undefined;
let stream = undefined;

let self_video = document.querySelector("#self-video");
let other_video = document.querySelector("#other-video");
let message_block = document.querySelector(".message-block");
let send_btn = document.querySelector("#send");


ws.onopen = async function(){
  try{
     stream = await navigator.mediaDevices.getUserMedia({"video": true});
     self_video.autoplay = true;
     self_video.srcObject = stream;
  }catch(err){}

  ws.send(JSON.stringify({
    "type": "create-connect",
  }));
}
ws.onmessage = function(e){
  let message = JSON.parse(e.data);
  event_loop(message);
}
ws.onerror = function(e){
  console.error(e);
}
ws.onclose = function(e){
  alert("WebSocket закрив з'єднання, будь ласка перезавантажте сторінку");
}

async function event_loop(data){
  if(data["type"] == "create-connect"){

    let rtc = new RTC();
    if(stream != undefined){
      stream.getTracks().forEach(function(track){
        rtc.rtc.addTrack(track);
      });
    }
    rtc.rtc.addEventListener("track", function(e){
      if(e.track.kind == "video"){
        let st = new MediaStream();
        st.addTrack(e.track);
        other_video.srcObject = st;
      }
    });

    rtc.addEventListener("open-channel", function(){
      send_btn.addEventListener("click", function(){
        let text = document.querySelector("#message-text").value;
        document.querySelector("#message-text").value = "";
        current_conn.channel.send(text);

        let p_message = document.createElement("p");
        p_message.innerText = text;

        message_block.append(p_message);
      });
    });
    rtc.addEventListener("message", function(e){
      let message = e.detail;
      let p_message = document.createElement("p");
      p_message.innerText = message;

      message_block.append(p_message);
    });
    let offer = await rtc.createOffer("channel");
    current_conn = rtc;

    ws.send(JSON.stringify({
      "type": "offer",
      "offer": offer,
    }));
  }
  else if(data["type"] == "offer"){
    let rtc = new RTC();
    if(stream != undefined){
      stream.getTracks().forEach(function(track){
        rtc.rtc.addTrack(track);
      });
    }
    rtc.rtc.addEventListener("track", function(e){
      if(e.track.kind == "video"){
        let st = new MediaStream();
        st.addTrack(e.track);
        other_video.srcObject = st;
      }
    });

    rtc.addEventListener("open-channel", function(){
      send_btn.addEventListener("click", function(){
        let text = document.querySelector("#message-text").value;
        document.querySelector("#message-text").value = "";
        current_conn.channel.send(text);

        let p_message = document.createElement("p");
        p_message.innerText = text;

        message_block.append(p_message);
      });
    });
    rtc.addEventListener("message", function(e){
      let message = e.detail;
      let p_message = document.createElement("p");
      p_message.innerText = message;

      message_block.append(p_message);
    });
    let answer = await rtc.createAnswer(data["offer"]);
    if(answer == false){
      return;
    }
    current_conn = rtc;
    ws.send(JSON.stringify({
      "type": "answer",
      "answer": answer
    }));

  }
  else if(data["type"] == "answer"){
    current_conn.accept(data["answer"]);
  }
}
