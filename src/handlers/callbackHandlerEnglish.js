const db = require('../config/db');

module.exports = async function handleCallbackQueryEnglish(bot, callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    try {
        if (data === 'role_patient') {
            const doctorLanguageResult = await db.query('SELECT language FROM doctors WHERE chat_id = $1', [chatId]);
            const language = doctorLanguageResult.rows.length > 0 ? doctorLanguageResult.rows[0].language : 'English'; // Если языка нет, устанавливаем по умолчанию на английский

            // Удаляем врача из таблицы doctors
            await db.query('DELETE FROM doctors WHERE chat_id = $1', [chatId]);

            // Вставляем пользователя в таблицу users с языком
            await db.query('INSERT INTO users (chat_id, language) VALUES ($1, $2) ON CONFLICT (chat_id) DO NOTHING', [chatId, language]);

            // Обновляем шаг пользователя в таблице users
            await db.query('UPDATE users SET step = $1 WHERE chat_id = $2', ['gender_choice', chatId]);

            await bot.editMessageText(`Recorded your role: Patient.`, {
                chat_id: chatId,
                message_id: messageId,
            });

        const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Male', callback_data: 'gender_male' },
                            { text: 'Female', callback_data: 'gender_female' },
                        ],
                    ],
                },
            };
            bot.sendMessage(chatId, 'What is your gender?', options);

         } else if (data === 'gender_male' || data === 'gender_female') {
            const gender = data === 'gender_male' ? 'Male' : 'Female';

            await db.query('UPDATE users SET gender = $1, step = $2 WHERE chat_id = $3', [gender, 'timezone', chatId]);

            await bot.editMessageText(`Your gender: ${gender} has been recorded.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            // Request to select the time zone
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'MSK -15', callback_data: 'tz_msk_-15' },
                            { text: 'MSK -14', callback_data: 'tz_msk_-14' },
                            { text: 'MSK -13', callback_data: 'tz_msk_-13' },
                            { text: 'MSK -12', callback_data: 'tz_msk_-12' },
                        ],
                        [
                            { text: 'MSK -11', callback_data: 'tz_msk_-11' },
                            { text: 'MSK -10', callback_data: 'tz_msk_-10' },
                            { text: 'MSK -9', callback_data: 'tz_msk_-9' },
                            { text: 'MSK -8', callback_data: 'tz_msk_-8' },
                        ],
                        [
                            { text: 'MSK -7', callback_data: 'tz_msk_-7' },
                            { text: 'MSK -6', callback_data: 'tz_msk_-6' },
                            { text: 'MSK -5', callback_data: 'tz_msk_-5' },
                            { text: 'MSK -4', callback_data: 'tz_msk_-4' },
                        ],
                        [
                            { text: 'MSK -3', callback_data: 'tz_msk_-3' },
                            { text: 'MSK -2', callback_data: 'tz_msk_-2' },
                            { text: 'MSK -1', callback_data: 'tz_msk_-1' },
                            { text: 'MSK +1', callback_data: 'tz_msk_+1' },
                        ],
                        [
                            { text: 'MSK +2', callback_data: 'tz_msk_+2' },
                            { text: 'MSK +3', callback_data: 'tz_msk_+3' },
                            { text: 'MSK +4', callback_data: 'tz_msk_+4' },
                            { text: 'MSK +5', callback_data: 'tz_msk_+5' },
                        ],
                        [
                            { text: 'Moscow', callback_data: 'tz_msk_0' },
                        ],
                    ],
                },
            };
            bot.sendMessage(chatId, 'Please specify your time zone difference from MSK (Moscow):', options);

        } else if (data.startsWith('tz_msk_')) {
            const timezoneOffsetMsk = parseInt(data.split('_')[2]);

            // Calculate the difference with GMT (MSK = GMT+3)
            const timezoneOffsetGmt = timezoneOffsetMsk + 3;

            // Save the user's time zone in GMT format
            await db.query('UPDATE users SET timezone_gmt = $1, step = $2 WHERE chat_id = $3', [timezoneOffsetGmt, 'notification_period', chatId]);

            await bot.editMessageText(`Your time zone: GMT${timezoneOffsetGmt >= 0 ? '+' : ''}${timezoneOffsetGmt} has been recorded.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            // Request for notification time
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Morning', callback_data: 'time_morning' },
                            { text: 'Afternoon', callback_data: 'time_afternoon' },
                            { text: 'Evening', callback_data: 'time_evening' },
                        ],
                    ],
                },
            };
            bot.sendMessage(chatId, 'When do you prefer to receive notifications?', options);

        } else if (data === 'time_morning' || data === 'time_afternoon' || data === 'time_evening') {
            const time = data === 'time_morning' ? 'Morning' : data === 'time_afternoon' ? 'Afternoon' : 'Evening';

            await db.query('UPDATE users SET notification_period = $1 WHERE chat_id = $2', [time, chatId]);

            await bot.editMessageText(`You selected: ${time}.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            // Logic for selecting the exact hour for notifications in the chosen period
            let hoursOptions = [];
            if (time === 'Morning') {
                hoursOptions = [
                    { text: '6:00', callback_data: 'hour_6' },
                    { text: '7:00', callback_data: 'hour_7' },
                    { text: '8:00', callback_data: 'hour_8' },
                    { text: '9:00', callback_data: 'hour_9' },
                    { text: '10:00', callback_data: 'hour_10' },
                    { text: '11:00', callback_data: 'hour_11' }
                ];
            } else if (time === 'Afternoon') {
                hoursOptions = [
                    { text: '12:00', callback_data: 'hour_12' },
                    { text: '13:00', callback_data: 'hour_13' },
                    { text: '14:00', callback_data: 'hour_14' },
                    { text: '15:00', callback_data: 'hour_15' },
                    { text: '16:00', callback_data: 'hour_16' },
                    { text: '17:00', callback_data: 'hour_17' }
                ];
            } else if (time === 'Evening') {
                hoursOptions = [
                    { text: '18:00', callback_data: 'hour_18' },
                    { text: '19:00', callback_data: 'hour_19' },
                    { text: '20:00', callback_data: 'hour_20' },
                    { text: '21:00', callback_data: 'hour_21' },
                    { text: '22:00', callback_data: 'hour_22' },
                    { text: '23:00', callback_data: 'hour_23' },
                ];
            }

            // Add buttons for changing the period
            const changePeriodOptions = [];
            if (time === 'Morning') {
                changePeriodOptions.push(
                    { text: 'Afternoon', callback_data: 'time_afternoon' },
                    { text: 'Evening', callback_data: 'time_evening' }
                );
            } else if (time === 'Afternoon') {
                changePeriodOptions.push(
                    { text: 'Morning', callback_data: 'time_morning' },
                    { text: 'Evening', callback_data: 'time_evening' }
                );
            } else if (time === 'Evening') {
                changePeriodOptions.push(
                    { text: 'Morning', callback_data: 'time_morning' },
                    { text: 'Afternoon', callback_data: 'time_afternoon' }
                );
            }

            // Form buttons for choosing time
            const hourOptions = {
                reply_markup: {
                    inline_keyboard: [
                        hoursOptions,
                        changePeriodOptions
                    ],
                },
            };

            // Message with buttons for selecting time and changing period
            bot.sendMessage(chatId, 'Good, choose the exact time for notifications:', hourOptions);

        } else if (data.startsWith('hour_') && !data.endsWith('_edit')) {
                const hour = data.split('_')[1];

                const user = await db.query('SELECT timezone_gmt FROM users WHERE chat_id = $1', [chatId]);
                const timezoneOffsetGmt = user.rows[0].timezone_gmt;

                const hourMsk= hour - timezoneOffsetGmt +3;
                // Сохраняем выбранный час
                await db.query('UPDATE users SET notification_hour_msk = $1 WHERE chat_id = $2', [hourMsk, chatId]);

                // Рассчитываем время в GMT
                const gmtHour = (parseInt(hour) - timezoneOffsetGmt + 24) % 24;

            // Save the time in GMT format
            await db.query('UPDATE users SET notification_hour_gmt = $1 WHERE chat_id = $2', [gmtHour, chatId]);
            await db.query('UPDATE users SET step = $1 WHERE chat_id = $2', ['registered', chatId])
            await bot.editMessageText(`Your time: ${hour}:00 in your time zone. That's GMT+${timezoneOffsetGmt}.`, {
                chat_id: chatId,
                message_id: messageId,
            });

                const finalMessage = `Great 👍! Your profile setup is complete!\nI will remind you after ${hour}:00 according to the schedule.\n

If you want to change the settings, use the /start command.\nYour personal profile is now available!\nTo access your profile, use the /myProfile command.`;

                await bot.sendMessage(chatId, finalMessage);

            // Confirmation of doctor role selection
        } else if (data === 'role_doctor') {
            await bot.editMessageText(`Are you sure you want to choose the role of Doctor? All patient data will be deleted.`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Yes', callback_data: 'confirm_doctor' },
                            { text: 'No', callback_data: 'cancel_doctor' },
                        ],
                    ],
                },
            });

            // Confirmation of deletion of patient data and selection of the role of doctor
        } else if (data === 'confirm_doctor') {
            await db.query('DELETE FROM users WHERE chat_id = $1', [chatId]);

            // Запрашиваем врача из базы данных
            const doctorCheck = await db.query('SELECT * FROM doctors WHERE chat_id = $1', [chatId]);

            let doctorKey;

            // Проверяем, есть ли врач и его ключ
            if (doctorCheck.rows.length === 0) {
                // Если врача нет, генерируем уникальный ключ
                const generateDoctorKey = () => {
                    return Math.random().toString(36).substring(2, 10); // Генерация случайной строки из 8 символов
                };

                // Генерация уникального ключа для врача
                doctorKey = generateDoctorKey();

                await db.query(
                    'INSERT INTO doctors (chat_id, language, doctor_key) VALUES ($1, $2, $3)',
                    [chatId, 'English', doctorKey]
                );
            } else {
                // Если врач существует, используем его ключ
                doctorKey = doctorCheck.rows[0].doctor_key;
            }

            await bot.editMessageText(`Recorded, your role: Doctor. All patient data has been deleted.`, {
                chat_id: chatId,
                message_id: messageId,
            });

            // Показываем кнопку "Список пациентов"
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Patient List', callback_data: 'patient_list_page_1' }],
                    ],
                },
            };

            await bot.sendMessage(chatId, `Your unique key: ${doctorKey}. Please share it with patients for connection.`);
            await bot.sendMessage(chatId, 'Welcome to the doctor\'s cabinet!', options);


    } else if (data === 'cancel_doctor') {
            await bot.editMessageText('Role selection canceled. Please choose your role again.', {
                chat_id: chatId,
                message_id: messageId,
            });

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Doctor', callback_data: 'role_doctor' },
                            { text: 'Patient', callback_data: 'role_patient' },
                        ],
                    ],
                },
            };
            await bot.sendMessage(chatId, 'Please choose your role:', options);

        } else if (data.startsWith('patient_list_page_')) {
            const page = parseInt(data.split('_').pop(), 10);
            const doctorResult = await db.query('SELECT doctor_key FROM doctors WHERE chat_id = $1', [chatId]);
            const doctorKey = doctorResult.rows[0]?.doctor_key;

            if (!doctorKey) {
                await bot.sendMessage(chatId, "Error: Doctor key not found.");
                return;
            }

            // Запрашиваем пациентов из базы данных
            const result = await db.query('SELECT * FROM users WHERE doctor_key = $1', [doctorKey]); // Получаем список пациентов
            const patients = result.rows;

            let patientButtons = [];

            // Проверяем, есть ли пациенты
            if (patients.length > 0) {
                // Генерация кнопок для пациентов
                for (let i = 0; i < patients.length; i++) {
                    const patientIndex = i + 1;
                    patientButtons.push({ text: `Patient ${patientIndex}`, callback_data: `patient_${patientIndex}` });
                }

                // Если у врача меньше 9 пациентов, добавляем пустые кнопки
                for (let i = patients.length; i < 9; i++) {
                    patientButtons.push({ text: ' ', callback_data: 'no_action' }); // Заглушка
                }
            } else {
                // Если нет пациентов, создаем пустые кнопки
                for (let i = 0; i < 9; i++) {
                    patientButtons.push({ text: 'No patients', callback_data: 'no_action' });
                }
            }

            // Формируем строки для кнопок
            const patientRows = [];
            for (let i = 0; i < patientButtons.length; i += 3) {
                patientRows.push(patientButtons.slice(i, i + 3));
            }

            // Добавление кнопок навигации
            const navigationButtons = [
                { text: '⬅️ Left', callback_data: page > 1 ? `patient_list_page_${page - 1}` : 'no_action' },
                { text: 'Return to menu', callback_data: 'doctor_menu' },
                { text: 'Right ➡️', callback_data: `patient_list_page_${page + 1}` },
            ];

            // Добавляем навигационные кнопки в массив
            patientRows.push(navigationButtons);

            await bot.editMessageText(`Here is the list of your patients:`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: patientRows,
                },
            });

        } else if (data.startsWith('patient_')) {
            const patientIndex = data.split('_')[1];
            await bot.editMessageText(`Patient: Patient ${patientIndex}`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Go back', callback_data: `patient_list_page_${1}` }, // Возвращаемся на первую страницу списка пациентов
                            { text: 'Send message history with patient', callback_data: `send_history_${patientIndex}` },
                        ],
                    ],
                },
            });
        } else if (data === 'doctor_menu') {
            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: 'Patient List', callback_data: 'patient_list_page_1' }],
                    ],
                },
            };
            await bot.sendMessage(chatId, 'You returned to the doctor\'s menu.', options);
        }

    } catch (err) {
        console.error('Error while handling callback query:', err);
    }
};
