const db = require('../config/db');

const replyData = new Map();
const waitingForReply = new Set();

async function initializeDoctorOfficeEnglish(bot, chatId, messageId, doctorKey) {
    try {
        await bot.editMessageText(`Recorded, your role: Doctor. All patient data has been deleted.`, {
            chat_id: chatId,
            message_id: messageId,
        });

        await showDoctorMainMenuEnglish(bot, chatId, doctorKey);
    } catch (err) {
        console.error('Error initializing doctor\'s office:', err);
        throw err;
    }
}

async function showDoctorMainMenuEnglish(bot, chatId, doctorKey) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Patient List', callback_data: 'patient_list_page_1' }]
            ],
        },
    };

    if (doctorKey) {
        await bot.sendMessage(chatId, `Your unique key: ${doctorKey}. Share it with patients to connect.\nUse the /menu command to bring up the menu.`);
    }
    await bot.sendMessage(chatId, 'Welcome to the doctor\'s office!', options);
}

async function handlePatientListPageEnglish(bot, chatId, messageId, data) {
    try {
        const page = parseInt(data.split('_').pop(), 10);

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (!doctorKey) {
            await bot.editMessageText("Error: doctor key not found.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const result = await db.query('SELECT u.chat_id, u.name, COUNT(m.message_id) as unread_count FROM users u LEFT JOIN messages m ON u.chat_id = m.user_id AND m.isRead = false AND m.doctor_key = $1 WHERE u.doctor_key = $1 GROUP BY u.chat_id, u.name', [doctorKey]);
        const patients = result.rows;

        let patientButtons = [];

        if (patients.length > 0) {
            for (let i = 0; i < patients.length; i++) {
                const unreadIcon = patients[i].unread_count > 0 ? '🔴 ' : '';
                patientButtons.push({
                    text: `${unreadIcon}${patients[i].name}`,
                    callback_data: `patient_${i + 1}`
                });
            }

            for (let i = patients.length; i < 9; i++) {
                patientButtons.push({ text: ' ', callback_data: 'no_action' });
            }
        } else {
            for (let i = 0; i < 9; i++) {
                patientButtons.push({ text: ' ', callback_data: 'no_action' });
            }
        }

        const patientRows = [];
        for (let i = 0; i < patientButtons.length; i += 3) {
            patientRows.push(patientButtons.slice(i, i + 3));
        }

        const navigationButtons = [
            { text: '⬅️ Left', callback_data: page > 1 ? `patient_list_page_${page - 1}` : 'no_action' },
            { text: 'Return to Menu', callback_data: 'doctor_menu' },
            { text: 'Right ➡️', callback_data: `patient_list_page_${page + 1}` },
        ];
        patientRows.push(navigationButtons);

        await bot.editMessageText(`Here's your patient list:`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: patientRows,
            },
        });
    } catch (err) {
        console.error('Error handling patient list:', err);
        throw err;
    }
}

async function handlePatientSelectionEnglish(bot, chatId, messageId, data) {
    try {
        const patientIndex = data.split('_')[1];
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query('SELECT name FROM users WHERE doctor_key = $1 LIMIT 1 OFFSET $2', [doctorKey, patientIndex - 1]);
        const patientName = patientResult.rows[0]?.name;

        await bot.editMessageText(`Patient: ${patientName}`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Go Back', callback_data: `patient_list_page_1` }],
                    [{ text: 'Unread Messages', callback_data: `unread_messages_patient_${patientIndex}` }],
                    [{ text: 'Message History', callback_data: `send_history_${patientIndex}` }],
                ],
            },
        });
    } catch (err) {
        console.error('Error selecting patient:', err);
        throw err;
    }
}

