//=======°°°°°°°°°°′°°°°=========//


/**1*/ global.M= {
  key: {
    remoteJid: '0@s.whatsapp.net',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    extendedTextMessage: {
      text: "🇳🇬:𝗚𝗜𝗙𝗧_𝗠𝗗_.𝗠𝗘𝗡𝗨"
    }}};

/**2*/ global.A= {
  key: {
    remoteJid: '0@s.whatsapp.net',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    extendedTextMessage: {
      text: "🇳🇬:𝗚𝗜𝗙𝗧_𝗠𝗗_.𝗠𝗘𝗡𝗨"
    }
  }
};


/**global.StUp= {
  key: {
    remoteJid: '0@s.whatsapp.net',
    fromMe: false,
    participant: '0@s.whatsapp.net'
  },
  message: {
    extendedTextMessage: {
      text: "🇳🇬:𝗚𝗜𝗙𝗧_𝗠𝗗_𝗕𝗢𝗢𝗧 𝗠𝗘𝗦𝗦𝗔𝗚𝗘:🇳🇬"
    }
  }
};*/


function createFakeContact(message) {
    return {
        key: {
            participants: "0@s.whatsapp.net",
            remoteJid: "0@s.whatsapp.net",
            fromMe: false
        },
        message: {
            contactMessage: {
              displayName: "🇳🇬:𝗚𝗜𝗙𝗧_𝗠𝗗_𝗕𝗢𝗢𝗧 𝗠𝗘𝗦𝗦𝗔𝗚𝗘:🇳🇬",
                vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:JUNE MD\nitem1.TEL;waid=${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}:${message.key.participant?.split('@')[0] || message.key.remoteJid.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`

            }

        },

        participant: "0@s.whatsapp.net"

    };

}

global.StUp= createFakeContact({
    key: { 
        participant: global.sock.user.id,
        remoteJid: global.sock.user.id}})
