const db = require('../config/db');


module.exports = async function handleCallbackQueryRussian(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
            if (data === 'role_patient') {
            await db.query('DELETE FROM doctors WHERE chat_id = $1', [chatId]);
            await db.query('INSERT INTO users (chat_id) VALUES ($1) ON CONFLICT (chat_id) DO NOTHING', [chatId]);
            await db.query('UPDATE users SET step = $1 WHERE chat_id = $2', ['gender_choice', chatId]);
            await bot.editMessageText(`Записал, ваша роль: Пациент.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Мужской', callback_data: 'gender_male' },
                            { text: 'Женский', callback_data: 'gender_female' },
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

                // Запрос на выбор часового пояса
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Мск -15', callback_data: 'tz_msk_-15' },
                                { text: 'Мск -14', callback_data: 'tz_msk_-14' },
                                { text: 'Мск -13', callback_data: 'tz_msk_-13' },
                                { text: 'Мск -12', callback_data: 'tz_msk_-12' },
                            ],
                            [
                                { text: 'Мск -11', callback_data: 'tz_msk_-11' },
                                { text: 'Мск -10', callback_data: 'tz_msk_-10' },
                                { text: 'Мск -9', callback_data: 'tz_msk_-9' },
                                { text: 'Мск -8', callback_data: 'tz_msk_-8' },
                            ],
                            [
                                { text: 'Мск -7', callback_data: 'tz_msk_-7' },
                                { text: 'Мск -6', callback_data: 'tz_msk_-6' },
                                { text: 'Мск -5', callback_data: 'tz_msk_-5' },
                                { text: 'Мск -4', callback_data: 'tz_msk_-4' },
                            ],
                            [
                                { text: 'Мск -3', callback_data: 'tz_msk_-3' },
                                { text: 'Мск -2', callback_data: 'tz_msk_-2' },
                                { text: 'Мск -1', callback_data: 'tz_msk_-1' },
                                { text: 'Мск +1', callback_data: 'tz_msk_+1' },
                            ],
                            [
                                { text: 'Мск +2', callback_data: 'tz_msk_+2' },
                                { text: 'Мск +3', callback_data: 'tz_msk_+3' },
                                { text: 'Мск +4', callback_data: 'tz_msk_+4' },
                                { text: 'Мск +5', callback_data: 'tz_msk_+5' },
                            ],
                            [
                                { text: 'Москва', callback_data: 'tz_msk_0' },
                            ],
                        ],
                    },
                };
                bot.sendMessage(chatId, 'Укажите разницу с Москвой:', options);

            } else if (data.startsWith('tz_msk_')) {
                const timezoneOffsetMsk = parseInt(data.split('_')[2]);

                // Рассчитываем разницу с GMT (МСК = GMT+3)
                const timezoneOffsetGmt = timezoneOffsetMsk + 3;

                // Сохраняем часовой пояс пользователя в формате GMT
                await db.query('UPDATE users SET timezone_gmt = $1, step = $2 WHERE chat_id = $3', [timezoneOffsetGmt, 'notification_period', chatId]);

                await bot.editMessageText(`Ваш часовой пояс: GMT${timezoneOffsetGmt >= 0 ? '+' : ''}${timezoneOffsetGmt}`, {
                    chat_id: chatId,
                    message_id: messageId,
                });

                // Запрос на время уведомлений
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Утром', callback_data: 'time_morning' },
                                { text: 'Днем', callback_data: 'time_afternoon' },
                                { text: 'Вечером', callback_data: 'time_evening' },
                            ],
                        ],
                    },
                };
                bot.sendMessage(chatId, 'Когда вам удобно получать уведомления?', options);

            } else if (data === 'time_morning' || data === 'time_afternoon' || data === 'time_evening') {
                const time = data === 'time_morning' ? 'Утром' : data === 'time_afternoon' ? 'Днем' : 'Вечером';

                await db.query('UPDATE users SET notification_period = $1 WHERE chat_id = $2', [time, chatId]);

                await bot.editMessageText(`Вы выбрали: ${time}`, {
                    chat_id: chatId,
                    message_id: messageId,
                });

                // Логика выбора конкретного часа для уведомлений в выбранный период
                let hoursOptions = [];
                if (time === 'Утром') {
                    hoursOptions = [
                        { text: '6:00', callback_data: 'hour_6' },
                        { text: '7:00', callback_data: 'hour_7' },
                        { text: '8:00', callback_data: 'hour_8' },
                        { text: '9:00', callback_data: 'hour_9' },
                        { text: '10:00', callback_data: 'hour_10' },
                        { text: '11:00', callback_data: 'hour_11' }
                    ];
                } else if (time === 'Днем') {
                    hoursOptions = [
                        { text: '12:00', callback_data: 'hour_12' },
                        { text: '13:00', callback_data: 'hour_13' },
                        { text: '14:00', callback_data: 'hour_14' },
                        { text: '15:00', callback_data: 'hour_15' },
                        { text: '16:00', callback_data: 'hour_16' },
                        { text: '17:00', callback_data: 'hour_17' }
                    ];
                } else if (time === 'Вечером') {
                    hoursOptions = [
                        { text: '18:00', callback_data: 'hour_18' },
                        { text: '19:00', callback_data: 'hour_19' },
                        { text: '20:00', callback_data: 'hour_20' },
                        { text: '21:00', callback_data: 'hour_21' },
                        { text: '22:00', callback_data: 'hour_22' },
                        { text: '23:00', callback_data: 'hour_23' },
                    ];
                }

                // Добавляем кнопки для смены периода
                const changePeriodOptions = [];
                if (time === 'Утром') {
                    changePeriodOptions.push(
                        { text: 'День', callback_data: 'time_afternoon' },
                        { text: 'Вечер', callback_data: 'time_evening' }
                    );
                } else if (time === 'Днем') {
                    changePeriodOptions.push(
                        { text: 'Утро', callback_data: 'time_morning' },
                        { text: 'Вечер', callback_data: 'time_evening' }
                    );
                } else if (time === 'Вечером') {
                    changePeriodOptions.push(
                        { text: 'Утро', callback_data: 'time_morning' },
                        { text: 'День', callback_data: 'time_afternoon' }
                    );
                }

                // Формируем кнопки для выбора времени
                const hourOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            hoursOptions,
                            changePeriodOptions
                        ],
                    },
                };

                // Сообщение с кнопками выбора часа и изменения периода
                bot.sendMessage(chatId, 'Выберите точное время для уведомлений:', hourOptions);

            } else if (data.startsWith('hour_')) {
                const hour = data.split('_')[1];

                // Сохраняем выбранный час
                await db.query('UPDATE users SET notification_hour_msk = $1 WHERE chat_id = $2', [hour, chatId]);

                // Получаем часовой пояс пользователя для расчета времени по GMT
                const user = await db.query('SELECT timezone_gmt FROM users WHERE chat_id = $1', [chatId]);
                const timezoneOffsetGmt = user.rows[0].timezone_gmt;

                // Рассчитываем время в GMT
                const gmtHour = (parseInt(hour) - timezoneOffsetGmt + 24) % 24;

                // Сохраняем время в формате GMT
                await db.query('UPDATE users SET notification_hour_gmt = $1 WHERE chat_id = $2', [gmtHour, chatId]);
                await db.query('UPDATE users SET step = $1 WHERE chat_id = $2', ['registered', chatId])
                await bot.editMessageText(`Записал ваше время: ${hour}:00 по вашему часовому поясу. Это +${timezoneOffsetGmt} GMT.`, {
                    chat_id: chatId,
                    message_id: messageId,
                });

                const finalMessage = `Отлично👍, с настройкой закончили!\nЯ напомню вам о себе после ${hour}:00 по расписанию.\n

Если вам захочется сменить настройки, выполните команду /start.`;
                await bot.sendMessage(chatId, finalMessage);


            // Подтверждение выбора роли врача
        } else if (data === 'role_doctor') {
            await bot.editMessageText(`Вы уверены, что хотите выбрать роль Врач? Все данные пациента будут удалены.`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Да', callback_data: 'confirm_doctor' },
                            { text: 'Нет', callback_data: 'cancel_doctor' },
                        ],
                    ],
                },
            });

            // Подтверждение удаления данных пациента и выбор роли врача
        } else if (data === 'confirm_doctor') {
            await db.query('DELETE FROM users WHERE chat_id = $1', [chatId]);
            await db.query('INSERT INTO doctors (chat_id) VALUES ($1) ON CONFLICT (chat_id) DO NOTHING', [chatId]);

            await bot.editMessageText(`Записал, ваша роль: Врач. Все данные как пациента были удалены.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            // Показываем кнопку "Список пациентов"
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Список пациентов', callback_data: 'patient_list_page_1' }],
                    ],
                },
            };
            bot.sendMessage(chatId, 'Добро пожаловать в кабинет врача!', options);

            // Отмена выбора роли врача
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
            bot.sendMessage(chatId, 'Выберите вашу роль:', options);

            // Показ списка пациентов
        } else if (data.startsWith('patient_list_page_')) {
            const page = parseInt(data.split('_').pop(), 10);
            const patients = [];

            // Генерация имен пациентов для текущей страницы
            for (let i = 1; i <= 9; i++) {
                const patientIndex = i + (page - 1) * 9; // Получаем реальный индекс пациента
                patients.push({ text: `Пациент ${patientIndex}`, callback_data: `patient_${patientIndex}` });
            }

            const patientRows = [];
            for (let i = 0; i < patients.length; i += 3) {
                patientRows.push(patients.slice(i, i + 3));
            }

            // Добавление кнопок навигации
            const navigationButtons = [];
            if (page > 1) {
                // Кнопка "Влево" активна только если на второй или третьей странице
                navigationButtons.push({ text: '⬅️ Влево', callback_data: `patient_list_page_${page - 1}` });
            } else {
                // Кнопка "Влево" неактивна на первой странице
                navigationButtons.push({ text: '⬅️ Влево', callback_data: 'no_action' }); // Заглушка
            }

            navigationButtons.push({ text: 'Вернуться в меню', callback_data: 'doctor_menu' });

            // Кнопка "Вправо" всегда доступна
            navigationButtons.push({ text: 'Вправо ➡️', callback_data: `patient_list_page_${page + 1}` });

            // Добавляем навигационные кнопки в массив
            patientRows.push(navigationButtons);

            await bot.editMessageText(`Вот список ваших пациентов:`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: patientRows,
                },
            });

            // Обработка нажатия на имя пациента
        } else if (data.startsWith('patient_')) {
            const patientIndex = data.split('_')[1];
            await bot.editMessageText(`Пациент: Пациент ${patientIndex}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Вернуться назад', callback_data: `patient_list_page_${1}` }, // Возвращаемся на первую страницу списка пациентов
                            { text: 'Прислать историю сообщений с пациентом', callback_data: `send_history_${patientIndex}` },
                        ],
                    ],
                },
            });

            // Вернуться в меню врача
        } else if (data === 'doctor_menu') {
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Список пациентов', callback_data: 'patient_list_page_1' }],
                    ],
                },
            };
            bot.sendMessage(chatId, 'Вы вернулись в меню врача.', options);

            // Здесь можно обработать отправку истории сообщений
        } else if (data.startsWith('send_history_')) {
            const patientIndex = data.split('_')[2];
            await bot.sendMessage(chatId, `История сообщений с Пациентом ${patientIndex} отправлена.`); // Это заглушка, здесь должна быть реальная логика
        } else if (data === 'no_action') {
            // Обработка нажатия кнопки "⬅️ Влево" на первой странице
            await bot.sendMessage(chatId, 'Вы на 1 странице пациентов.');

            // Возвращаемся к списку пациентов на первой странице
            const patients = [];

            // Генерация имен пациентов для первой страницы
            for (let i = 1; i <= 9; i++) {
                patients.push({ text: `Пациент ${i}`, callback_data: `patient_${i}` });
            }

            const patientRows = [];
            for (let i = 0; i < patients.length; i += 3) {
                patientRows.push(patients.slice(i, i + 3));
            }

            const navigationButtons = [
                { text: '⬅️ Влево', callback_data: 'no_action' }, // Заглушка
                { text: 'Вернуться в меню', callback_data: 'doctor_menu' },
                { text: 'Вправо ➡️', callback_data: 'patient_list_page_2' }, // Переход на вторую страницу
            ];

            patientRows.push(navigationButtons);

            await bot.sendMessage(chatId, `Вот список ваших пациентов:`, {
                reply_markup: {
                    inline_keyboard: patientRows,
                },
            });
        }



    } catch (err) {
        console.error('Ошибка при обработке callback_query:', err);
    }
};
