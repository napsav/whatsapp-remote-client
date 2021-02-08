var express = require('express');
var router = express.Router();
const fs = require('fs');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const SESSION_FILE_PATH = '/home/saverio/progetti/whatsapp-remote-client/session.json';
let loading = true;

// Load the session data if it has been previously saved
let sessionData;
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

// Use the saved values
const client = new Client({
  session: sessionData
});

Object.defineProperty(Array.prototype, 'chunk', {
  value: function (chunkSize) {
    var R = [];
    for (var i = 0; i < this.length; i += chunkSize)
      R.push(this.slice(i, i + chunkSize));
    return R;
  }
});

// Save session values to the file upon successful auth
client.on('authenticated', (session) => {
  sessionData = session;
  fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
    if (err) {
      console.error(err);
    }
  });
});

client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
  loading = false;
});

client.initialize();

client.on('message', message => {
  console.log(message);
});

//

router.get('/', function (req, res, next) {
  if(loading) {
    res.send("In caricamento")
  } else {
    let pagine = null;
    client.getChats().then(chat => {
      //chats.sort(function (a, b) { return b.timestamp - a.timestamp });
      pagine = chat.chunk(15)
      //console.log(pagine[0]); fs.writeFileSync('/home/saverio/progetti/whatsapp-remote-client/chat.json', JSON.stringify(chats))
      res.render('index', { title: 'Home', chats: pagine[0]});
    })
  }
  
});

module.exports = router;
