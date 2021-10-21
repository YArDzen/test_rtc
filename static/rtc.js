export class RTC extends EventTarget{
  constructor(){
    super();
    this.rtc = new RTCPeerConnection(); // Створюэмо обект RTCPeerConnection
    function connection_state_change(e){
      if(e.target.connectionState == "disconnected"){
        this.dispatchEvent(new CustomEvent("close-channel"));
      }
    }
    this.rtc.onconnectionstatechange = connection_state_change;
    this.ice_candidates = [];
  }

  get_codecs(sdp_string){
    let video_index = sdp_string.indexOf("m=video");
    let audio_index = sdp_string.indexOf("m=audio");

    let audio;
    let video;

    if(video_index > audio_index){
        audio = sdp_string.slice(audio_index, video_index);
        video = sdp_string.slice(video_index, );
    }
    else{
        audio = sdp_string.slice(audio_index, );
        video = sdp_string.slice(video_index, audio_index);
    }

    let video_codecs = {};
    let audio_codecs = {};

    video = video.split("\n");
    audio = audio.split("\n");

    let main_video_string = video[0].replace("\r", "");
    let main_audio_string = audio[0].replace("\r", "");

    for(let i = 0; i < video.length; i++){
        if(video[i].startsWith("a=rtpmap") == true){
            let params = video[i].split(" ");
            let codec_name = params[1].split("/")[0];
            let codec_num = params[0].split(":")[1];

            video_codecs[codec_num] = codec_name;
        }
    }

    for(let i = 0; i < audio.length; i++){
        if(audio[i].startsWith("a=rtpmap") == true){
            let params = audio[i].split(" ");
            let codec_name = params[1].split("/")[0];
            let codec_num = params[0].split(":")[1];

            audio_codecs[codec_num] = codec_name;
        }
    }
    return {
        "video": video_codecs,
        "audio": audio_codecs,
        "video_settings": main_video_string,
        "audio_settings": main_audio_string,
    }
  }

  choose_codec(codec_data, settings_data, sdp_string){
    let video_settings = settings_data["video_settings"];
    let audio_settings = settings_data["audio_settings"];

    if(codec_data["video"] != undefined){
      for(let key in settings_data["video"]){
        if(settings_data["video"][key] == codec_data["video"]){
          let video_settings_arr = video_settings.split(" ");

          let start = video_settings_arr.slice(0, 3);
          let fin = video_settings_arr.slice(3, );

          let obj = fin.splice(fin.indexOf(key), 1);
          fin = obj.concat(fin);

          video_settings = start.concat(fin).join(" ");
          break;
        }
      }
    }

    if(codec_data["audio"] != undefined){
      for(let key in settings_data["audio"]){
        if(settings_data["audio"][key] == codec_data["audio"]){
          let audio_settings_arr = settings_data["audio_settings"].split(" ");

          let start = audio_settings_arr.slice(0, 3);
          let fin = audio_settings_arr.slic3(3, );

          let obj = fin.splice(fin.indexOf(key), 1);
          fin = obj.concat(fin);

          audio_settings = start.concat(fin).join(" ");
          break;
        }
      }
    }

    let new_string = sdp_string.replace(settings_data["audio_settings"], audio_settings);
    new_string = new_string.replace(settings_data["video_settings"], video_settings);

    return new_string;
  }

  async accept(answer){
    let accept_resolve = undefined;
    let remote_sdp = undefined;
    let complete_ice_candidates = [];

    let promise = new Promise((resolve, reject) => {
      accept_resolve = resolve;
    });

    try{
      remote_sdp = new RTCSessionDescription(answer["sdp"]);
    }catch{return false; return promise;}

    try{
      if(Array.isArray(answer["ice-candidates"]) == false){
        return false; return promise;
      }
      for(let i = 0; i < answer["ice-candidates"].length; i++){
        complete_ice_candidates.push(new RTCIceCandidate(answer["ice-candidates"][i]));
      }

    }catch{return false; return promise;}

    this.rtc.setRemoteDescription(remote_sdp);
    for(let i = 0; i < complete_ice_candidates.length; i++){
      this.rtc.addIceCandidate(complete_ice_candidates[i]);
    }

    return true;
  }

  createOffer(channel_id){
    const self = this;

    let offer_resolve = undefined;
    let ice_candidates = [];

    const promise = new Promise((resolve, reject) => {
      offer_resolve = resolve;
    });

    this.channel = this.rtc.createDataChannel(channel_id);
    this.channel.onopen = function(){
      self.dispatchEvent(new CustomEvent("open-channel"));
    }
    this.channel.onmessage = function(e){
      let data = e.data;
      self.dispatchEvent(new CustomEvent("message", {detail: data}));
    }
    this.channel.onclose = function(){
      self.dispatchEvent(new CustomEvent("close-channel"));
    }

    function onicecandidate(e){
      if(e.candidate){
        this.ice_candidates.push(e.candidate.toJSON());
      }
    }
    function onstatechange(){
      if(this.rtc.iceGatheringState == "complete"){
        offer_resolve({
          "sdp": this.rtc.localDescription.toJSON(),
          "ice-candidates": this.ice_candidates,
        });
      }
    }

    this.rtc.onicecandidate = onicecandidate.bind(this);
    this.rtc.onicegatheringstatechange = onstatechange.bind(this);

    function create_offer(offer){
      let settings_data = this.get_codecs(offer.sdp);
      let new_sdp = this.choose_codec({"video": "H264"}, settings_data, offer.sdp);
      offer.sdp = new_sdp;

      this.rtc.setLocalDescription(offer);
    }
    this.rtc.createOffer().then(create_offer.bind(this));

    return promise;
  }

  createAnswer(offer){
    // offer_data мае структуру { ключ => значення }
    // {
    //  "sdp": {"type": "offer", "sdp": SDP дескриптор який описуе медиа даннi },
    //  "ice-candidates": [Ice кандидати якi вказують на адресу та протокол зэднання]
    //}
    let answer_resolve = undefined;

    const promise = new Promise((resolve, reject) => {
      answer_resolve = resolve;
    });

    function ondatachannel(e){
      this.channel = e.channel;
      const self = this;
      this.channel.onopen = function(){
        self.dispatchEvent(new CustomEvent("open-channel"));
      }
      this.channel.onmessage = function(e){
        let data = e.data;
        self.dispatchEvent(new CustomEvent("message", {detail: data}));
      }
      this.channel.onclose = function () {
        self.dispatchEvent(new CustomEvent("close-channel"));
      };
    }
    function onicecandidate(e){
      if(e.candidate){
        this.ice_candidates.push(e.candidate.toJSON());
      }
    }
    function onstatechange(){
      if(this.rtc.iceGatheringState == "complete"){
        answer_resolve({
          "sdp": this.rtc.localDescription.toJSON(),
          "ice-candidates": this.ice_candidates,
        });
      }
    }

    this.rtc.ondatachannel = ondatachannel.bind(this);
    this.rtc.onicecandidate = onicecandidate.bind(this);
    this.rtc.onicegatheringstatechange = onstatechange.bind(this);

    let remote_sdp = undefined;
    let complete_ice_candidates = [];

    try{
      remote_sdp = new RTCSessionDescription(offer["sdp"]);
    }catch{answer_resolve(false); return promise;}

    try{
      if(Array.isArray(offer["ice-candidates"]) == false){
        answer_resolve(false); return promise;
      }
      for(let i = 0; i < offer["ice-candidates"].length; i++){
        complete_ice_candidates.push(new RTCIceCandidate(offer["ice-candidates"][i]));
      }
    }catch{answer_resolve(false); return promise;}

    this.rtc.setRemoteDescription(remote_sdp);
    async function create_answer(answer){

      let settings_data = this.get_codecs(answer.sdp);
      let new_sdp = this.choose_codec({"video": "H264"}, settings_data, answer.sdp);
      answer.sdp = new_sdp;

      await this.rtc.setLocalDescription(answer);

      for(let i = 0; i < complete_ice_candidates.length; i++){
        this.rtc.addIceCandidate(complete_ice_candidates[i]);
      }
    }
    this.rtc.createAnswer().then(
      create_answer.bind(this)
    ).catch(function(e){answer_resolve(false)});

    return promise;
  }
}
