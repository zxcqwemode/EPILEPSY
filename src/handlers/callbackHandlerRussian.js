// callbackHandlerRussian.js
const db = require('../config/db');
const doctorOfficeHandlerRussian = require('./doctorOfficeHandlerRussian');

module.exports = async function handleCallbackQueryRussian(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    try {
        if (data === 'role_patient') {
            const doctorLanguageResult = await db.query('SELECT language FROM doctors WHERE chat_id = $1', [chatId]);
            const language = doctorLanguageResult.rows.length > 0 ? doctorLanguageResult.rows[0].language : 'Русский';

            await db.query('UPDATE users SET step = $1 WHERE chat_id = $2', ['gender_choice', chatId]);

            await bot.editMessageText(`Записал, ваша роль: Пациент.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Мужской', callback_data: 'gender_male'},
                            {text: 'Женский', callback_data: 'gender_female'},
                        ],
                    ],
                },
            };
            bot.sendMessage(chatId, 'Ваш пол?', options);

        } else if (data === 'gender_male' || data === 'gender_female') {
            const gender = data === 'gender_male' ? 'Мужской' : 'Женский';

            await db.query('UPDATE users SET gender = $1, step = $2 WHERE chat_id = $3', [gender, 'timezone', chatId]);

            await bot.editMessageText(`Записал, ваш пол: ${gender}`, {
                chat_id: chatId,
                message_id: messageId,
            });

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Мск -15', callback_data: 'tz_msk_-15'},
                            {text: 'Мск -14', callback_data: 'tz_msk_-14'},
                            {text: 'Мск -13', callback_data: 'tz_msk_-13'},
                            {text: 'Мск -12', callback_data: 'tz_msk_-12'},
                        ],
                        [
                            {text: 'Мск -11', callback_data: 'tz_msk_-11'},
                            {text: 'Мск -10', callback_data: 'tz_msk_-10'},
                            {text: 'Мск -9', callback_data: 'tz_msk_-9'},
                            {text: 'Мск -8', callback_data: 'tz_msk_-8'},
                        ],
                        [
                            {text: 'Мск -7', callback_data: 'tz_msk_-7'},
                            {text: 'Мск -6', callback_data: 'tz_msk_-6'},
                            {text: 'Мск -5', callback_data: 'tz_msk_-5'},
                            {text: 'Мск -4', callback_data: 'tz_msk_-4'},
                        ],
                        [
                            {text: 'Мск -3', callback_data: 'tz_msk_-3'},
                            {text: 'Мск -2', callback_data: 'tz_msk_-2'},
                            {text: 'Мск -1', callback_data: 'tz_msk_-1'},
                            {text: 'Мск +1', callback_data: 'tz_msk_+1'},
                        ],
                        [
                            {text: 'Мск +2', callback_data: 'tz_msk_+2'},
                            {text: 'Мск +3', callback_data: 'tz_msk_+3'},
                            {text: 'Мск +4', callback_data: 'tz_msk_+4'},
                            {text: 'Мск +5', callback_data: 'tz_msk_+5'},
                        ],
                        [
                            {text: 'Москва', callback_data: 'tz_msk_0'},
                        ],
                    ],
                },
            };
            bot.sendMessage(chatId, 'Укажите разницу с Москвой:', options);

        } else if (data.startsWith('tz_msk_')) {
            const timezoneOffsetMsk = parseInt(data.split('_')[2]);
            const timezoneOffsetGmt = timezoneOffsetMsk + 3;

            await db.query('UPDATE users SET timezone_gmt = $1, step = $2 WHERE chat_id = $3', [timezoneOffsetGmt, 'registered', chatId]);

            await bot.editMessageText(`Ваш часовой пояс: GMT${timezoneOffsetGmt >= 0 ? '+' : ''}${timezoneOffsetGmt}`, {
                chat_id: chatId,
                message_id: messageId,
            });

            const finalMessage = `Отлично👍, с настройкой вашего профиля закончили!\n
Если вам захочется сменить настройки, выполните команду /start.\nТеперь вам доступен личный профиль!\nДля перехода в личный профиль выполните команду /myProfile`;
            await bot.sendMessage(chatId, finalMessage);

        } else if (data === 'role_doctor') {
            await bot.editMessageText(`Вы уверены, что хотите выбрать роль Врач? Все данные пациента будут удалены.`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Да', callback_data: 'confirm_doctor'},
                            {text: 'Нет', callback_data: 'cancel_doctor'},
                        ],
                    ],
                },
            });

        } else if (data === 'confirm_doctor') {
            await db.query('DELETE FROM messages WHERE user_id = $1', [chatId]);
            await db.query('DELETE FROM calendar WHERE user_id = $1', [chatId]);
            await db.query('DELETE FROM notifications WHERE user_id = $1', [chatId]);

            await db.query('DELETE FROM users WHERE chat_id = $1', [chatId]);

            const doctorCheck = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);
            let doctorKey;

            if (doctorCheck.rows.length === 0) {
                doctorKey = Math.random().toString(36).substring(2, 10);
                await db.query(
                    'INSERT INTO doctors (chat_id, language, doctor_key) VALUES ($1, $2, $3)',
                    [chatId, 'Русский', doctorKey]
                );
            } else {
                doctorKey = doctorCheck.rows[0].doctor_key;
            }

            // После базовой настройки передаем управление в doctorOfficeHandlerRussian
            await doctorOfficeHandlerRussian.initializeDoctorOfficeRussian(bot, chatId, messageId, doctorKey);

        } else if (data === 'cancel_doctor') {
            await bot.editMessageText('Выбор роли отменен. Пожалуйста, выберите роль заново.', {
                chat_id: chatId,
                message_id: messageId,
            });

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Врач', callback_data: 'role_doctor' },
                            { text: 'Пациент', callback_data: 'role_patient' },
                        ],
                    ],
                },
            };
            await bot.sendMessage(chatId, 'Выберите вашу роль:', options);
        } else {
            // Передаем остальные callback запросы в обработчик кабинета врача
            await doctorOfficeHandlerRussian.handleDoctorCallbackRussian(bot, callbackQuery);
        }
    } catch (err) {
        console.error('Ошибка при обработке callback_query:', err);
    }
};