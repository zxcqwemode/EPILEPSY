const db = require('../config/db');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const replyData = new Map();
const waitingForReply = new Set();
const waitingForName = new Set();
const waitingForDescription = new Set();

async function initializeDoctorOfficeRussian(bot, chatId, messageId, doctorKey) {
    try {
        await bot.editMessageText(`Записал, ваша роль: Врач. Все данные как пациента были удалены.`, {
            chat_id: chatId,
            message_id: messageId,
        });

        // Добавляем чат в список ожидающих ввода имени
        waitingForName.add(chatId);

        // Запрашиваем ФИО
        await bot.sendMessage(chatId, 'Введите свое ФИО');
    } catch (err) {
        console.error('Ошибка при инициализации кабинета врача:', err);
        throw err;
    }
}


async function showDoctorMainMenu(bot, chatId, doctorKey) {
    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Список пациентов', callback_data: 'patient_list_page_1' }],
                [{ text: 'Повторная регистрация', callback_data: 'doctor_reregistration' }]
            ],
        },
    };

    if (doctorKey) {
        await bot.sendMessage(chatId, `Ваш уникальный ключ: ${doctorKey}. Сообщите его пациентам для подключения.\nДля вызова меню используйте команду /menu.`);
    }

    const doctor = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);

    if (doctor.rows.length > 0) {
        const dbDoctorKey = doctor.rows[0].doctor_key;
        const message = `Добро пожаловать в кабинет врача!\n\nВаш ключ:\n<code>${dbDoctorKey}</code>`;
        await bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    }

    await bot.sendMessage(chatId, `Главное меню`, options);
}

async function handlePatientListPageRussian(bot, chatId, messageId, data) {
    try {
        const page = parseInt(data.split('_').pop(), 10);

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (!doctorKey) {
            await bot.editMessageText("Ошибка: ключ врача не найден.", {
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
            { text: '⬅️ Влево', callback_data: page > 1 ? `patient_list_page_${page - 1}` : 'no_action' },
            { text: 'Вернуться в меню', callback_data: 'doctor_menu' },
            { text: 'Вправо ➡️', callback_data: `patient_list_page_${page + 1}` },
        ];
        patientRows.push(navigationButtons);

        await bot.editMessageText(`Вот список ваших пациентов:`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: patientRows,
            },
        });
    } catch (err) {
        console.error('Ошибка при обработке списка пациентов:', err);
        throw err;
    }
}


async function handlePatientSelectionRussian(bot, chatId, messageId, data) {
    try {
        const [, , patientIndex, patientChatId] = data.split('_');
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query('SELECT name FROM users WHERE chat_id = $1 AND doctor_key = $2', [patientChatId, doctorKey]);
        const patientName = patientResult.rows[0]?.name;

        if (!patientName) {
            await bot.editMessageText("Пациент не найден.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const banResult = await db.query('SELECT id FROM bans WHERE user_id = $1 AND doctor_key = $2', [patientChatId, doctorKey]);
        const isBanned = banResult.rows.length > 0;

        const banButton = isBanned ?
            { text: 'Разрешить писать', callback_data: `unban_patient_index_${patientIndex}_${patientChatId}` } :
            { text: 'Запретить писать', callback_data: `ban_patient_index_${patientIndex}_${patientChatId}` };

        await bot.editMessageText(`Пациент: ${patientName}${isBanned ? ' (Заблокирован)' : ''}`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Информация о пациенте', callback_data: `patient_info_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Непрочитанные сообщения', callback_data: `unread_messages_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'История переписки', callback_data: `send_history_index_${patientIndex}_${patientChatId}` }],
                    [banButton],
                    [{ text: 'Удалить пациента', callback_data: `delete_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Вернуться назад', callback_data: `patient_list_page_1` }]
                ],
            },
        });
    } catch (err) {
        console.error('Ошибка при выборе пациента:', err);
        throw err;
    }
}

async function handleDeletePatient(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        await db.query(`
            UPDATE users 
            SET doctor_key = NULL, key_valid = false 
            WHERE chat_id = $1
        `, [patientChatId]);

        await bot.editMessageText('Пациент успешно удален из вашего списка.', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Вернуться к списку пациентов', callback_data: 'patient_list_page_1' }]
                ]
            }
        });

        // Отправляем уведомление пациенту
        await bot.sendMessage(patientChatId, 'Вы были отключены от врача. Для повторного подключения вам потребуется новый ключ.');
    } catch (err) {
        console.error('Ошибка при удалении пациента:', err);
        throw err;
    }
}