async function handleMessageHistoryRequestEnglish(bot, chatId, messageId, data) {
    try {
        const patientIndex = data.split('_')[2];
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query(
            'SELECT chat_id, name FROM users WHERE doctor_key = $1 LIMIT 1 OFFSET $2',
            [doctorKey, patientIndex - 1]
        );

        if (patientResult.rows.length === 0) {
            await bot.editMessageText("Patient not found.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const patient = patientResult.rows[0];

        const patientMessages = await db.query(`
            SELECT * FROM messages 
            WHERE doctor_key = $1 
            AND user_id = $2 
            AND sender_type = 'patient'
            ORDER BY message_date DESC
        `, [doctorKey, patient.chat_id]);

        const doctorMessages = await db.query(`
            SELECT * FROM doctors_messages 
            WHERE doctor_key = $1 
            AND patient_id = $2
            ORDER BY message_date DESC
        `, [doctorKey, patient.chat_id]);

        const allMessages = [...patientMessages.rows, ...doctorMessages.rows]
            .sort((a, b) => new Date(b.message_date) - new Date(a.message_date));

        let messageText = `Message history with patient ${patient.name}:\n\n`;

        for (const msg of allMessages) {
            const isPatientMessage = 'sender_type' in msg && msg.sender_type === 'patient';
            const sender = isPatientMessage ? patient.name : "Doctor";
            messageText += `${sender} (${new Date(msg.message_date).toLocaleString()}):\n`;
            if (msg.isFile) {
                messageText += `[File: ${msg.fileName}]\n`;
            } else {
                messageText += `${msg.message_text}\n`;
            }
            messageText += '-------------------\n';
        }

        await bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [ [{ text: 'Back to Patient', callback_data: `patient_${patientIndex}` }] ]
            }
        });
    } catch (err) {
        console.error('Error requesting message history:', err);
        throw err;
    }
}

async function handleUnreadMessagesForPatientEnglish(bot, chatId, messageId, data) {
    try {
        const patientIndex = data.split('_')[3];
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query(
            'SELECT chat_id, name FROM users WHERE doctor_key = $1 LIMIT 1 OFFSET $2',
            [doctorKey, patientIndex - 1]
        );

        if (patientResult.rows.length === 0) {
            await bot.sendMessage(chatId, "Patient not found.");
            return;
        }

        const patient = patientResult.rows[0];

        const unreadMessages = await db.query(`
            SELECT * FROM messages 
            WHERE user_id = $1 
            AND doctor_key = $2 
            AND isRead = false 
            AND sender_type = 'patient'
            ORDER BY message_date DESC
        `, [patient.chat_id, doctorKey]);

        await bot.deleteMessage(chatId, messageId);

        if (unreadMessages.rows.length === 0) {
            await bot.sendMessage(chatId, `Patient ${patient.name} has no unread messages`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Back to Patient', callback_data: `patient_${patientIndex}` }
                    ]]
                }
            });
            return;
        }

        for (const msg of unreadMessages.rows) {
            let messageText = `From: ${patient.name}\n`;
            messageText += `Date: ${new Date(msg.message_date).toLocaleString()}\n`;
            messageText += msg.isFile ? `File: ${msg.fileName}\n` : `Message: ${msg.message_text}`;

            const callbackData = `reply_to_${msg.message_id}_${patientIndex}_${patient.chat_id}`;
            await bot.sendMessage(chatId, messageText, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Reply', callback_data: callbackData }
                    ]]
                }
            });
        }

        await bot.sendMessage(chatId, 'All unread messages', {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Back to Patient', callback_data: `patient_${patientIndex}` }
                ]]
            }
        });
    } catch (err) {
        console.error('Error getting unread messages for patient:', err);
        throw err;
    }
}

async function handleReplyToMessageEnglish(bot, chatId, messageId, data) {
    try {
        const parts = data.split('_');
        const originalMessageId = parts[2];
        const patientIndex = parts[3];
        const patientChatId = parts[4];

        replyData.set(chatId, {
            originalMessageId,
            patientIndex,
            userId: patientChatId
        });

        waitingForReply.add(chatId);

        await bot.deleteMessage(chatId, messageId);

        await bot.sendMessage(chatId, 'Please respond:', {
            reply_markup: {
                force_reply: true,
                selective: true
            }
        });
    } catch (err) {
        console.error('Error preparing to respond:', err);
        await bot.sendMessage(chatId, 'An error occurred while preparing to respond. Please try again.');
    }
}

async function handleMarkAsReadEnglish(bot, chatId, messageId, data) {
    try {
        const messageIdToMark = data.split('_')[2];

        await db.query('UPDATE messages SET isRead = TRUE WHERE message_id = $1', [messageIdToMark]);

        await handleUnreadMessagesForPatientEnglish(bot, chatId, messageId, data);
    } catch (err) {
        console.error('Error marking message as read:', err);
        throw err;
    }
}

