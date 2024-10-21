const db = require('../../config/db');

// Отображение календаря
async function showSeizureCalendarRussian(bot, chatId, messageId = null, monthOffset = 0) {
    const today = new Date();
    const currentMonth = today.getMonth() + monthOffset;
    const currentYear = today.getFullYear();

    // Получаем количество дней в месяце
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Получаем записи для календаря
    const result = await db.query('SELECT * FROM calendar WHERE user_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3', [chatId, currentMonth + 1, currentYear]);
    const calendarData = result.rows;

    // Кнопка с месяцем и годом
    const monthYearButton = {
        text: `${new Date(currentYear, currentMonth).toLocaleString('ru-RU', { month: 'long' })} ${currentYear}`,
        callback_data: 'month_year'
    };

    const calendarButtons = {
        reply_markup: {
            inline_keyboard: []
        }
    };

    // Добавляем кнопку месяца и года
    calendarButtons.reply_markup.inline_keyboard.push([monthYearButton]);

    // Дни недели
    calendarButtons.reply_markup.inline_keyboard.push([
        { text: 'Пн', callback_data: 'weekday' },
        { text: 'Вт', callback_data: 'weekday' },
        { text: 'Ср', callback_data: 'weekday' },
        { text: 'Чт', callback_data: 'weekday' },
        { text: 'Пт', callback_data: 'weekday' },
        { text: 'Сб', callback_data: 'weekday' },
        { text: 'Вс', callback_data: 'weekday' },
    ]);

    let row = [];
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const dayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

    // Пустые кнопки до первого числа
    for (let i = 0; i < dayOfWeek; i++) {
        row.push({ text: ' ', callback_data: 'no_action' });
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayRecord = calendarData.find(entry => entry.date.getDate() === day);
        let buttonLabel = `${day}`;

        // Устанавливаем значки для записей рядом с числом
        if (dayRecord) {
            if (dayRecord.had_seizure && dayRecord.medications) {
                buttonLabel += ' 🔴';
            } else if (dayRecord.had_seizure && !dayRecord.medications) {
                buttonLabel += ' 🟡';
            } else if (dayRecord.note) {
                buttonLabel += ' ✅';
            }
        }

        row.push({ text: buttonLabel, callback_data: `calendar_${day}` });

        if (row.length === 7) {
            calendarButtons.reply_markup.inline_keyboard.push(row);
            row = [];
        }
    }

    // Добавляем оставшиеся дни
    while (row.length < 7) {
        row.push({ text: ' ', callback_data: 'no_action' });
    }
    if (row.length) {
        calendarButtons.reply_markup.inline_keyboard.push(row);
    }

    // Кнопки навигации
    calendarButtons.reply_markup.inline_keyboard.push([
        { text: '⬅️', callback_data: `change_month_${monthOffset - 1}` },
        { text: 'Вернуться в профиль', callback_data: 'back_to_profile' },
        { text: '➡️', callback_data: `change_month_${monthOffset + 1}` },
    ]);

    try {
        if (messageId) {
            // Попробуем изменить сообщение
            await bot.editMessageReplyMarkup(calendarButtons.reply_markup, { chat_id: chatId, message_id: messageId });
        } else {
            // Отправляем новое сообщение, если messageId отсутствует
            const sentMessage = await bot.sendMessage(chatId, 'Ваш дневник', calendarButtons);
            return sentMessage.message_id;  // Возвращаем message_id для использования в дальнейшем
        }
    } catch (error) {
        console.error("Ошибка при изменении сообщения:", error);
        const sentMessage = await bot.sendMessage(chatId, 'Ваш дневник', calendarButtons);
        return sentMessage.message_id;  // Возвращаем новый message_id, если старое сообщение было недоступно
    }
}

// Обработка нажатия на день
async function handleCalendarDayRussian(bot, chatId, day, monthOffset) {
    const today = new Date();
    const currentMonth = today.getMonth() + monthOffset;
    const currentYear = today.getFullYear();

    await bot.sendMessage(chatId, `Добавить на ${day} ${new Date(currentYear, currentMonth).toLocaleString('ru-RU', { month: 'long' })} ${currentYear}? У вас был приступ эпилепсии?`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Да', callback_data: `seizure_yes_${day}_${monthOffset}` }, { text: 'Нет', callback_data: `seizure_no_${day}_${monthOffset}` }],
            ],
        },
    });
}

// Обработка смены месяца
async function changeCalendarMonth(bot, chatId, messageId, monthOffset) {
    await showSeizureCalendarRussian(bot, chatId, messageId, monthOffset);
}

// Обработка сохранения данных о приступах
async function handleSeizureEntry(bot, chatId, day, monthOffset, hadSeizure) {
    const today = new Date();
    const currentMonth = today.getMonth() + monthOffset;
    const currentYear = today.getFullYear();
    const entryDate = new Date(currentYear, currentMonth, day);

    if (hadSeizure === 'yes') {
        await bot.sendMessage(chatId, 'Вы принимали лекарства в этот день?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Да', callback_data: `medications_yes_${day}_${monthOffset}` }, { text: 'Нет', callback_data: `medications_no_${day}_${monthOffset}` }]
                ]
            }
        });
    } else {
        await saveCalendarEntry(chatId, entryDate, false, false);
        await bot.sendMessage(chatId, 'Запись сохранена.');
        await showSeizureCalendarRussian(bot, chatId, null, monthOffset);
    }
}

// Сохранение данных в календарь
async function saveCalendarEntry(chatId, date, hadSeizure, medications) {
    await db.query('INSERT INTO calendar (user_id, date, had_seizure, medications) VALUES ($1, $2, $3, $4)', [chatId, date, hadSeizure, medications]);
}

// Обработка записи о приеме лекарств
async function handleMedicationsEntry(bot, chatId, day, monthOffset, medications) {
    const today = new Date();
    const currentMonth = today.getMonth() + monthOffset;
    const currentYear = today.getFullYear();
    const entryDate = new Date(currentYear, currentMonth, day);

    await saveCalendarEntry(chatId, entryDate, true, medications === 'yes');
    await bot.sendMessage(chatId, 'Запись сохранена.');
    await showSeizureCalendarRussian(bot, chatId, null, monthOffset);
}

// Экспортируем функции
module.exports = {
    showSeizureCalendarRussian,
    handleCalendarDayRussian,
    changeCalendarMonth,
    handleSeizureEntry,
    handleMedicationsEntry
};
