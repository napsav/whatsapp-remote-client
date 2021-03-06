var express = require('express');
var router = express.Router();
const fs = require('fs');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { time } = require('console');
require('dotenv').config()
const SESSION_FILE_PATH = process.env.SESSIONFILE;
let loading = true;
let mediaObj = {}
let audioObj = {}
let chatCache = {}

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
  console.log('Getting chats...');
  client.getChats().then(chat => {
    chatCache = chat;
    loading = false;
    console.log('Chats loaded!');
  })
});

client.initialize();

client.on('message', message => {
  console.log(message);
  let from = message.from
  chatCache.forEach((element, index) => {
    if (element.id._serialized === from) {
      if (index != 1) {
        chatCache.splice(index, 1)
        chatCache.unshift(element)
        element.unreadCount += 1
      }
    }
  });
});

//

router.get('/', function (req, res, next) {
  if (loading) {
    res.send("In caricamento")
  } else {
    let pagine = null;
    //chats.sort(function (a, b) { return b.timestamp - a.timestamp });
    pagine = chatCache.chunk(15)
    //console.log(pagine[0]); fs.writeFileSync('/home/saverio/progetti/whatsapp-remote-client/chat.json', JSON.stringify(chats))
    if (Object.keys(req.query).length > 0) {
      console.log(req.query)
      res.render('index', { title: 'Home', chats: pagine[req.query.p], availablePages: pagine.length });
    } else {
      res.render('index', { title: 'Home', chats: pagine[0], availablePages: pagine.length });
    }
  }
});


router.get('/chat/:idChat', function (req, res, next) {
  if (loading) {
    res.send("In caricamento")
  } else {
    client.getChatById(req.params.idChat).then(chat => {
      chat.fetchMessages().then(async messages => {
        for (const mess of messages) {
          if (mess.hasMedia) {
            if (mess.type === 'image') {
              if (mediaObj[mess.mediaKey] === undefined) {
                mess.downloadMedia().then(media => {
                  mediaObj[mess.mediaKey] = { data: media.data, mime: media.mimetype };
                });
              }
            } else if (mess.type === 'ptt') {
              if (audioObj[mess.mediaKey] === undefined) {
                mess.downloadMedia().then(media => {
                  audioObj[mess.mediaKey] = { data: media.data, mime: media.mimetype };
                });
              }
            }
          }
          if (!mess.fromMe && chat.isGroup) {
            let contact = await client.getContactById(mess.author)
            mess.authorName = contact.name;
          }
          if (mess.hasQuotedMsg) {
            let quotedMessage = await mess.getQuotedMessage()
            if (!quotedMessage.hasMedia && quotedMessage.type === 'chat') {
              mess.quotedBody = quotedMessage.body
            } else {
              mess.quotedBody = 'Non supportato'
            }
            console.log(quotedMessage)
             if (chat.isGroup) {
              //let author = await client.getContactById(quotedMessage.author)
              //console.log(author)
              //if (author.name === undefined) {
              //  mess.quotedAuthor = quotedMessage.author
              //} else {
                //mess.quotedAuthor = author.name
              //}
            } 
          }
        }
        res.render('chat', { chat: chat, messages: messages, mediaObj: mediaObj })
        chatCache[req.params.idChat].unreadCount = 0;
      }).catch(err => console.log(err))
    })
  }
})

router.post('/chat/:idChat/send', function (req, res, next) {
  let message = req.body.testo.trim()
  if (message === "") {
    res.redirect(`/chat/${req.params.idChat}`)
  } else {
    client.sendMessage(req.params.idChat, message)
    res.redirect(`/chat/${req.params.idChat}`)
  }
})

router.get('/media/:mediaKey', function (req, res, next) {
  let image = mediaObj[decodeURIComponent(req.params.mediaKey)]
  res.send(`<img src="data:${image.mimetype};base64, ${image.data}">`)
})

router.get('/audio/:mediaKey', function (req, res, next) {
  let audio = audioObj[decodeURIComponent(req.params.mediaKey)]
  res.send(`<audio controls="" src="data:audio/ogg; codecs=opus;base64, ${audio.data}">`)
})

module.exports = router;
