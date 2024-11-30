const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                iniciarBot();
            }
        } else if (connection === 'open') {
            console.log('Conexión establecida');
        }
    });

    sock.ev.on('messages.upsert', async (msg) => {
        const mensaje = msg.messages[0];
        if (!mensaje.key.fromMe && mensaje.message?.conversation?.startsWith('/tiktok')) {
            const urlTikTok = mensaje.message.conversation.split(' ')[1];
            if (urlTikTok) {
                try {
                    const response = await axios.get(`https://deliriussapi-oficial.vercel.app/download/tiktok?url=${urlTikTok}`);
                    const videoUrl = response.data.data.meta.media[0].org;
                    const videoPath = path.resolve(__dirname, 'video.mp4');

                    const videoResponse = await axios({
                        url: videoUrl,
                        method: 'GET',
                        responseType: 'stream'
                    });

                    const writer = fs.createWriteStream(videoPath);
                    videoResponse.data.pipe(writer);

                    writer.on('finish', async () => {
                        const videoBuffer = fs.readFileSync(videoPath);
                        await sock.sendMessage(mensaje.key.remoteJid, { video: videoBuffer, caption: 'Aquí está tu video de TikTok' });
                        fs.unlinkSync(videoPath); // Eliminar el archivo después de enviarlo
                    });

                    writer.on('error', (err) => {
                        console.error('Error al escribir el video:', err);
                    });
                } catch (error) {
                    console.error('Error al procesar el comando /tiktok:', error);
                    await sock.sendMessage(mensaje.key.remoteJid, { text: 'Hubo un error al intentar descargar el video de TikTok.' });
                }
            } else {
                await sock.sendMessage(mensaje.key.remoteJid, { text: 'Por favor, proporciona una URL de TikTok después del comando /tiktok.' });
            }
        }
    });
}

iniciarBot();
