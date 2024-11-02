const db = require('../../config/db');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class DoctorPatientHandlerEnglish {
    constructor(bot) {
        this.bot = bot;
        this.waitingForKey = new Set();
        this.waitingForName = new Set();
        this.waitingForMessage = new Set();
        this.waitingForFile = new Set();
    }

    async handleDoctorConnectionEnglish(chatId) {
        const userResult = await db.query('SELECT doctor_key, key_valid, name FROM users WHERE chat_id = $1', [chatId]);
        const user = userResult.rows[0];

        if (user && user.key_valid) {
            await this.showDoctorMenuEnglish(chatId);
        } else {
            await this.requestDoctorKeyEnglish(chatId);
        }
    }

    async showDoctorMenuEnglish(chatId) {
        await this.bot.sendMessage(chatId, "Choose an action:", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Message history', callback_data: 'view_messages'}],
                    [{text: 'Send a message', callback_data: 'choose_message_type'}],
                    [{text: 'Change doctor', callback_data: 'change_doctor'}],
                    [{text: 'Back to profile', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }

    async showMessageTypeChoiceEnglish(chatId) {
        await this.bot.sendMessage(chatId, "Select message type:", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Send text message', callback_data: 'send_text_message'}],
                    [{text: 'Send file', callback_data: 'send_file'}],
                    [{text: 'Back', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }

    async requestDoctorKeyEnglish(chatId) {
        this.waitingForKey.add(chatId);
        await this.bot.sendMessage(chatId, "Please enter the doctor key:");
    }

    async showInvalidKeyMenuEnglish(chatId) {
        this.waitingForKey.delete(chatId);
        await this.bot.sendMessage(chatId, "Invalid key.", {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Enter key', callback_data: 'retry_key'}],
                    [{text: 'Back to profile', callback_data: 'back_to_profile'}]
                ]
            }
        });
    }

    async handleKeyInputEnglish(chatId, messageText) {
        if (!this.waitingForKey.has(chatId)) return;

        const doctorResult = await db.query('SELECT * FROM doctors WHERE doctor_key = $1', [messageText]);

        if (doctorResult.rows.length > 0) {
            this.waitingForKey.delete(chatId);
            this.waitingForName.add(chatId);
            await db.query('UPDATE users SET doctor_key = $1, key_valid = TRUE WHERE chat_id = $2', [messageText, chatId]);
            await this.bot.sendMessage(chatId, "Key is valid! Please enter your name:");
        } else {
            await this.showInvalidKeyMenuEnglish(chatId);
        }
    }

    async handleNameInputEnglish(chatId, messageText) {
        if (!this.waitingForName.has(chatId)) return;

        this.waitingForName.delete(chatId);
        await db.query('UPDATE users SET name = $1 WHERE chat_id = $2', [messageText, chatId]);
        await this.showDoctorMenuEnglish(chatId);
    }

    async handleViewMessagesEnglish(chatId) {
        const messages = await db.query(`
            SELECT m.*, u.name 
            FROM messages m 
            JOIN users u ON m.user_id = u.chat_id 
            WHERE user_id = $1 
            ORDER BY message_date DESC
        `, [chatId]);

        let messageText = "";
        if (messages.rows.length > 0) {
            messageText = "Conversation history:\n\n";
            for (const msg of messages.rows) {
                messageText += `${msg.name} (${new Date(msg.message_date).toLocaleString()}):\n`;
                if (msg.message_text) {
                    messageText += `${msg.message_text}\n`;
                }
                if (msg.isFile) {
                    messageText += `[File: ${msg.fileName}]\n`;
                }
                messageText += '\n';
            }
        } else {
            messageText = "You have no messages.";
        }

        await this.bot.sendMessage(chatId, messageText, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Back', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }

    async handleSendTextMessageEnglish(chatId) {
        this.waitingForMessage.add(chatId);
        const message = await this.bot.sendMessage(chatId,
            "Write your message:", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Cancel', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        this.messageToEdit = message.message_id;
    }

    async handleSendFileEnglish(chatId) {
        this.waitingForFile.add(chatId);
        const message = await this.bot.sendMessage(chatId,
            "Send a file (document, photo, video, etc.):", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Cancel', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        this.messageToEdit = message.message_id;
    }

    async saveFile(fileId, originalName) {
        const file = await this.bot.getFile(fileId);
        const filePath = file.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${filePath}`;

        const timestamp = Date.now();
        const fileExtension = path.extname(originalName);
        const fileName = `${timestamp}${fileExtension}`;
        const localFilePath = path.join('public', fileName);

        const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(localFilePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve({ fileName, filePath: localFilePath }));
            writer.on('error', reject);
        });
    }

    async handleFileMessageEnglish(chatId, msg) {
        if (!this.waitingForFile.has(chatId)) return;

        if (this.messageToEdit) {
            try {
                await this.bot.editMessageReplyMarkup(
                    { inline_keyboard: [] },
                    {
                        chat_id: chatId,
                        message_id: this.messageToEdit
                    }
                );
            } catch (error) {
                console.error('Error removing keyboard:', error);
            }
        }

        let fileId, originalName;

        if (msg.document) {
            fileId = msg.document.file_id;
            originalName = msg.document.file_name;
        } else if (msg.photo) {
            fileId = msg.photo[msg.photo.length - 1].file_id;
            originalName = 'photo.jpg';
        } else if (msg.video) {
            fileId = msg.video.file_id;
            originalName = msg.video.file_name || 'video.mp4';
        } else {
            await this.bot.sendMessage(chatId, "File format not supported.");
            return;
        }

        try {
            const userResult = await db.query('SELECT doctor_key, name FROM users WHERE chat_id = $1', [chatId]);
            const { doctor_key, name } = userResult.rows[0];

            const { fileName, filePath } = await this.saveFile(fileId, originalName);

            await db.query(
                'INSERT INTO messages (user_id, doctor_key, message_date, isFile, fileName, filePath, isRead) VALUES ($1, $2, NOW(), TRUE, $3, $4, FALSE)',
                [chatId, doctor_key, fileName, filePath]
            );

            const doctorResult = await db.query('SELECT chat_id FROM doctors WHERE doctor_key = $1', [doctor_key]);
            const doctorChatId = doctorResult.rows[0]?.chat_id;

            if (doctorChatId) {
                if (msg.document) {
                    await this.bot.sendDocument(doctorChatId, fileId, { caption: `File from ${name}` });
                } else if (msg.photo) {
                    await this.bot.sendPhoto(doctorChatId, fileId, { caption: `Photo from ${name}` });
                } else if (msg.video) {
                    await this.bot.sendVideo(doctorChatId, fileId, { caption: `Video from ${name}` });
                }
            }

            this.waitingForFile.delete(chatId);
            this.messageToEdit = null;
            await this.bot.sendMessage(chatId, "File successfully sent", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Send another', callback_data: 'choose_message_type'}],
                        [{text: 'Back', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        } catch (error) {
            console.error('Error handling file:', error);
            await this.bot.sendMessage(chatId, "An error occurred while sending the file. Please try again.");
        }
    }

    async handleTextMessageEnglish(chatId, messageText) {
        if (!this.waitingForMessage.has(chatId)) return;

        try {
            if (this.messageToEdit) {
                try {
                    await this.bot.editMessageReplyMarkup(
                        { inline_keyboard: [] },
                        {
                            chat_id: chatId,
                            message_id: this.messageToEdit
                        }
                    );
                } catch (error) {
                    console.error('Error removing keyboard:', error);
                }
            }

            const userResult = await db.query('SELECT doctor_key, name FROM users WHERE chat_id = $1', [chatId]);
            const { doctor_key, name } = userResult.rows[0];

            await db.query(
                'INSERT INTO messages (user_id, doctor_key, message_text, message_date, isFile, isRead) VALUES ($1, $2, $3, NOW(), FALSE, FALSE)',
                [chatId, doctor_key, messageText]
            );

            const doctorResult = await db.query('SELECT chat_id FROM doctors WHERE doctor_key = $1', [doctor_key]);
            const doctorChatId = doctorResult.rows[0]?.chat_id;

            if (doctorChatId) {
                await this.bot.sendMessage(doctorChatId, `Message from ${name}:\n${messageText}`);
            }

            this.waitingForMessage.delete(chatId);
            this.messageToEdit = null;
            await this.bot.sendMessage(chatId, "Message sent", {
                reply_markup: {
                    inline_keyboard: [
                        [{text: 'Send another', callback_data: 'choose_message_type'}],
                        [{text: 'Back', callback_data: 'doctor_connection'}]
                    ]
                }
            });
        } catch (error) {
            console.error('Error sending message:', error);
            await this.bot.sendMessage(chatId, "An error occurred while sending the message. Please try again.");
        }
    }

    async handleChangeDoctorEnglish(chatId) {
        await db.query('UPDATE users SET doctor_key = NULL, key_valid = FALSE WHERE chat_id = $1', [chatId]);
        await this.requestDoctorKeyEnglish(chatId);
    }

    async handleMessageEnglish(msg) {
        const chatId = msg.chat.id;
        const messageText = msg.text;

        if (this.isWaitingForInputEnglish(chatId)) {
            if (messageText === '/start' || messageText === '/myProfile') {
                return;
            }
        }

        if (this.waitingForKey.has(chatId)) {
            await this.handleKeyInputEnglish(chatId, messageText);
        } else if (this.waitingForName.has(chatId)) {
            await this.handleNameInputEnglish(chatId, messageText);
        } else if (this.waitingForMessage.has(chatId)) {
            await this.handleTextMessageEnglish(chatId, messageText);
        } else if (this.waitingForFile.has(chatId)) {
            await this.handleFileMessageEnglish(chatId, msg);
        }
    }

    isWaitingForInputEnglish(chatId) {
        return this.waitingForKey.has(chatId) ||
            this.waitingForName.has(chatId) ||
            this.waitingForMessage.has(chatId) ||
            this.waitingForFile.has(chatId);
    }

    async handleCallbackEnglish(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;

        if (data !== 'back_to_profile') {
            try {
                await this.bot.editMessageReplyMarkup(
                    {inline_keyboard: []},
                    {
                        chat_id: chatId,
                        message_id: callbackQuery.message.message_id
                    }
                );
            } catch (error) {
                if (!error.message.includes('message is not modified')) {
                    console.error('Error removing keyboard:', error);
                }
            }
        }

        switch (data) {
            case 'doctor_connection':
                await this.handleDoctorConnectionEnglish(chatId);
                break;
            case 'view_messages':
                await this.handleViewMessagesEnglish(chatId);
                break;
            case 'choose_message_type':
                await this.showMessageTypeChoiceEnglish(chatId);
                break;
            case 'send_text_message':
                await this.handleSendTextMessageEnglish(chatId);
                break;
            case 'send_file':
                await this.handleSendFileEnglish(chatId);
                break;
            case 'change_doctor':
                await this.handleChangeDoctorEnglish(chatId);
                break;
            case 'retry_key':
                await this.requestDoctorKeyEnglish(chatId);
                break;
        }

        try {
            await this.bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('Error answering callback query:', error);
        }
    }

    async checkAndCreatePublicFolder() {
        const publicPath = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicPath)) {
            try {
                fs.mkdirSync(publicPath, { recursive: true });
                console.log('Created public folder for file storage');
            } catch (error) {
                console.error('Error creating public folder:', error);
                throw new Error('Failed to create public folder for file storage');
            }
        }
    }

    async initEnglish() {
        try {
            await this.checkAndCreatePublicFolder();
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
    }

    clearWaitingStates(chatId) {
        this.waitingForKey.delete(chatId);
        this.waitingForName.delete(chatId);
        this.waitingForMessage.delete(chatId);
        this.waitingForFile.delete(chatId);
    }

    async handleError(chatId, error, errorMessage = "An error occurred. Please try again.") {
        console.error('Error:', error);
        this.clearWaitingStates(chatId);
        await this.bot.sendMessage(chatId, errorMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Back', callback_data: 'doctor_connection'}]
                ]
            }
        });
    }
}

module.exports = DoctorPatientHandlerEnglish;