async function handlePatientInfoRequestRussian(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        const patientResult = await db.query(
            'SELECT name, fio, language, gender FROM users WHERE chat_id = $1 AND doctor_key = $2',
            [patientChatId, doctorKey]
        );

        if (patientResult.rows.length === 0) {
            await bot.editMessageText("Пациент не найден.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const patient = patientResult.rows[0];
        const chatInfo = await bot.getChat(patientChatId);
        const telegramUsername = chatInfo.username ? `@${chatInfo.username}` : 'Не указан';

        const messageText = `Пациент ${patient.name}\n\n` +
            `ФИО: ${patient.fio}\n` +
            `Язык: ${patient.language}\n` +
            `Пол: ${patient.gender}\n` +
            `Личная ссылка: ${telegramUsername}`;

        await bot.editMessageText(messageText, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Вернуться', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                ],
            },
        });
    } catch (err) {
        console.error('Ошибка при получении информации о пациенте:', err);
        throw err;
    }
}


async function handleBanPatient(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        // Добавляем запись в таблицу bans
        await db.query(`
            INSERT INTO bans (user_id, doctor_key)
            VALUES ($1, $2)
            ON CONFLICT (user_id, doctor_key) DO NOTHING
        `, [patientChatId, doctorKey]);

        // Получаем информацию о пациенте для обновления отображения
        const patientResult = await db.query('SELECT chat_id, name FROM users WHERE chat_id = $1', [patientChatId]);
        const patientName = patientResult.rows[0]?.name;

        await bot.sendMessage(patientChatId, 'Врач ограничил вашу возможность отправлять сообщения.');

        // Перезагружаем меню пациента с обновленным статусом
        await bot.editMessageText(`Пациент: ${patientName} (Заблокирован)`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Информация о пациенте', callback_data: `patient_info_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Непрочитанные сообщения', callback_data: `unread_messages_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'История переписки', callback_data: `send_history_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Разрешить писать', callback_data: `unban_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Удалить пациента', callback_data: `delete_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Вернуться назад', callback_data: 'patient_list_page_1' }]
                ],
            },
        });
    } catch (err) {
        console.error('Ошибка при блокировке пациента:', err);
        throw err;
    }
}

async function handleUnbanPatient(bot, chatId, messageId, data) {
    try {
        const [, , , patientIndex, patientChatId] = data.split('_');

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        // Удаляем запись из таблицы bans
        await db.query(`
            DELETE FROM bans 
            WHERE user_id = $1 AND doctor_key = $2
        `, [patientChatId, doctorKey]);

        // Получаем информацию о пациенте для обновления отображения
        const patientResult = await db.query('SELECT chat_id, name FROM users WHERE chat_id = $1', [patientChatId]);
        const patientName = patientResult.rows[0]?.name;

        await bot.sendMessage(patientChatId, 'Врач снял ограничение на отправку сообщений.');

        // Перезагружаем меню пациента с обновленным статусом
        await bot.editMessageText(`Пациент: ${patientName}`, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Информация о пациенте', callback_data: `patient_info_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Непрочитанные сообщения', callback_data: `unread_messages_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'История переписки', callback_data: `send_history_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Запретить писать', callback_data: `ban_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Удалить пациента', callback_data: `delete_patient_index_${patientIndex}_${patientChatId}` }],
                    [{ text: 'Вернуться назад', callback_data: 'patient_list_page_1' }]
                ],
            },
        });
    } catch (err) {
        console.error('Ошибка при разблокировке пациента:', err);
        throw err;
    }
}

async function handleMessageHistoryRequestRussian(bot, chatId, messageId, data) {
    try {
        const parts = data.split('_');
        const patientIndex = parseInt(parts[3]);
        const patientChatId = parts[4];

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (!doctorKey) {
            await bot.editMessageText("Ошибка: ключ врача не найден.", {
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
            await bot.editMessageText("Пациент не найден.", {
                chat_id: chatId,
                message_id: messageId
            });
            return;
        }

        const patient = patientResult.rows[0];

        // Получаем сообщения
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
            // Формируем данные для Excel
            const excelData = [];
            excelData.push(['Отправитель', 'Текст сообщения', 'Дата отправления']); // Заголовок

            messages.rows.forEach(msg => {
                const sender = msg.sender_type === 'patient' ? patient.name : 'Врач';
                const date = new Date(msg.message_date).toLocaleString(); // Форматируем дату

                excelData.push([sender, msg.message_text, date]);
            });

            // Создаем рабочий лист Excel
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

            // Сохраняем Excel файл
            const dirPath = path.join(__dirname, '../../public');
            const filePath = path.join(dirPath, `messages_${patientChatId}.xlsx`);

            XLSX.writeFile(wb, filePath);

            // Отправляем файл пользователю
            await bot.sendMessage(chatId, `История сообщений с пациентом ${patient.name}:`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад к пациенту', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                    ]
                }
            });

            await bot.sendDocument(chatId, fs.createReadStream(filePath), {}, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад к пациенту', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                    ]
                }
            });

            fs.unlink(filePath, (err) => {
                if (err) console.error('Ошибка при удалении файла:', err);
            });
        } else {
            await bot.editMessageText(`У пациента ${patient.name} нет сообщений.`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Назад к пациенту', callback_data: `patient_index_${patientIndex}_${patientChatId}` }]
                    ]
                }
            });
        }
    } catch (err) {
        console.error('Ошибка при запросе истории сообщений:', err);
        throw err;
    }
}


async function handleUnreadMessagesForPatient(bot, chatId, messageId, data) {
    try {
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (!doctorKey) {
            await bot.sendMessage(chatId, "Ошибка: ключ врача не найден.");
            return;
        }

        // Новый парсинг для формата unread_messages_patient_index_1_12345
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
        const patientName = patient.rows[0]?.name || 'Неизвестный пациент';

        if (unreadMessages.rows.length === 0) {
            await bot.sendMessage(chatId, `У пациента ${patientName} нет непрочитанных сообщений`, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Назад к пациенту', callback_data: `patient_index_${patientIndex}_${patientChatId}` }
                    ]]
                }
            });
            return;
        }

        for (const msg of unreadMessages.rows) {
            let messageText = `От: ${patientName}\n`;
            messageText += `Дата: ${new Date(msg.message_date).toLocaleString()}\n`;
            messageText += msg.isFile ? `Файл: ${msg.fileName}\n` : `Сообщение: ${msg.message_text}`;

            const callbackData = `reply_to_${msg.message_id}_${patientIndex}_${patientChatId}`;
            await bot.sendMessage(chatId, messageText, {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Ответить', callback_data: callbackData }
                    ]]
                }
            });
        }

        await bot.sendMessage(chatId, 'Все непрочитанные сообщения', {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Назад к пациенту', callback_data: `patient_index_${patientIndex}_${patientChatId}` }
                ]]
            }
        });
    } catch (err) {
        console.error('Ошибка при получении непрочитанных сообщений:', err);
        await bot.sendMessage(chatId, 'Произошла ошибка при получении сообщений.');
    }
}

async function handleReplyToMessage(bot, chatId, messageId, data) {
    try {
        // Новый парсинг для формата reply_to_messageId_patientIndex_patientChatId
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

        await bot.sendMessage(chatId, 'Напишите ваш ответ:', {
            reply_markup: {
                force_reply: true,
                selective: true
            }
        });
    } catch (err) {
        console.error('Ошибка при подготовке к ответу:', err);
        await bot.sendMessage(chatId, 'Произошла ошибка при подготовке к ответу. Пожалуйста, попробуйте снова.');
    }
}

async function handleMarkAsRead(bot, chatId, messageId, data) {
    try {
        const messageIdToMark = data.split('_')[2];

        await db.query('UPDATE messages SET isRead = TRUE WHERE message_id = $1', [messageIdToMark]);

        await handleUnreadMessagesForPatient(bot, chatId, messageId, data);
    } catch (err) {
        console.error('Ошибка при отметке сообщения как прочитанного:', err);
        throw err;
    }
}

async function handleDoctorMenuReturnRussian(bot, chatId, messageId) {
    try {
        // Удаляем сообщение с кнопками
        await bot.deleteMessage(chatId, messageId);

        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        // Отправляем новое сообщение с главным меню
        await showDoctorMainMenu(bot, chatId, null);
    } catch (err) {
        console.error('Ошибка при возврате в меню врача:', err);
        throw err;
    }
}

async function handleDoctorCallbackRussian(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        if (data.startsWith('patient_list_page_')) {
            await handlePatientListPageRussian(bot, chatId, messageId, data);
        }
        else if (data.startsWith('patient_index_')) {
            await handlePatientSelectionRussian(bot, chatId, messageId, data);
        }
        else if (data.startsWith('send_history_index_')) {
            // Обновлен для нового формата
            await handleMessageHistoryRequestRussian(bot, chatId, messageId, data);
        }
        else if (data === 'doctor_menu') {
            await handleDoctorMenuReturnRussian(bot, chatId, messageId);
        }
        else if (data.startsWith('unread_messages_patient_index_')) {
            // Обновлен для нового формата
            await handleUnreadMessagesForPatient(bot, chatId, messageId, data);
        }
        else if (data.startsWith('reply_to_')) {
            await handleReplyToMessage(bot, chatId, messageId, data);
        }
        else if (data.startsWith('mark_read_')) {
            await handleMarkAsRead(bot, chatId, messageId, data);
        }
        else if (data.startsWith('delete_patient_index_')) {
            await handleDeletePatient(bot, chatId, messageId, data);
        }
        else if (data.startsWith('ban_patient_index_')) {
            await handleBanPatient(bot, chatId, messageId, data);
        }
        else if (data.startsWith('unban_patient_index_')) {
            await handleUnbanPatient(bot, chatId, messageId, data);
        }
        else if (data.startsWith('patient_info_index_')) {
            await handlePatientInfoRequestRussian(bot, chatId, messageId, data);
        }
        else if (data.startsWith('doctor_reregistration')) {
            await db.query('DELETE FROM doctors_messages WHERE doctor_id = $1', [chatId]);
            await db.query('DELETE FROM messages WHERE doctor_key = (SELECT doctor_key FROM doctors WHERE chat_id = $1)', [chatId]);
            await db.query('DELETE FROM doctors WHERE chat_id = $1', [chatId]);
            await bot.sendMessage(chatId, 'Ваш аккаунт врача был удален.\nЧтобы пройти процесс регистрации заново, используйте /start');
        }
    } catch (err) {
        console.error('Ошибка при обработке callback запроса врача:', err);
        throw err;
    }
}

async function handleDoctorMessage(bot, msg) {
    const chatId = msg.chat.id;
    const messageText = msg.text;

    if (waitingForName.has(chatId)) {
        try {
            // Сохраняем ФИО врача
            await db.query('UPDATE doctors SET name = $1 WHERE chat_id = $2', [messageText, chatId]);
            waitingForName.delete(chatId);

            // Запрашиваем описание
            waitingForDescription.add(chatId);
            await bot.sendMessage(chatId, 'Введите краткую информацию о себе');
        } catch (err) {
            console.error('Ошибка при сохранении ФИО врача:', err);
            await bot.sendMessage(chatId, 'Произошла ошибка при сохранении ФИО. Пожалуйста, попробуйте снова.');
        }
    } else if (waitingForDescription.has(chatId)) {
        try {
            // Сохраняем описание врача
            await db.query('UPDATE doctors SET description = $1 WHERE chat_id = $2', [messageText, chatId]);
            waitingForDescription.delete(chatId);

            // После сохранения описания показываем главное меню
            const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
            const doctorKey = doctorResult.rows[0]?.doctor_key;
            await showDoctorMainMenu(bot, chatId, doctorKey);
        } catch (err) {
            console.error('Ошибка при сохранении описания врача:', err);
            await bot.sendMessage(chatId, 'Произошла ошибка при сохранении информации. Пожалуйста, попробуйте снова.');
        }
    } else if (waitingForReply.has(chatId)) {
        try {
            const replyInfo = replyData.get(chatId);
            if (!replyInfo) {
                throw new Error('Информация для ответа не найдена');
            }

            const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
            const doctorKey = doctorResult.rows[0]?.doctor_key;

            if (!doctorKey) {
                throw new Error('Ключ врача не найден');
            }

            const patientResult = await db.query(
                'SELECT chat_id FROM users WHERE chat_id = $1 AND doctor_key = $2',
                [replyInfo.userId, doctorKey]
            );

            if (patientResult.rows.length === 0) {
                throw new Error('Пациент не найден');
            }

            await bot.sendMessage(replyInfo.userId, `Ответ от врача:\n${messageText}`);

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

            await bot.sendMessage(chatId, 'Ответ успешно отправлен.');

            await bot.sendMessage(chatId, 'Вернуться к пациенту', {
                reply_markup: {
                    inline_keyboard: [[
                        { text: 'Назад к пациенту', callback_data: `patient_index_${replyInfo.patientIndex}_${replyInfo.userId}` }
                    ]]
                }
            });
        } catch (err) {
            console.error('Ошибка при отправке ответа:', err);
            await bot.sendMessage(chatId, 'Произошла ошибка при отправке ответа. Пожалуйста, попробуйте снова.');
        }
    }
}

async function handleMenuCommand(bot, msg) {
    const chatId = msg.chat.id;
    try {
        const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
        const doctorKey = doctorResult.rows[0]?.doctor_key;

        if (doctorKey) {
            await showDoctorMainMenu(bot, chatId, null);
        } else {
            await bot.sendMessage(chatId, 'У вас нет доступа к меню врача.');
        }
    } catch (err) {
        console.error('Ошибка при обработке команды меню:', err);
        await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды.');
    }
}
module.exports = {
    initializeDoctorOfficeRussian,
    showDoctorMainMenu,
    handlePatientListPageRussian,
    handlePatientSelectionRussian,
    handleMessageHistoryRequestRussian,
    handleDoctorMenuReturnRussian,
    handleDoctorCallbackRussian,
    handleUnreadMessagesForPatient,
    handleReplyToMessage,
    handleDoctorMessage,
    handleMenuCommand
};