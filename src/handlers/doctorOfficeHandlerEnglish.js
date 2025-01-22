const db = require('../config/db');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const replyData = new Map();
const waitingForReply = new Set();
const waitingForName = new Set();
const waitingForDescription = new Set();

async function initializeDoctorOfficeEnglish(bot, chatId, messageId, doctorKey) {
    try {
        await bot.editMessageText(`Noted, your role: Doctor. All patient data has been deleted.`, {
            chat_id: chatId,
            message_id: messageId,
        });

        // Add chat to waiting for name list
        waitingForName.add(chatId);

        // Request full name
        await bot.sendMessage(chatId, 'Enter your full name');
    } catch (err) {
        console.error('Error initializing doctor\'s office:', err);
        throw err;
    }
}

async function showDoctorMainMenuEnglish(bot, chatId, doctorKey) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Patient List', callback_data: 'patient_list_page_1' }],
                [{ text: 'Re-registration', callback_data: 'doctor_reregistration' }]
            ],
        },
    };

    if (doctorKey) {
        await bot.sendMessage(chatId, `Your unique key: ${doctorKey}. Share this key with patients to connect.\nTo open menu use /menu command.`);
    }

    const doctor = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);

    if (doctor.rows.length > 0) {
        const dbDoctorKey = doctor.rows[0].doctor_key;
        const message = `Welcome to the Doctor's Office!\n\nYour key:\n<code>${dbDoctorKey}</code>`;
        await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    }

    await bot.sendMessage(chatId, `Main Menu`, options);
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

        const result = await db.query(`
            WITH LastMessages AS (
                SELECT 
                    user_id,
                    MAX(message_date) as last_message_date
                FROM messages 
                WHERE doctor_key = $1 
                GROUP BY user_id
            )
            SELECT 
                u.chat_id, 
                u.name, 
                u.fio,
                COUNT(CASE WHEN m.isRead = false THEN 1 END) as unread_count,
                COALESCE(lm.last_message_date, '1970-01-01'::timestamp) as last_message_date
            FROM users u
            LEFT JOIN messages m ON u.chat_id = m.user_id AND m.doctor_key = $1
            LEFT JOIN LastMessages lm ON u.chat_id = lm.user_id
            WHERE u.doctor_key = $1
            GROUP BY u.chat_id, u.name, u.fio, lm.last_message_date
            ORDER BY last_message_date DESC
        `, [doctorKey]);

        const patients = result.rows;

        let patientButtons = [];

        if (patients.length > 0) {
            for (let i = 0; i < patients.length; i++) {
                const unreadIcon = patients[i].unread_count > 0 ? '🔴 ' : '';
                patientButtons.push({
                    text: `${unreadIcon}${patients[i].name}`,
                    callback_data: `patient_index_${i + 1}_${patients[i].chat_id}`
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

        await bot.editMessageText(`Here is your patient list:`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: patientRows,
            },
        });
    } catch (err) {
        console.error('Error processing patient list:', err);
        throw err;
    }
}

async function handlePatientSelectionEnglish(bot, chatId, messageId, data) {
    try {
        const [, , patientIndex, patientChatId] = data.split('_');
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query('SELECT name FROM users WHERE chat_id = $1 AND doctor_key = $2', [patientChatId, doctorKey]);
        const patientName = patientResult.rows[0]?.name;

        if (!patientName) {
            await bot.editMessageText("Patient not found.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const banResult = await db.query('SELECT id FROM bans WHERE user_id = $1 AND doctor_key = $2', [patientChatId, doctorKey]);
        const isBanned = banResult.rows.length > 0;

        const banButton = isBanned ?
            { text: 'Allow Messaging', callback_data: `unban_patient_index_${patientIndex}_${patientChatId}` } :
            { text: 'Block Messaging', callback_data: `ban_patient_index_${patientIndex}_${patientChatId}` };

        await bot.editMessageText(`Patient: ${patientName}${isBanned ? ' (Blocked)' : ''}`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Patient Information', callback_data: `patient_info_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Unread Messages', callback_data: `unread_messages_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Chat History', callback_data: `send_history_index_${patientIndex}_${patientChatId}` }],
                    [banButton],
                    [{ text: 'Delete Patient', callback_data: `delete_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Go Back', callback_data: `patient_list_page_1` }]
                ],
            },
        });
    } catch (err) {
        console.error('Error when selecting patient:', err);
        throw err;
    }
}