async function handleDoctorMenuReturnEnglish(bot, chatId, messageId) {
    try {
        // Delete message with buttons
        await bot.deleteMessage(chatId, messageId);

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        // Send new message with main menu
        await showDoctorMainMenuEnglish(bot, chatId, null);
    } catch (err) {
        console.error('Error returning to doctor menu:', err);
        throw err;
    }
}

async function handleDoctorCallbackEnglish(bot, callbackQuery ) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        if (data.startsWith('patient_list_page_')) {
            await handlePatientListPageEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('patient_')) {
            await handlePatientSelectionEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('send_history_')) {
            await handleMessageHistoryRequestEnglish(bot, chatId, messageId, data);
        }
        else if (data === 'doctor_menu') {
            await handleDoctorMenuReturnEnglish(bot, chatId, messageId);
        }
        else if (data.startsWith('unread_messages_patient_')) {
            await handleUnreadMessagesForPatientEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('reply_to_')) {
            await handleReplyToMessageEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('mark_read_')) {
            await handleMarkAsReadEnglish(bot, chatId, messageId, data);
        }
    } catch (err) {
        console.error('Error handling doctor callback:', err);
        throw err;
    }
}

async function handleDoctorMessageEnglish(bot, msg) {
    const chatId = msg.chat.id;
    const messageText = msg.text;

    if (waitingForReply.has(chatId)) {
        try {
            const replyInfo = replyData.get(chatId);
            if (!replyInfo) {
                throw new Error('Reply information not found');
            }

            const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
            const doctorKey = doctorResult.rows[0]?.doctor_key;

            if (!doctorKey) {
                throw new Error('Doctor key not found');
            }

            const patientResult = await db.query(
                'SELECT chat_id FROM users WHERE chat_id = $1 AND doctor_key = $2',
                [replyInfo.userId, doctorKey]
            );

            if (patientResult.rows.length === 0) {
                throw new Error('Patient not found');
            }

            await bot.sendMessage(replyInfo.userId, `Response from doctor:\n${messageText}`);

            await db.query(
                'INSERT INTO doctors_messages (doctor_id, patient_id, message_text, message_date, doctor_key) VALUES ($1, $2, $3, NOW(), $4)',
                [chatId, replyInfo.userId, messageText, doctorKey]
            );

            if (replyInfo.originalMessageId) {
                await db.query(
                    'UPDATE messages SET isRead = TRUE WHERE message_id = $1 AND user_id = $2 AND doctor_key = $3',
                    [replyInfo.originalMessageId, replyInfo.userId, doctorKey]
                );
            }

            waitingForReply.delete(chatId);
            replyData.delete(chatId);

            await bot.sendMessage(chatId, 'Response sent successfully.');

            await bot.sendMessage(chatId, 'Return to patient', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Back to Patient', callback_data: `patient_${replyInfo.patientIndex}` }
                    ]]
                }
            });
        } catch (err) {
            console.error('Error sending response:', err);
            await bot.sendMessage(chatId, 'An error occurred while sending the response. Please try again.');
        }
    }
}

async function handleMenuCommandEnglish(bot, msg) {
    const chatId = msg.chat.id;
    try {
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (doctorKey) {
            await showDoctorMainMenuEnglish(bot, chatId, null);
        } else {
            await bot.sendMessage(chatId, 'You do not have access to the doctor menu.');
        }
    } catch (err) {
        console.error('Error handling menu command:', err);
        await bot.sendMessage(chatId, 'An error occurred while handling the menu command.');
    }
}

module.exports = {
    initializeDoctorOfficeEnglish,
    showDoctorMainMenuEnglish,
    handlePatientListPageEnglish,
    handlePatientSelectionEnglish,
    handleMessageHistoryRequestEnglish,
    handleDoctorMenuReturnEnglish,
    handleDoctorCallbackEnglish,
    handleUnreadMessagesForPatientEnglish,
    handleReplyToMessageEnglish,
    handleDoctorMessageEnglish,
    handleMenuCommandEnglish
};