async function handleDeletePatientEnglish(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        await db.query(`
            UPDATE users 
            SET doctor_key = NULL, key_valid = false 
            WHERE chat_id = $1
        `, [patientChatId]);

        await bot.editMessageText('Patient successfully removed from your list.', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Return to Patient List', callback_data: 'patient_list_page_1' }]
                ]
            }
        });

        // Send notification to patient
        await bot.sendMessage(patientChatId, 'You have been disconnected from the doctor. A new key will be required to reconnect.');
    } catch (err) {
        console.error('Error deleting patient:', err);
        throw err;
    }
}

async function handlePatientInfoRequestEnglish(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query(
            'SELECT name, fio, language, gender FROM users WHERE chat_id = $1 AND doctor_key = $2',
            [patientChatId, doctorKey]
        );

        if (patientResult.rows.length === 0) {
            await bot.editMessageText("Patient not found.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const patient = patientResult.rows[0];
        const chatInfo = await bot.getChat(patientChatId);
        const telegramUsername = chatInfo.username ? `@${chatInfo.username}` : 'Not specified';

        const messageText = `Patient ${patient.name}\n\n` +
            `Full Name: ${patient.fio}\n` +
            `Language: ${patient.language}\n` +
            `Gender: ${patient.gender}\n` +
            `Personal Link: ${telegramUsername}`;

        await bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Go Back', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                ],
            },
        });
    } catch (err) {
        console.error('Error getting patient information:', err);
        throw err;
    }
}

async function handleBanPatientEnglish(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        // Add record to bans table
        await db.query(`
            INSERT INTO bans (user_id, doctor_key)
            VALUES ($1, $2)
            ON CONFLICT (user_id, doctor_key) DO NOTHING
        `, [patientChatId, doctorKey]);

        // Get patient info to update display
        const patientResult = await db.query('SELECT chat_id, name FROM users WHERE chat_id = $1', [patientChatId]);
        const patientName = patientResult.rows[0]?.name;

        await bot.sendMessage(patientChatId, 'The doctor has restricted your ability to send messages.');

        // Reload patient menu with updated status
        await bot.editMessageText(`Patient: ${patientName} (Blocked)`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Patient Information', callback_data: `patient_info_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Unread Messages', callback_data: `unread_messages_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Chat History', callback_data: `send_history_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Allow Messaging', callback_data: `unban_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Delete Patient', callback_data: `delete_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Go Back', callback_data: 'patient_list_page_1' }]
                ],
            },
        });
    } catch (err) {
        console.error('Error blocking patient:', err);
        throw err;
    }
}

async function handleUnbanPatientEnglish(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        // Remove record from bans table
        await db.query(`
            DELETE FROM bans 
            WHERE user_id = $1 AND doctor_key = $2
        `, [patientChatId, doctorKey]);

        // Get patient info to update display
        const patientResult = await db.query('SELECT chat_id, name FROM users WHERE chat_id = $1', [patientChatId]);
        const patientName = patientResult.rows[0]?.name;

        await bot.sendMessage(patientChatId, 'The doctor has removed the messaging restriction.');

        // Reload patient menu with updated status
        await bot.editMessageText(`Patient: ${patientName}`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Patient Information', callback_data: `patient_info_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Unread Messages', callback_data: `unread_messages_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Chat History', callback_data: `send_history_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Block Messaging', callback_data: `ban_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Delete Patient', callback_data: `delete_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Go Back', callback_data: 'patient_list_page_1' }]
                ],
            },
        });
    } catch (err) {
        console.error('Error unblocking patient:', err);
        throw err;
    }
}
async function handleMessageHistoryRequestEnglish(bot, chatId, messageId, data) {
    try {
        const parts = data.split('_');
        const patientIndex = parseInt(parts[3]);
        const patientChatId = parts[4];

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (!doctorKey) {
            await bot.editMessageText("Error: Doctor's key not found.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const patientResult = await db.query(
            'SELECT name FROM users WHERE chat_id = $1 AND doctor_key = $2',
            [patientChatId, doctorKey]
        );

        if (patientResult.rows.length === 0) {
            await bot.editMessageText("Patient not found.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const patient = patientResult.rows[0];

        const messages = await db.query(`
            SELECT user_id AS patient_id, doctor_key, message_text, message_date, sender_type
            FROM messages
            WHERE doctor_key = $1 AND user_id = $2

            UNION ALL

            SELECT patient_id, doctor_key, message_text, message_date, NULL AS sender_type
            FROM doctors_messages
            WHERE doctor_key = $1 AND patient_id = $2
            ORDER BY message_date DESC
        `, [doctorKey, patientChatId]);

        if (messages.rows.length > 0) {
            const excelData = [];
            excelData.push(['Sender', 'Message Text', 'Send Date']);

            messages.rows.forEach(msg => {
                const sender = msg.sender_type === 'patient' ? patient.name : 'Doctor';
                const date = new Date(msg.message_date).toLocaleString();

                excelData.push([sender, msg.message_text, date]);
            });

            const ws = XLSX.utils.aoa_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Messages');

            const wscols = [
                { wpx: 100 },
                { wpx: 300 },
                { wpx: 150 }
            ];
            ws['!cols'] = wscols;

            const borderStyle = {
                top: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
            };

            const fillStyle = {
                fill: {
                    fgColor: { rgb: 'D0EFFF' }
                }
            };

            for (let row = 0; row < excelData.length; row++) {
                for (let col = 0; col < excelData[row].length; col++) {
                    const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];

                    if (!cell) continue;

                    if (row === 0) {
                        cell.s = { border: borderStyle, fill: fillStyle, font: { bold: true } };
                    } else {
                        cell.s = { border: borderStyle };
                    }
                }
            }

            const dirPath = path.join(__dirname, '../../public');
            const filePath = path.join(dirPath, `messages_${patientChatId}.xlsx`);

            XLSX.writeFile(wb, filePath);

            await bot.sendMessage(chatId, `Message history with patient ${patient.name}:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to patient', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                    ]
                }
            });

            await bot.sendDocument(chatId, fs.createReadStream(filePath), {}, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to patient', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                    ]
                }
            });

            fs.unlink(filePath, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        } else {
            await bot.editMessageText(`Patient ${patient.name} has no messages.`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Back to patient', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                    ]
                }
            });
        }
    } catch (err) {
        console.error('Error requesting message history:', err);
        throw err;
    }
}

async function handleUnreadMessagesForPatientEnglish(bot, chatId, messageId, data) {
    try {
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (!doctorKey) {
            await bot.sendMessage(chatId, "Error: Doctor's key not found.");
            return;
        }

        const parts = data.split('_');
        const patientIndex = parseInt(parts[4]);
        const patientChatId = parts[5];

        await bot.deleteMessage(chatId, messageId).catch(() => {});

        const unreadMessages = await db.query(`
            SELECT * FROM messages 
            WHERE user_id = $1 
            AND doctor_key = $2 
            AND isRead = false 
            AND sender_type = 'patient'
            ORDER BY message_date DESC
        `, [patientChatId, doctorKey]);

        const patient = await db.query('SELECT name FROM users WHERE chat_id = $1', [patientChatId]);
        const patientName = patient.rows[0]?.name || 'Unknown Patient';

        if (unreadMessages.rows.length === 0) {
            await bot.sendMessage(chatId, `Patient ${patientName} has no unread messages`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Back to patient', callback_data: `patient_index_${patientIndex}_${patientChatId}` }
                    ]]
                }
            });
            return;
        }

        for (const msg of unreadMessages.rows) {
            let messageText = `From: ${patientName}\n`;
            messageText += `Date: ${new Date(msg.message_date).toLocaleString()}\n`;
            messageText += msg.isFile ? `File: ${msg.fileName}\n` : `Message: ${msg.message_text}`;

            const callbackData = `reply_to_${msg.message_id}_${patientIndex}_${patientChatId}`;
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
                    { text: 'Back to patient', callback_data: `patient_index_${patientIndex}_${patientChatId}` }
                ]]
            }
        });
    } catch (err) {
        console.error('Error getting unread messages:', err);
        await bot.sendMessage(chatId, 'An error occurred while retrieving messages.');
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

        await bot.sendMessage(chatId, 'Write your reply:', {
            reply_markup: {
                force_reply: true,
                selective: true
            }
        });
    } catch (err) {
        console.error('Error preparing for reply:', err);
        await bot.sendMessage(chatId, 'An error occurred while preparing to reply. Please try again.');
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

async function handleDoctorMessageEnglish(bot, msg) {
    const chatId = msg.chat.id;
    const messageText = msg.text;

    if (waitingForName.has(chatId)) {
        try {
            await db.query('UPDATE doctors SET name = $1 WHERE chat_id = $2', [messageText, chatId]);
            waitingForName.delete(chatId);

            waitingForDescription.add(chatId);
            await bot.sendMessage(chatId, 'Enter a brief information about yourself');
        } catch (err) {
            console.error('Error saving doctor name:', err);
            await bot.sendMessage(chatId, 'An error occurred while saving your name. Please try again.');
        }
    } else if (waitingForDescription.has(chatId)) {
        try {
            await db.query('UPDATE doctors SET description = $1 WHERE chat_id = $2', [messageText, chatId]);
            waitingForDescription.delete(chatId);

            const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
            const doctorKey = doctorResult.rows[0]?.doctor_key;
            await showDoctorMainMenuEnglish(bot, chatId, doctorKey);
        } catch (err) {
            console.error('Error saving doctor description:', err);
            await bot.sendMessage(chatId, 'An error occurred while saving information. Please try again.');
        }
    } else if (waitingForReply.has(chatId)) {
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

            await bot.sendMessage(replyInfo.userId, `Reply from doctor:\n${messageText}`);

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

            await bot.sendMessage(chatId, 'Reply sent successfully.');

            await bot.sendMessage(chatId, 'Return to patient', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Back to patient', callback_data: `patient_index_${replyInfo.patientIndex}_${replyInfo.userId}` }
                    ]]
                }
            });
        } catch (err) {
            console.error('Error sending reply:', err);
            await bot.sendMessage(chatId, 'An error occurred while sending the reply. Please try again.');
        }
    }
}

async function handleDoctorMenuReturnEnglish(bot, chatId, messageId) {
    try {
        // Delete the message with buttons
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

async function handleDoctorCallbackEnglish(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        if (data.startsWith('patient_list_page_')) {
            await handlePatientListPageEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('patient_index_')) {
            await handlePatientSelectionEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('send_history_index_')) {
            // Обновлен для нового формата
            await handleMessageHistoryRequestEnglish(bot, chatId, messageId, data);
        }
        else if (data === 'doctor_menu') {
            await handleDoctorMenuReturnEnglish(bot, chatId, messageId);
        }
        else if (data.startsWith('unread_messages_patient_index_')) {
            // Обновлен для нового формата
            await handleUnreadMessagesForPatientEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('reply_to_')) {
            await handleReplyToMessageEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('mark_read_')) {
            await handleMarkAsReadEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('delete_patient_index_')) {
            await handleDeletePatientEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('ban_patient_index_')) {
            await handleBanPatientEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('unban_patient_index_')) {
            await handleUnbanPatientEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('patient_info_index_')) {
            await handlePatientInfoRequestEnglish(bot, chatId, messageId, data);
        }
        else if (data.startsWith('doctor_reregistration')) {
            await db.query('DELETE FROM doctors_messages WHERE doctor_id = $1', [chatId]);
            await db.query('DELETE FROM messages WHERE doctor_key = (SELECT doctor_key FROM doctors WHERE chat_id = $1)', [chatId]);
            await db.query('DELETE FROM doctors WHERE chat_id = $1', [chatId]);
            await bot.sendMessage(chatId, 'Your doctor account has been deleted.\nTo go through the registration process again, use /start');
        }
    } catch (err) {
        console.error('Ошибка при обработке callback запроса врача:', err);
        throw err;
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
        console.error('Error processing menu command:', err);
        await bot.sendMessage(chatId, 'An error occurred while processing the command.');
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